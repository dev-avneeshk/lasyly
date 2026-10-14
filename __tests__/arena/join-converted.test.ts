/**
 * /join and converted lobbies (design §4, D-24). A converted lobby reads like
 * any full game: the pre-check refuses it with neutral copy before any charge,
 * and if the conversion lands between the pre-check and the seat claim, the
 * seat mutator refuses it under the lock and the joiner is refunded.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const h = vi.hoisted(() => ({
  userId: "user-late" as string | null,
  seatName: null as string | null,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.userId ? { id: h.userId } : null } }) },
  }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/economy/wallet", () => ({
  chargeArenaStake: vi.fn(async () => "completed"),
  refundArenaStake: vi.fn(async () => "completed"),
  settle1v1: vi.fn(async () => "completed"),
  awardCpuReward: vi.fn(async () => "completed"),
  grantWeeklyLevelBonus: vi.fn(async () => "completed"),
}))
vi.mock("@/lib/realtime/arena", async (orig) => ({
  ...(await orig<typeof import("@/lib/realtime/arena")>()),
  broadcastArenaUpdate: vi.fn(async () => {}),
  registerArenaChannelMember: vi.fn(async () => true),
}))
vi.mock("@/lib/arena/identity", () => ({
  lookupSeatName: vi.fn(async () => h.seatName),
  findTakenNames: vi.fn(async () => new Set<string>()),
}))
// Never reach a real Redis (or its refund queue), whatever the shell exports (D-29).
vi.mock("@/lib/redis", () => ({ getRedisClient: () => null }))
vi.mock("@/lib/arena/matchmaking", async (orig) => ({
  ...(await orig<typeof import("@/lib/arena/matchmaking")>()),
  queuePendingRefund: vi.fn(async () => {}),
}))
vi.mock("@/lib/arena/store", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/store")>()
  // Only the route's lock-free pre-check reads this export; mutateGame still reads the stored record.
  return { ...real, loadGame: vi.fn(real.loadGame) }
})

import { POST as join } from "@/app/api/arena/[gameId]/join/route"
import { createGame, openNextLot } from "@/lib/arena/auction"
import { applyConversion, BOT_SEAT, type ConversionOutcome } from "@/lib/arena/botMatch"
import { BOT_FALLBACK_WAIT_MS } from "@/lib/arena/fallbackTiming"
import { LOBBY_MAX_AGE_MS, queuePendingRefund } from "@/lib/arena/matchmaking"
import { lookupSeatName } from "@/lib/arena/identity"
import { registerArenaChannelMember } from "@/lib/realtime/arena"
import * as store from "@/lib/arena/store"
import * as wallet from "@/lib/economy/wallet"
import { DEFAULT_CONFIG } from "@/lib/arena/types"

const T0 = Date.UTC(2026, 9, 13, 18, 0, 0)
const OWNER = "owner"
const PERSONA = "hoopsjunkie23"
const STAKE = 25
const BANNED = /\b(cpu|ai|bot|computer)\b/i
const INTERNAL = /bot-seat|botMatch|matchmadeLobby|seatNames|lastKey|shownConfig/

/** An open lobby; matchmake step 2's carry the public marker, invite lobbies don't. */
async function lobby(gameId: string, { matchmade = true } = {}) {
  const s = createGame({
    gameId,
    config: { ...DEFAULT_CONFIG, difficulty: "hard", aiPersonality: "aggressive" },
    vsAI: false,
    seed: 9,
  })
  s.isAI.P2 = false
  s.status = "lobby"
  s.econ = { mode: "pvp", amount: STAKE, settled: false }
  if (matchmade) s.matchmadeLobby = { openedAt: T0 }
  s.seatNames = { P1: "realowner" }
  await store.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: null, state: s })
}
/** The owner's pair request committing, as the pair route runs it. */
async function convert(gameId: string) {
  let outcome = null as ConversionOutcome | null
  await store.mutateGame(gameId, (g) => {
    outcome = applyConversion(g, { userId: OWNER, name: PERSONA, now: Date.now(), maxAgeMs: LOBBY_MAX_AGE_MS })
  })
  expect(outcome).toEqual({ kind: "converted" })
}
const call = (gameId: string) =>
  join(new Request(`http://localhost/api/arena/${gameId}/join`, { method: "POST" }), {
    params: Promise.resolve({ gameId }),
  })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(T0 + BOT_FALLBACK_WAIT_MS)
  store._resetStore()
  vi.clearAllMocks()
  h.userId = "user-late"
  h.seatName = null
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("POST /api/arena/[gameId]/join on a converted lobby", () => {
  it("a third user gets the neutral full-game 409 with no charge (AC-10)", async () => {
    await lobby("conv")
    await convert("conv")
    const before = JSON.stringify(await store.loadGame("conv"))

    const res = await call("conv")

    expect(res.status).toBe(409)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ error: "This game is already full." })
    expect(text).not.toMatch(BANNED)
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
    expect(wallet.refundArenaStake).not.toHaveBeenCalled()
    expect(lookupSeatName).not.toHaveBeenCalled()
    expect(JSON.stringify(await store.loadGame("conv"))).toBe(before)
  })

  it("a real CPU game still answers with its own copy (D-24)", async () => {
    const s = createGame({ gameId: "cpu", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 3 })
    openNextLot(s)
    s.econ = { mode: "cpu", amount: 50, settled: false }
    await store.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: null, state: s })

    const res = await call("cpu")

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "This is a CPU game and can't be joined." })
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
  })

  it("the owner re-entering through /join gets the masked view with the persona (AC-27)", async () => {
    await lobby("conv")
    await convert("conv")
    h.userId = OWNER

    const res = await call("conv")

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(JSON.parse(text)).toMatchObject({
      gameId: "conv",
      viewer: "P1",
      status: "auction",
      isAI: { P1: false, P2: false },
      config: { difficulty: "hard", aiPersonality: "aggressive" },
      names: { P1: "realowner", P2: PERSONA },
      econ: { mode: "friendly", amount: STAKE, returned: false },
    })
    expect(text).not.toMatch(INTERNAL)
    expect(registerArenaChannelMember).toHaveBeenCalledWith("conv", OWNER, "P1")
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
  })

  it("refuses inside the lock when the conversion lands after the pre-check, refunds the joiner once (AC-13)", async () => {
    await lobby("race")
    const open = await store.loadGame("race") // what the lock-free pre-check reads…
    await convert("race") // …before the conversion commits
    const converted = JSON.stringify(await store.loadGame("race"))
    vi.mocked(store.loadGame).mockClear()
    vi.mocked(store.loadGame).mockResolvedValueOnce(open)

    const res = await call("race")

    expect(res.status).toBe(409)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ error: "This game is already full." })
    expect(text).not.toMatch(BANNED)
    expect(wallet.chargeArenaStake).toHaveBeenCalledTimes(1)
    expect(wallet.chargeArenaStake).toHaveBeenCalledWith({ userId: "user-late", gameId: "race", amount: STAKE, isPvp: true })
    expect(wallet.refundArenaStake).toHaveBeenCalledTimes(1)
    expect(wallet.refundArenaStake).toHaveBeenCalledWith({ userId: "user-late", gameId: "race" })
    expect(queuePendingRefund).not.toHaveBeenCalled()
    const stored = await store.loadGame("race")
    expect(JSON.stringify(stored)).toBe(converted)
    expect(stored!.guestUserId).toBe(BOT_SEAT)
  })

  it("a game past the lobby with no guest is refused before any charge", async () => {
    const s = createGame({ gameId: "odd", config: { ...DEFAULT_CONFIG }, vsAI: false, seed: 4 })
    s.isAI.P2 = false
    openNextLot(s)
    s.econ = { mode: "pvp", amount: STAKE, settled: false }
    await store.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: null, state: s })

    const res = await call("odd")

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "This game is already full." })
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
  })

  it("an open invite lobby is still joinable and records the joiner's seat name (FR-11.3)", async () => {
    await lobby("inv", { matchmade: false })
    h.userId = "joiner"
    h.seatName = "realguest"

    const res = await call("inv")

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      gameId: "inv",
      viewer: "P2",
      status: "auction",
      isAI: { P1: false, P2: false },
      names: { P1: "realowner", P2: "realguest" },
    })
    const stored = await store.loadGame("inv")
    expect(stored!.guestUserId).toBe("joiner")
    expect(stored!.state.seatNames).toEqual({ P1: "realowner", P2: "realguest" })
    expect(lookupSeatName).toHaveBeenCalledWith("joiner")
    expect(wallet.chargeArenaStake).toHaveBeenCalledWith({ userId: "joiner", gameId: "inv", amount: STAKE, isPvp: true })
    expect(wallet.refundArenaStake).not.toHaveBeenCalled()
  })
})
