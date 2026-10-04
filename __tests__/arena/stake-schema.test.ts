import { describe, it, expect, vi, beforeEach } from "vitest"

// 1v1 stakes are user-chosen. The create and matchmake schemas must hold them to
// [MIN_STAKE, MAX_STAKE] whole coins, and refuse BEFORE any coins move.
const st = vi.hoisted(() => ({ charge: "completed" as string }))

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
// No lobby held, empty queue: matchmake always opens a fresh lobby.
vi.mock("@/lib/arena/matchmaking", async (orig) => ({
  ...(await orig<typeof import("@/lib/arena/matchmaking")>()),
  getUserLobby: async () => null,
  holdUserLobby: async () => true,
  dequeueOpenGame: async () => null,
  enqueueOpenGame: async () => {},
  trackLobby: async () => {},
  untrackLobby: async () => {},
  removeOpenGame: async () => {},
}))
vi.mock("@/lib/economy/wallet", () => ({
  chargeArenaStake: vi.fn(async () => st.charge),
  refundArenaStake: vi.fn(async () => "completed"),
}))

import { POST as create } from "@/app/api/arena/route"
import { POST as matchmake } from "@/app/api/arena/matchmake/route"
import * as store from "@/lib/arena/store"
import * as wallet from "@/lib/economy/wallet"
import { MAX_STAKE, MIN_STAKE, STAKE_PRESETS } from "@/lib/economy/arena"

const post = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify(body),
  })

async function storedAmount(res: Response): Promise<number | undefined> {
  const { gameId } = await res.json()
  return (await store.loadGame(gameId))?.state.econ?.amount
}

beforeEach(() => {
  store._resetStore()
  vi.clearAllMocks()
  st.charge = "completed"
})

describe("POST /api/arena stake (mode human)", () => {
  it.each([4, 1001, 5.5])("stake %s → 400 with no charge", async (stake) => {
    const res = await create(post("/api/arena", { mode: "human", stake }))
    expect(res.status).toBe(400)
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
  })

  it("stake at MAX_STAKE is accepted and charged in full", async () => {
    const res = await create(post("/api/arena", { mode: "human", stake: MAX_STAKE }))
    expect(res.status).toBe(201)
    expect(wallet.chargeArenaStake).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000, isPvp: true }))
    expect(await storedAmount(res)).toBe(1000)
  })

  it("omitted stake defaults to MIN_STAKE", async () => {
    const res = await create(post("/api/arena", { mode: "human" }))
    expect(res.status).toBe(201)
    expect(await storedAmount(res)).toBe(MIN_STAKE)
  })

  it("insufficient funds → 402 INSUFFICIENT_FUNDS", async () => {
    st.charge = "insufficient_funds"
    const res = await create(post("/api/arena", { mode: "human", stake: 250 }))
    expect(res.status).toBe(402)
    expect((await res.json()).code).toBe("INSUFFICIENT_FUNDS")
  })
})

describe("POST /api/arena/matchmake stake", () => {
  it.each([4, 1001])("stake %s → 400 with no charge", async (stake) => {
    const res = await matchmake(post("/api/arena/matchmake", { stake }))
    expect(res.status).toBe(400)
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
  })

  it("stake 250 opens a lobby at that stake", async () => {
    const res = await matchmake(post("/api/arena/matchmake", { stake: 250 }))
    expect(res.status).toBe(201)
    expect(await storedAmount(res)).toBe(250)
  })

  it("insufficient funds → 402 INSUFFICIENT_FUNDS", async () => {
    st.charge = "insufficient_funds"
    const res = await matchmake(post("/api/arena/matchmake", { stake: 100 }))
    expect(res.status).toBe(402)
    expect((await res.json()).code).toBe("INSUFFICIENT_FUNDS")
  })
})

describe("STAKE_PRESETS", () => {
  it("every preset is a valid stake", () => {
    for (const v of STAKE_PRESETS) {
      expect(v).toBeGreaterThanOrEqual(MIN_STAKE)
      expect(v).toBeLessThanOrEqual(MAX_STAKE)
    }
  })
})
