import { describe, it, expect, vi, beforeEach } from "vitest"

// REV-12: a repeat matchmake returned the user's held lobby before checking
// the requested stake, so re-queueing at 100 silently put them back at 50.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) } }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/arena/matchmaking", async (orig) => ({
  ...(await orig<typeof import("@/lib/arena/matchmaking")>()),
  getUserLobby: async () => "held",
}))
vi.mock("@/lib/economy/wallet", () => ({
  chargeArenaStake: vi.fn(async () => "completed"),
  refundArenaStake: vi.fn(async () => "completed"),
}))

import { POST as matchmake } from "@/app/api/arena/matchmake/route"
import * as auction from "@/lib/arena/auction"
import * as store from "@/lib/arena/store"
import * as wallet from "@/lib/economy/wallet"
import { DEFAULT_CONFIG } from "@/lib/arena/types"
import { parseHeldLobby } from "@/lib/arena/clientRequests"

const req = (stake: number) =>
  new Request("http://localhost/api/arena/matchmake", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify({ stake }),
  })

beforeEach(async () => {
  store._resetStore()
  vi.clearAllMocks()
  const s = auction.createGame({ gameId: "held", config: { ...DEFAULT_CONFIG }, vsAI: false })
  s.isAI.P2 = false
  s.status = "lobby"
  s.econ = { mode: "pvp", amount: 50, settled: false }
  await store.saveGame({ rev: 1, ownerUserId: "owner", guestUserId: null, state: s })
})

describe("matchmake with a held lobby", () => {
  it("same stake returns the held lobby without a new charge", async () => {
    const res = await matchmake(req(50))
    expect(res.status).toBe(200)
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
  })

  it("different stake → 409 naming the open lobby (was: silently the old stake)", async () => {
    const res = await matchmake(req(100))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual(expect.objectContaining({ gameId: "held", stake: 50 }))
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
  })

  it("resume from the 409 (held stake fed back) returns the held lobby, no charge", async () => {
    const conflict = await matchmake(req(100))
    const held = parseHeldLobby(conflict.status, await conflict.json())
    expect(held).toEqual({ gameId: "held", stake: 50 })
    const res = await matchmake(req(held!.stake))
    expect(res.status).toBe(200)
    expect((await res.json()).gameId).toBe("held")
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
    expect(wallet.refundArenaStake).not.toHaveBeenCalled()
  })
})
