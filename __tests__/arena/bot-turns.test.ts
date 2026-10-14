/**
 * The deferred opponent's runner (lib/arena/botTurns.ts, design §6.5), against
 * the real in-memory store. Only time is injected: Date is faked, the injected
 * `sleep` advances it, and `now` reads it, because openNextLot and placeBid
 * stamp deadlines and history from Date.now().
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { AIDecision } from "@/lib/arena/ai"
import type { ArenaState } from "@/lib/arena/auction"
import type { TeamId } from "@/lib/arena/types"

const h = vi.hoisted(() => ({
  decide: null as null | ((s: ArenaState, t: TeamId) => AIDecision),
  /** When set, every mutateGame call rejects with it (the store's own retries already spent). */
  mutateError: null as Error | null,
}))

vi.mock("@/lib/arena/ai", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/ai")>()
  return {
    ...real,
    decideAI: vi.fn((s: ArenaState, t: TeamId) => (h.decide ? h.decide(s, t) : real.decideAI(s, t))),
  }
})
vi.mock("@/lib/realtime/arena", async (orig) => ({
  ...(await orig<typeof import("@/lib/realtime/arena")>()),
  broadcastArenaUpdate: vi.fn(async () => {}),
}))
vi.mock("@/lib/arena/store", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/store")>()
  return {
    ...real,
    mutateGame: vi.fn((...args: Parameters<typeof real.mutateGame>) =>
      h.mutateError ? Promise.reject(h.mutateError) : real.mutateGame(...args),
    ),
  }
})
// The store must stay on its in-memory fallback, whatever the shell exports.
vi.mock("@/lib/redis", () => ({ getRedisClient: () => null }))

import { createGame, minRaise, placeBid } from "@/lib/arena/auction"
import { BOT_THINK_MAX_MS, BOT_THINK_MIN_MS, applyConversion, type ConversionOutcome } from "@/lib/arena/botMatch"
import { runBotTurns } from "@/lib/arena/botTurns"
import { BOT_FALLBACK_WAIT_MS } from "@/lib/arena/fallbackTiming"
import { serverTick, serverView } from "@/lib/arena/server"
import * as store from "@/lib/arena/store"
import { DEFAULT_CONFIG } from "@/lib/arena/types"
import { broadcastArenaUpdate } from "@/lib/realtime/arena"

const T0 = Date.UTC(2026, 9, 13, 18, 0, 0) // the lobby opened
const T_CONVERT = T0 + BOT_FALLBACK_WAIT_MS
const MAX_AGE_MS = 150 * 60_000 // the pair route passes LOBBY_MAX_AGE_MS
const GAME = "bt-game"
const PERSONA = "hoopsjunkie23"

const decline = (): AIDecision => ({ action: "pass" })
const bidMin = (s: ArenaState, t: TeamId): AIDecision => ({ action: "bid", amount: minRaise(s, t)! })

/** The injected clock: `sleep` moves the faked Date forward, `now` reads it. */
const deps = {
  sleep: vi.fn(async (ms: number) => {
    vi.setSystemTime(Date.now() + ms)
  }),
  now: () => Date.now(),
}

/** A matchmade lobby converted by its owner at T_CONVERT. `decide` is the opponent's lot-1 call (decline: it stands pat). */
async function converted(decide: (s: ArenaState, t: TeamId) => AIDecision = decline) {
  vi.setSystemTime(T_CONVERT)
  const s = createGame({
    gameId: GAME,
    config: { ...DEFAULT_CONFIG, difficulty: "hard", aiPersonality: "aggressive" },
    vsAI: false,
    seed: 7,
  })
  s.isAI.P2 = false
  s.status = "lobby"
  s.econ = { mode: "pvp", amount: 25, settled: false }
  s.matchmadeLobby = { openedAt: T0 }
  s.seatNames = { P1: "realowner" }
  await store.saveGame({ rev: 1, ownerUserId: "owner", guestUserId: null, state: s })
  h.decide = decide
  let outcome = null as ConversionOutcome | null
  await store.mutateGame(GAME, (g) => {
    outcome = applyConversion(g, { userId: "owner", name: PERSONA, now: T_CONVERT, maxAgeMs: MAX_AGE_MS })
  })
  expect(outcome).toEqual({ kind: "converted" })
}

