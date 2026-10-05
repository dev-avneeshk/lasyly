import { describe, it, expect, vi, beforeEach } from "vitest"

// L-09: simulate set `econ.settled = true` before the payout RPC, so a failed
// RPC lost the payout for good. L-08: a game that failed to persist after the
// stake was charged kept the coins.
const st = vi.hoisted(() => ({ settleResults: [] as string[], failSave: false }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) } }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/realtime/arena", async (orig) => ({
  ...(await orig<typeof import("@/lib/realtime/arena")>()),
  broadcastArenaUpdate: vi.fn(async () => {}),
  registerArenaChannelMember: vi.fn(async () => {}),
}))
vi.mock("@/lib/arena/store", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/store")>()
  return {
    ...real,
    saveGame: async (g: Parameters<typeof real.saveGame>[0]) => {
      if (st.failSave) throw new Error("redis down")
      return real.saveGame(g)
    },
  }
})
vi.mock("@/lib/economy/wallet", () => ({
  chargeArenaStake: vi.fn(async () => "completed"),
  refundArenaStake: vi.fn(async () => "completed"),
  awardCpuReward: vi.fn(async () => "completed"),
  settle1v1: vi.fn(async () => st.settleResults.shift() ?? "completed"),
}))

import { POST as simulate } from "@/app/api/arena/[gameId]/simulate/route"
import { GET as view } from "@/app/api/arena/[gameId]/route"
import { POST as create } from "@/app/api/arena/route"
import * as auction from "@/lib/arena/auction"
import * as server from "@/lib/arena/server"
import * as store from "@/lib/arena/store"
import * as wallet from "@/lib/economy/wallet"
import { DEFAULT_CONFIG } from "@/lib/arena/types"
import { hashSeed } from "@/lib/arena/rng"

async function lineup1v1(gameId: string) {
  const s = auction.createGame({ gameId, config: { ...DEFAULT_CONFIG }, vsAI: false, seed: 11 })
  s.status = "auction"
  auction.openNextLot(s)
  for (let i = 0; s.status === "auction" && i < 5000; i++) server.serverTick(s, (s.lotDeadline ?? Date.now()) + 1)
  s.econ = { mode: "pvp", amount: 50, settled: false }
  await store.saveGame({ rev: 1, ownerUserId: "owner", guestUserId: "guest", state: s })
}
const ctx = (gameId: string) => ({ params: Promise.resolve({ gameId }) })
const req = (url: string, init?: RequestInit) =>
  new Request(`http://localhost${url}`, { headers: { origin: "http://localhost:3000", "content-type": "application/json" }, ...init })

beforeEach(() => {
  store._resetStore()
  vi.clearAllMocks()
  st.settleResults = []
  st.failSave = false
})

describe("arena payout (L-09)", () => {
  it("a failed payout RPC is retried on the next view and then paid once", async () => {
    await lineup1v1("g1")
    st.settleResults = ["error"]
    expect((await simulate(req("/api/arena/g1/simulate", { method: "POST" }), ctx("g1"))).status).toBe(200)
    expect((await store.loadGame("g1"))!.state.econ!.settled).toBe(false) // was: true, payout lost

    await view(req("/api/arena/g1"), ctx("g1"))
    expect((await store.loadGame("g1"))!.state.econ!.settled).toBe(true)
    await view(req("/api/arena/g1"), ctx("g1"))
    expect(wallet.settle1v1).toHaveBeenCalledTimes(2) // failed try + one successful payout
  })

  it("no_profile is terminal: polls stop re-calling the payout RPC (REV-15)", async () => {
    await lineup1v1("g2")
    st.settleResults = ["no_profile", "no_profile", "no_profile"]
    await simulate(req("/api/arena/g2/simulate", { method: "POST" }), ctx("g2"))
    await view(req("/api/arena/g2"), ctx("g2"))
    await view(req("/api/arena/g2"), ctx("g2"))
    expect(wallet.settle1v1).toHaveBeenCalledTimes(1) // was: once per poll
  })
})

describe("arena create (L-08)", () => {
  it("refunds the stake when the game can't be saved", async () => {
    st.failSave = true
    const res = await create(req("/api/arena", { method: "POST", body: JSON.stringify({ mode: "ai" }) }))
    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(wallet.refundArenaStake).toHaveBeenCalledTimes(1)
  })

  it("seeds server games unpredictably, not from the public game id (L-10)", async () => {
    const res = await create(req("/api/arena", { method: "POST", body: JSON.stringify({ mode: "ai" }) }))
    const { gameId } = await res.json()
    const stored = await store.loadGame(gameId)
    expect(stored!.state.seed).not.toBe(hashSeed(gameId)) // was equal: lots and result precomputable
    expect(JSON.stringify(await (await view(req(`/api/arena/${gameId}`), ctx(gameId))).json())).not.toContain('"seed"')
  })

  it("does not refund a game that saved", async () => {
    const res = await create(req("/api/arena", { method: "POST", body: JSON.stringify({ mode: "ai" }) }))
    expect(res.status).toBe(201)
    expect(wallet.refundArenaStake).not.toHaveBeenCalled()
  })
})
