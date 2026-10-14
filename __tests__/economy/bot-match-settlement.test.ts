/**
 * Coins in a bot match (design §5, AC-14, AC-15, AC-20, FR-8): the owner's stake
 * is charged once at matchmake and refunded once at conversion, and nothing
 * else ever moves. No payout, CPU reward, commission or XP, whoever wins, and
 * polls make no wallet call once the refund is confirmed.
 *
 * Real routes against the in-memory store. The wallet mock is a ledger that
 * answers like the real RPCs (refund_arena_stake: already_settled once anyone
 * was paid, duplicate after a refund, nothing_to_refund with no stake), and a
 * scripted result list can override the refund answers in order.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { AIDecision } from "@/lib/arena/ai"
import type { ArenaState } from "@/lib/arena/auction"
import type { TeamId } from "@/lib/arena/types"

const h = vi.hoisted(() => ({
  userId: "owner",
  decide: null as null | ((s: ArenaState, t: TeamId) => AIDecision),
  stakes: new Set<string>(),
  refunds: new Set<string>(),
  paidGames: new Set<string>(),
  refundResults: [] as string[],
  calls: [] as Array<{ op: string; userId: string; gameId: string; result: string }>,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: h.userId } } }) } }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/economy/wallet", () => ({
  chargeArenaStake: vi.fn(async ({ userId, gameId }: { userId: string; gameId: string }) => {
    const key = `${userId}:${gameId}`
    const result = h.stakes.has(key) ? "duplicate" : "completed"
    h.stakes.add(key)
    h.calls.push({ op: "charge", userId, gameId, result })
    return result
  }),
  refundArenaStake: vi.fn(async ({ userId, gameId }: { userId: string; gameId: string }) => {
    const key = `${userId}:${gameId}`
    const result =
      h.refundResults.shift() ??
      (h.paidGames.has(gameId)
        ? "already_settled"
        : h.refunds.has(key)
          ? "duplicate"
          : h.stakes.has(key)
            ? "completed"
            : "nothing_to_refund")
    if (result === "completed") h.refunds.add(key)
    h.calls.push({ op: "refund", userId, gameId, result })
    return result
  }),
  settle1v1: vi.fn(async ({ gameId, winnerId }: { gameId: string; winnerId: string }) => {
    h.paidGames.add(gameId)
    h.calls.push({ op: "settle", userId: winnerId, gameId, result: "completed" })
    return "completed"
  }),
  awardCpuReward: vi.fn(async ({ userId, gameId }: { userId: string; gameId: string }) => {
    h.paidGames.add(gameId)
    h.calls.push({ op: "cpuReward", userId, gameId, result: "completed" })
    return "completed"
  }),
  grantWeeklyLevelBonus: vi.fn(async ({ userId }: { userId: string }) => {
    h.calls.push({ op: "weeklyBonus", userId, gameId: "-", result: "completed" })
    return "completed"
  }),
}))
vi.mock("@/lib/realtime/arena", async (orig) => ({
  ...(await orig<typeof import("@/lib/realtime/arena")>()),
  broadcastArenaUpdate: vi.fn(async () => {}),
  registerArenaChannelMember: vi.fn(async () => true),
}))
vi.mock("@/lib/arena/identity", () => ({
  lookupSeatName: vi.fn(async () => "realowner"),
  findTakenNames: vi.fn(async () => new Set<string>()),
}))
vi.mock("@/lib/arena/botTurns", () => ({ runBotTurns: vi.fn(async () => {}) }))
// Never reach a real Redis (or its refund queue), whatever the shell exports (D-29). With no Redis
// the 15 s refund-retry throttle is skipped, so every owner request retries an unconfirmed refund.
vi.mock("@/lib/redis", () => ({ getRedisClient: () => null }))
vi.mock("@/lib/arena/ai", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/ai")>()
  return {
    ...real,
    decideAI: vi.fn((s: ArenaState, t: TeamId) => (h.decide ? h.decide(s, t) : real.decideAI(s, t))),
  }
})

import { POST as pair } from "@/app/api/arena/[gameId]/pair/route"
import { GET as view } from "@/app/api/arena/[gameId]/route"
import { POST as bid } from "@/app/api/arena/[gameId]/bid/route"
import { POST as passLot } from "@/app/api/arena/[gameId]/pass/route"
import { POST as simulate } from "@/app/api/arena/[gameId]/simulate/route"
import { POST as matchmake } from "@/app/api/arena/matchmake/route"
import { minRaise } from "@/lib/arena/auction"
import { BOT_SEAT } from "@/lib/arena/botMatch"
import { BOT_FALLBACK_WAIT_MS } from "@/lib/arena/fallbackTiming"
import { ensureResult, serverTick } from "@/lib/arena/server"
import * as store from "@/lib/arena/store"
import * as wallet from "@/lib/economy/wallet"

const T0 = Date.UTC(2026, 9, 13, 18, 0, 0) // the lobby opened
const T_CONVERT = T0 + BOT_FALLBACK_WAIT_MS
const OWNER = "owner"
const STAKE = 25

const ctx = (gameId: string) => ({ params: Promise.resolve({ gameId }) })
const post = (path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
const get = async (gameId: string) => {
  const res = await view(new Request(`http://localhost/api/arena/${gameId}`), ctx(gameId))
  expect(res.status).toBe(200)
  return res.json()
}
const simulateIt = async (gameId: string) => {
  const res = await simulate(post(`/api/arena/${gameId}/simulate`), ctx(gameId))
  expect(res.status).toBe(200)
  return res.json()
}
const stored = async (gameId: string) => (await store.loadGame(gameId))!
const callsFor = (gameId: string) => h.calls.filter((c) => c.gameId === gameId).map((c) => [c.op, c.userId, c.result])
const refundCalls = (gameId: string) => h.calls.filter((c) => c.op === "refund" && c.gameId === gameId)

/** Let fire-and-forget deferred work settle (real timers: only Date is faked). */
const flush = () => new Promise((resolve) => setTimeout(resolve, 20))
/** vi.waitFor would advance the faked Date 50 ms per check; this polls with real timers instead. */
async function eventually(assertion: () => unknown, timeoutMs = 2_000) {
  const deadline = performance.now() + timeoutMs
  for (;;) {
    try {
      await assertion()
      return
    } catch (error) {
      if (performance.now() > deadline) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

/** Run the server clock to lineup. serverTick never lands the opponent's planned moves, so this is deterministic. */
function playToLineup(s: ArenaState) {
  for (let i = 0; s.status === "auction" && i < 5000; i++) serverTick(s, (s.lotDeadline ?? Date.now()) + 1)
  expect(s.status).toBe("lineup")
}

/** The first seed in 1..500 whose simulation, on the same auction, gives `winner` the game. */
function probeSeed(state: ArenaState, winner: TeamId): number {
  for (let seed = 1; seed <= 500; seed++) {
    const s = structuredClone(state)
    s.seed = seed
    playToLineup(s)
    if (ensureResult(s)!.winner === winner) return seed
  }
  throw new Error(`no seed in 1..500 gives ${winner} the game`)
}

/**
 * A public lobby from matchmake step 2 at T0, converted by its owner at
 * T_CONVERT. Waits for the conversion's own deferred refund RPC, so scripted
 * refund results apply in order.
 */
async function botMatch(): Promise<string> {
  vi.setSystemTime(T0)
  const opened = await matchmake(post("/api/arena/matchmake", { stake: STAKE, difficulty: "hard" }))
  expect(opened.status).toBe(201)
  const { gameId } = await opened.json()
  vi.setSystemTime(T_CONVERT)
  expect((await pair(post(`/api/arena/${gameId}/pair`), ctx(gameId))).status).toBe(200)
  await eventually(() => expect(wallet.refundArenaStake).toHaveBeenCalledTimes(1))
  await flush() // and the status write that follows it
  return gameId
}

/** Drive the converted match to lineup inside one locked write, on a seed that makes `winner` win. */
async function toLineup(gameId: string, winner?: TeamId) {
  const seed = winner ? probeSeed((await stored(gameId)).state, winner) : undefined
  await store.mutateGame(gameId, (g) => {
    if (seed !== undefined) g.state.seed = seed
    playToLineup(g.state)
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(T0)
  store._resetStore()
  vi.clearAllMocks()
  h.userId = OWNER
  h.decide = null
  h.refundResults = []
  h.calls = []
  h.stakes.clear()
  h.refunds.clear()
  h.paidGames.clear()
})
afterEach(async () => {
  await flush()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("bot match settlement: nothing is ever paid (AC-14, INV-C2)", () => {
  it.each(["P1", "P2"] as const)("a %s win completes with no payout or CPU reward, and polls make no wallet call", async (winner) => {
    const id = await botMatch()
    await eventually(async () => expect((await stored(id)).state.botMatch!.refund).toBe("confirmed"))
    await toLineup(id, winner)
    const before = h.calls.length
    vi.setSystemTime(T_CONVERT + 120_000)

    const done = await simulateIt(id)
    expect(done.status).toBe("complete")
    expect(done.result.winner).toBe(winner)
    for (let i = 0; i < 3; i++) {
      vi.setSystemTime(T_CONVERT + 121_000 + i * 5_000)
      const polled = await get(id)
      expect(polled.status).toBe("complete")
      expect(polled.econ).toEqual({ mode: "friendly", amount: STAKE, returned: true })
    }
    await flush()

    expect(wallet.settle1v1).not.toHaveBeenCalled()
    expect(wallet.awardCpuReward).not.toHaveBeenCalled()
    expect(h.calls.length).toBe(before) // no wallet call at all after the refund
    expect((await stored(id)).state.econ).toEqual({ mode: "pvp", amount: STAKE, settled: true })
  })

  it("simulate logs the completion once, even when it is repeated", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const id = await botMatch()
    await toLineup(id, "P2")

    await simulateIt(id)
    await simulateIt(id)

    expect(info.mock.calls.filter(([msg]) => msg === "[arena/fallback] completed")).toEqual([
      ["[arena/fallback] completed", { gameId: id, winner: "P2" }],
    ])
  })
})

describe("bot match refunds (AC-15, AC-20, D-21)", () => {
  it("a refund that errors at conversion still commits it; the next GET confirms it, and later GETs make no call (AC-15)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    h.refundResults = ["error", "completed"]
    const id = await botMatch()
    expect((await stored(id)).guestUserId).toBe(BOT_SEAT) // the conversion committed anyway
    expect((await stored(id)).state.botMatch!.refund).toBe("pending")

    vi.setSystemTime(T_CONVERT + 5_000)
    const pending = await get(id)
    expect(pending.econ).toEqual({ mode: "friendly", amount: STAKE, returned: false }) // answered before the retry lands
    await eventually(async () => expect((await stored(id)).state.botMatch!.refund).toBe("confirmed"))
    expect(refundCalls(id).map((c) => c.result)).toEqual(["error", "completed"])

    vi.setSystemTime(T_CONVERT + 10_000)
    expect((await get(id)).econ).toEqual({ mode: "friendly", amount: STAKE, returned: true })
    vi.setSystemTime(T_CONVERT + 15_000)
    await get(id)
    await flush()
    expect(refundCalls(id)).toHaveLength(2)
  })

  it("the owner's wallet transcript is exactly one charge and one refund, across matchmake, pair, simulate and 3 GETs (AC-20)", async () => {
    const id = await botMatch()
    await toLineup(id)
    vi.setSystemTime(T_CONVERT + 120_000)
    await simulateIt(id)
    for (let i = 0; i < 3; i++) await get(id)
    await flush()

    expect(callsFor(id)).toEqual([
      ["charge", OWNER, "completed"],
      ["refund", OWNER, "completed"],
    ])
  })

  it("a terminal already_settled marks the refund failed: the view claims nothing, it's logged, and never retried (D-21)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    h.refundResults = ["already_settled"]
    const id = await botMatch()

    expect((await stored(id)).state.botMatch!.refund).toBe("failed")
    expect(error).toHaveBeenCalledWith("[arena/refund] invariant breach", {
      gameId: id,
      userId: OWNER,
      result: "already_settled",
    })
    vi.setSystemTime(T_CONVERT + 5_000)
    expect((await get(id)).econ).toEqual({ mode: "friendly", amount: STAKE, returned: null })
    vi.setSystemTime(T_CONVERT + 10_000)
    await get(id)
    await flush()
    expect(refundCalls(id)).toHaveLength(1)
  })
})

describe("XP and stats exclusion (FR-8.1, FR-8.2)", () => {
  it("across a whole match (bid, pass, polls, simulate), settle1v1, awardCpuReward and grantWeeklyLevelBonus are never called", async () => {
    const id = await botMatch()
    h.decide = (s, t) => ({ action: "bid", amount: minRaise(s, t)! }) // the opponent answers every bid
    vi.setSystemTime(T_CONVERT + 1_000)
    const s = (await stored(id)).state
    const body = { amount: minRaise(s, "P1"), lotPlayerId: s.lot!.player.id }
    expect((await bid(post(`/api/arena/${id}/bid`, body), ctx(id))).status).toBe(200)
    // The opponent's reply lands on the poll at its due time; the human then passes.
    vi.setSystemTime((await stored(id)).state.botMatch!.pending!.dueAt)
    expect((await get(id)).lot.highBidder).toBe("P2")
    expect((await passLot(post(`/api/arena/${id}/pass`), ctx(id))).status).toBe(200)
    await toLineup(id)
    vi.setSystemTime(T_CONVERT + 120_000)
    await simulateIt(id)
    for (let i = 0; i < 3; i++) await get(id)
    await flush()

    expect(wallet.settle1v1).not.toHaveBeenCalled()
    expect(wallet.awardCpuReward).not.toHaveBeenCalled()
    expect(wallet.grantWeeklyLevelBonus).not.toHaveBeenCalled()
    expect(h.calls.map((c) => c.op)).toEqual(["charge", "refund"])
  })
})