/** The human claims the open lot at the minimum, the way the bid route's mutator does (its clock steps plan the reply). */
async function humanBids(at: number) {
  vi.setSystemTime(at)
  await store.mutateGame(GAME, (g) => {
    serverTick(g.state)
    expect(placeBid(g.state, "P1", minRaise(g.state, "P1")!).ok).toBe(true)
    serverTick(g.state)
  })
}

/** Rewrite the planned move's due time, as if it had been planned that far out. */
async function moveDueAt(dueAt: number) {
  await store.mutateGame(GAME, (g) => {
    g.state.botMatch!.pending!.dueAt = dueAt
  })
}

const stored = async () => (await store.loadGame(GAME))!
const p2Actions = (s: ArenaState) => s.history.filter((b) => b.bidder === "P2").length + (s.passed.includes("P2") ? 1 : 0)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(T_CONVERT)
  store._resetStore()
  vi.clearAllMocks()
  h.decide = null
  h.mutateError = null
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("runBotTurns", () => {
  it("sleeps until the move is due, lands it under the lock, broadcasts the P1 view, and chains the follow-up", async () => {
    await converted() // stands pat on lot 1
    const lot1 = (await stored()).state.lot!.player.id
    // The opponent declines lot 1, so it passes once the human leads, then claims whatever opens next.
    h.decide = (s, t) => (s.lot!.player.id === lot1 ? decline() : bidMin(s, t))
    const bidAt = T_CONVERT + 1_000
    await humanBids(bidAt)
    const planned = (await stored()).state.botMatch!.pending!
    expect(planned.kind).toBe("pass")
    vi.mocked(store.mutateGame).mockClear()

    await runBotTurns(GAME, deps)

    const after = await stored()
    const s = after.state
    // Move 1, the pass, resolved lot 1 to the human; move 2 claimed the next lot.
    expect(s.results).toEqual([expect.objectContaining({ playerId: lot1, winner: "P1" })])
    expect(s.lot!.player.id).not.toBe(lot1)
    expect(s.lot!.highBidder).toBe("P2")
    const p2Bids = s.history.filter((b) => b.bidder === "P2")
    expect(p2Bids).toHaveLength(1)
    expect(s.botMatch!.pending).toBeNull()
    // It slept exactly until each move was due: a think delay apart, never longer.
    const waits = deps.sleep.mock.calls.map(([ms]) => ms)
    expect(waits).toHaveLength(2)
    expect(waits[0]).toBe(planned.dueAt - bidAt)
    for (const ms of waits) {
      expect(ms).toBeGreaterThanOrEqual(BOT_THINK_MIN_MS)
      expect(ms).toBeLessThanOrEqual(BOT_THINK_MAX_MS)
    }
    expect(p2Bids[0].ts).toBe(planned.dueAt + waits[1])
    // Each landing is one locked write (the last loop pass only reads), broadcast as the owner's P1 view.
    expect(store.mutateGame).toHaveBeenCalledTimes(2)
    expect(after.rev).toBe(5) // saved 1, converted 2, the human's bid 3, then one per move
    const pushes = vi.mocked(broadcastArenaUpdate).mock.calls
    expect(pushes.map(([id, view]) => [id, view!.viewer, view!.rev])).toEqual([
      [GAME, "P1", 4],
      [GAME, "P1", 5],
    ])
    expect(pushes[1][1]).toEqual(serverView(s, "P1", after.rev))
  })

  it("exits at once when the record is missing, nothing is pending, or the auction is over", async () => {
    const exitedAtOnce = () => {
      expect(deps.sleep).not.toHaveBeenCalled()
      expect(store.mutateGame).not.toHaveBeenCalled()
      expect(broadcastArenaUpdate).not.toHaveBeenCalled()
    }

    await runBotTurns("missing", deps)
    exitedAtOnce()

    await converted() // an unclaimed lot the human is still deciding on: nothing planned
    expect((await stored()).state.botMatch!.pending).toBeNull()
    vi.mocked(store.mutateGame).mockClear()
    const idle = JSON.stringify(await stored())
    await runBotTurns(GAME, deps)
    exitedAtOnce()
    expect(JSON.stringify(await stored())).toBe(idle)

    await store.mutateGame(GAME, (g) => {
      g.state.status = "lineup"
      g.state.botMatch!.pending = { dueAt: Date.now() + 1_000, key: "stale", kind: "bid" }
    })
    vi.mocked(store.mutateGame).mockClear()
    const finished = JSON.stringify(await stored())
    await runBotTurns(GAME, deps)
    exitedAtOnce()
    expect(JSON.stringify(await stored())).toBe(finished)
  })

  it("leaves a move further out than BOT_THINK_MAX_MS to the next poll; exactly BOT_THINK_MAX_MS is still landed", async () => {
    await converted(bidMin) // the lot-1 claim is planned
    await moveDueAt(Date.now() + BOT_THINK_MAX_MS + 1)
    vi.mocked(store.mutateGame).mockClear()
    const before = JSON.stringify(await stored())

    await runBotTurns(GAME, deps)

    expect(deps.sleep).not.toHaveBeenCalled()
    expect(store.mutateGame).not.toHaveBeenCalled()
    expect(JSON.stringify(await stored())).toBe(before)

    await moveDueAt(Date.now() + BOT_THINK_MAX_MS)
    await runBotTurns(GAME, deps)

    expect(deps.sleep).toHaveBeenCalledWith(BOT_THINK_MAX_MS)
    expect(p2Actions((await stored()).state)).toBe(1)
  })

  it("never sleeps past its 20 s budget: a move that would end after it is left pending", async () => {
    await converted(bidMin)
    // A runner that started 18.5 s ago (it already landed a chain of moves).
    const startedEarlier = () => {
      let first = true
      return () => {
        const t = Date.now()
        if (!first) return t
        first = false
        return t - 18_500
      }
    }
    await moveDueAt(Date.now() + 2_000) // 18.5 + 2.0 > 20 s
    vi.mocked(store.mutateGame).mockClear()
    const before = JSON.stringify(await stored())

    await runBotTurns(GAME, { sleep: deps.sleep, now: startedEarlier() })

    expect(deps.sleep).not.toHaveBeenCalled()
    expect(store.mutateGame).not.toHaveBeenCalled()
    expect(JSON.stringify(await stored())).toBe(before)

    await moveDueAt(Date.now() + 1_500) // 18.5 + 1.5 = 20 s: still inside the budget
    await runBotTurns(GAME, { sleep: deps.sleep, now: startedEarlier() })

    expect(deps.sleep).toHaveBeenCalledWith(1_500)
    expect(p2Actions((await stored()).state)).toBe(1)
  })

  it("two concurrent runners land one action (INV-R6)", async () => {
    await converted()
    h.decide = bidMin // the opponent answers the human's bid
    await humanBids(T_CONVERT + 1_000)
    expect((await stored()).state.botMatch!.pending).toMatchObject({ kind: "bid" })

    await Promise.all([runBotTurns(GAME, deps), runBotTurns(GAME, deps)])

    const s = (await stored()).state
    expect(p2Actions(s)).toBe(1)
    expect(s.lot!.highBidder).toBe("P2")
    expect(s.botMatch!.pending).toBeNull()
    expect(broadcastArenaUpdate).toHaveBeenCalledTimes(1) // the second landing was a no-op write
  })

  it("rejects when the locked write throws, leaving the move pending for the next poll", async () => {
    await converted(bidMin)
    h.mutateError = new store.GameBusyError()

    await expect(runBotTurns(GAME, deps)).rejects.toBeInstanceOf(store.GameBusyError)

    expect(broadcastArenaUpdate).not.toHaveBeenCalled()
    expect((await stored()).state.botMatch!.pending).toMatchObject({ kind: "bid" })
    expect(p2Actions((await stored()).state)).toBe(0)
  })
})
