import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { AIDecision } from "@/lib/arena/ai"
import type { ArenaState } from "@/lib/arena/auction"
import type { StoredGame } from "@/lib/arena/store"
import type { TeamId } from "@/lib/arena/types"

// Engine hooks for converted lobbies (lib/arena/server.ts, store.ts, settle.ts):
// the masked projection, seat claims, the clock, and the settlement guard.
const h = vi.hoisted(() => ({ decide: null as null | ((s: ArenaState, t: TeamId) => AIDecision) }))

vi.mock("@/lib/arena/ai", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/ai")>()
  return {
    ...real,
    decideAI: vi.fn((s: ArenaState, t: TeamId) => (h.decide ? h.decide(s, t) : real.decideAI(s, t))),
  }
})
vi.mock("@/lib/economy/wallet", () => ({
  chargeArenaStake: vi.fn(async () => "completed"),
  refundArenaStake: vi.fn(async () => "completed"),
  settle1v1: vi.fn(async () => "completed"),
  awardCpuReward: vi.fn(async () => "completed"),
  grantWeeklyLevelBonus: vi.fn(async () => "completed"),
}))
// The settlement cases write through the store; keep it on the in-memory fallback whatever the shell exports.
vi.mock("@/lib/redis", () => ({ getRedisClient: () => null }))

import { createGame, minRaise, openNextLot, placeBid } from "@/lib/arena/auction"
import { BOT_THINK_MIN_MS, applyConversion, lotKey } from "@/lib/arena/botMatch"
import { BOT_FALLBACK_WAIT_MS } from "@/lib/arena/fallbackTiming"
import { advanceGame, canClaimSeat, driveAI, serverTick, serverView, startSimulation } from "@/lib/arena/server"
import { settleArenaGame } from "@/lib/arena/settle"
import { _resetStore, loadGame, needsServerTick, saveGame } from "@/lib/arena/store"
import { DEFAULT_CONFIG } from "@/lib/arena/types"
import * as wallet from "@/lib/economy/wallet"

const T0 = Date.UTC(2026, 9, 13, 18, 0, 0)
const T_ELIGIBLE = T0 + BOT_FALLBACK_WAIT_MS
const MAX_AGE_MS = 150 * 60_000
const PERSONA = "hoopsjunkie23"
const INTERNAL = /bot-seat|botMatch|matchmadeLobby|seatNames|lastKey|shownConfig|ownerUserId|guestUserId|"seed"/

const decline = (): AIDecision => ({ action: "pass" })
const bidMin = (s: ArenaState, t: TeamId): AIDecision => ({ action: "bid", amount: minRaise(s, t)! })

function matchmadeLobby(gameId = "bmv-lobby"): StoredGame {
  const s = createGame({
    gameId,
    config: { ...DEFAULT_CONFIG, difficulty: "hard", aiPersonality: "aggressive" },
    vsAI: false,
    seed: 9,
  })
  s.isAI.P2 = false
  s.status = "lobby"
  s.econ = { mode: "pvp", amount: 25, settled: false }
  s.matchmadeLobby = { openedAt: T0 }
  s.seatNames = { P1: "realowner" }
  return { rev: 1, ownerUserId: "owner", guestUserId: null, state: s }
}

/** An invite lobby (POST /api/arena mode "human"): same shape, no public marker. */
function inviteLobby(): StoredGame {
  const g = matchmadeLobby("bmv-invite")
  delete g.state.matchmadeLobby
  return g
}

function seatedMatch(guest = "guest"): StoredGame {
  const g = matchmadeLobby("bmv-seated")
  g.guestUserId = guest
  g.state.status = "auction"
  openNextLot(g.state)
  return g
}

function convertedMatch(decide: (s: ArenaState, t: TeamId) => AIDecision = decline, gameId = "bmv-bot"): StoredGame {
  vi.setSystemTime(T_ELIGIBLE)
  const g = matchmadeLobby(gameId)
  const prev = h.decide
  h.decide = decide
  expect(applyConversion(g, { userId: "owner", name: PERSONA, now: T_ELIGIBLE, maxAgeMs: MAX_AGE_MS })).toEqual({ kind: "converted" })
  h.decide = prev
  return g
}

/** Run the clock to lineup. serverTick only plans opponent moves, so lots pass out and the board auto-fills. */
function playToLineup(s: ArenaState) {
  for (let i = 0; s.status === "auction" && i < 5000; i++) {
    const t = (s.lotDeadline ?? Date.now()) + 1
    vi.setSystemTime(t)
    serverTick(s, t)
  }
  expect(s.status).toBe("lineup")
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(T_ELIGIBLE)
  _resetStore()
  vi.clearAllMocks()
  h.decide = null
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("serverView, bot match", () => {
  it("reports no AI seat and the lobby's own config to both seats (AC-30, Q-13)", () => {
    const g = convertedMatch()
    for (const viewer of ["P1", "P2"] as const) {
      const v = serverView(g.state, viewer, 2)
      expect(v.isAI).toEqual({ P1: false, P2: false })
      expect(v.config).toEqual({ ...g.state.config, difficulty: "hard", aiPersonality: "aggressive" })
    }
    // The projection never writes back: the engine still drives P2 at medium.
    expect(g.state.isAI.P2).toBe(true)
    expect(g.state.config).toMatchObject({ difficulty: "medium", aiPersonality: "superstar" })
  })

  it("shows a friendly econ: returned false while pending, true once confirmed, null after a terminal failure (D-21)", () => {
    const g = convertedMatch()
    const cases = [["pending", false], ["confirmed", true], ["failed", null]] as const
    for (const [refund, returned] of cases) {
      g.state.botMatch!.refund = refund
      expect(serverView(g.state, "P1", 2).econ).toEqual({ mode: "friendly", amount: 25, returned })
    }
  })

  it("carries both seat names from seatNames", () => {
    expect(serverView(convertedMatch().state, "P1", 2).names).toEqual({ P1: "realowner", P2: PERSONA })
  })

  it("leaks no internal field, the seat marker or the seed (NFR-2)", () => {
    const g = convertedMatch(bidMin) // a pending move is planned
    g.state.botMatch!.lastKey = "0|x|0|0|-|"
    expect(g.state.botMatch!.pending).not.toBeNull()
    for (const viewer of ["P1", "P2"] as const) {
      expect(JSON.stringify(serverView(g.state, viewer, 2))).not.toMatch(INTERNAL)
    }
  })
})

describe("serverView, real games", () => {
  it("passes econ, isAI and config through unchanged; names are null until recorded", () => {
    const pvp = seatedMatch().state
    delete pvp.seatNames
    const v = serverView(pvp, "P2", 3)
    expect(v.econ).toBe(pvp.econ)
    expect(v.econ).toEqual({ mode: "pvp", amount: 25, settled: false })
    expect(v.isAI).toBe(pvp.isAI)
    expect(v.config).toBe(pvp.config)
    expect(v.config.difficulty).toBe("hard")
    expect(v.names).toEqual({ P1: null, P2: null })

    pvp.econ!.settled = true
    expect(serverView(pvp, "P1", 4).econ).toEqual({ mode: "pvp", amount: 25, settled: true })
    pvp.seatNames = { P1: "realowner" }
    expect(serverView(pvp, "P1", 4).names).toEqual({ P1: "realowner", P2: null })

    const cpu = createGame({ gameId: "bmv-cpu", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 3 })
    cpu.econ = { mode: "cpu", amount: 50, cpuReward: 90, settled: false }
    const cv = serverView(cpu, "P1", 1)
    expect(cv.econ).toEqual({ mode: "cpu", amount: 50, cpuReward: 90, settled: false })
    expect(cv.isAI).toEqual({ P1: false, P2: true })

    expect(serverView(createGame({ gameId: "bmv-none", config: { ...DEFAULT_CONFIG }, seed: 3 }), "P1", 1).econ).toBeNull()
  })
})

describe("canClaimSeat (AC-13)", () => {
  const cases: Array<[string, () => StoredGame, boolean]> = [
    ["an open invite lobby", inviteLobby, true],
    ["an open matchmade lobby", () => matchmadeLobby(), true],
    ["the caller's own seat (re-join)", () => seatedMatch("joiner"), true],
    ["a converted lobby", () => convertedMatch(), false],
    ["an auction with no guest", () => { const g = matchmadeLobby(); g.state.status = "auction"; return g }, false],
    ["a CPU seat", () => { const g = matchmadeLobby(); g.state.isAI.P2 = true; return g }, false],
    ["a swept lobby (lobby-closed)", () => { const g = matchmadeLobby(); g.guestUserId = "lobby-closed"; return g }, false],
    ["another guest's seat", () => seatedMatch("guest"), false],
  ]

  it.each(cases)("%s → %s", (_label, make, expected) => {
    expect(canClaimSeat(make(), "joiner")).toBe(expected)
  })
})

describe("needsServerTick", () => {
  it("is true once a planned move is due, false before it (lot open, deadline ahead)", () => {
    const s = convertedMatch(bidMin).state
    const p = s.botMatch!.pending!
    expect(p.dueAt).toBeLessThan(s.lotDeadline!)
    expect(needsServerTick(s, p.dueAt - 1)).toBe(false)
    expect(needsServerTick(s, p.dueAt)).toBe(true)

    s.botMatch!.pending = null
    expect(needsServerTick(s, p.dueAt)).toBe(false)
    expect(needsServerTick(s, s.lotDeadline!)).toBe(true)
  })

  it("is unchanged for games without botMatch", () => {
    const s = seatedMatch().state
    expect(needsServerTick(s, s.lotDeadline! - 1)).toBe(false)
    expect(needsServerTick(s, s.lotDeadline!)).toBe(true)
    s.lot = null
    expect(needsServerTick(s)).toBe(true)
    expect(needsServerTick(matchmadeLobby().state)).toBe(false)
  })
})

describe("driveAI", () => {
  it("is a no-op for a bot match, while a real CPU game still bids inside driveAI (FR-4.5)", () => {
    h.decide = bidMin
    const bot = convertedMatch(bidMin).state
    const before = JSON.stringify(bot)
    driveAI(bot)
    expect(JSON.stringify(bot)).toBe(before)
    expect(bot.history).toHaveLength(0)

    const cpu = createGame({ gameId: "bmv-cpu-drive", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 4 })
    openNextLot(cpu)
    driveAI(cpu)
    expect(cpu.history.filter((b) => b.bidder === "P2")).toHaveLength(1)
    expect(cpu.lot!.highBidder).toBe("P2")
  })
})

describe("serverTick, bot match", () => {
  it("plans instead of acting: the opponent's move never lands inside the tick", () => {
    const s = convertedMatch().state // stood pat on lot 1
    const first = s.lot!.player.id
    h.decide = bidMin
    const now = s.lotDeadline!
    vi.setSystemTime(now)

    serverTick(s, now) // lot 1 passes out, the next lot opens

    expect(s.lot!.player.id).not.toBe(first)
    expect(s.history.filter((b) => b.bidder === "P2")).toHaveLength(0)
    expect(s.botMatch!.pending).toMatchObject({ kind: "bid", key: lotKey(s) })
    expect(s.botMatch!.pending!.dueAt).toBeGreaterThanOrEqual(now + BOT_THINK_MIN_MS)
  })

  it("the repair path clears a pending move and restores the result", () => {
    const s = convertedMatch().state
    playToLineup(s)
    expect(s.botMatch!.pending).toBeNull()
    expect(s.result).not.toBeNull()

    s.result = null
    s.botMatch!.pending = { dueAt: 1, key: "stale", kind: "bid" }
    serverTick(s)
    expect(s.botMatch!.pending).toBeNull()
    expect(s.result).not.toBeNull()
  })
})

describe("advanceGame", () => {
  it("lands a due move, then re-plans on the new state", () => {
    const s = convertedMatch().state
    const first = s.lot!.player.id
    placeBid(s, "P1", minRaise(s, "P1")!)
    h.decide = decline
    serverTick(s, T_ELIGIBLE) // the human leads: the opponent plans a pass
    const p = { ...s.botMatch!.pending! }
    expect(p.kind).toBe("pass")

    h.decide = bidMin
    vi.setSystemTime(p.dueAt - 1)
    advanceGame(s, p.dueAt - 1) // not due yet: just the clock
    expect(s.botMatch!.pending).toEqual(p)

    vi.setSystemTime(p.dueAt)
    advanceGame(s, p.dueAt)

    expect(s.results.at(-1)).toMatchObject({ playerId: first, winner: "P1" })
    expect(s.lot!.player.id).not.toBe(first)
    expect(s.botMatch!.lastKey).toBe(p.key)
    expect(s.botMatch!.pending).toMatchObject({ kind: "bid", key: lotKey(s) })
    expect(s.botMatch!.pending!.dueAt).toBeGreaterThanOrEqual(p.dueAt + BOT_THINK_MIN_MS)
  })

  it("is exactly serverTick for games without botMatch", () => {
    for (const vsAI of [true, false]) {
      const s = createGame({ gameId: `bmv-adv-${vsAI}`, config: { ...DEFAULT_CONFIG }, vsAI, seed: 21 })
      openNextLot(s)
      for (let i = 0; i < 40 && s.status === "auction"; i++) {
        // Alternate an idle step (deadline ahead) with a deadline step.
        const t = i % 2 === 0 ? Date.now() + 1 : (s.lotDeadline ?? Date.now()) + 1
        vi.setSystemTime(t)
        const clone = structuredClone(s)
        serverTick(clone, t)
        advanceGame(s, t)
        expect(JSON.stringify(s)).toBe(JSON.stringify(clone))
      }
    }
  })
})

describe("settleArenaGame, bot match", () => {
  it.each(["P1", "P2"] as const)("a %s win pays nothing, even with econ.settled forced false (AC-14, INV-C2)", async (winner) => {
    const g = convertedMatch(decline, `bmv-settle-${winner}`)
    playToLineup(g.state)
    startSimulation(g.state)
    g.state.result = { ...g.state.result!, winner }
    await saveGame(g)
    const error = vi.spyOn(console, "error").mockImplementation(() => {})

    await settleArenaGame(g)
    expect(error).not.toHaveBeenCalled() // econ.settled is true: nothing to report

    g.state.econ!.settled = false
    await settleArenaGame(g)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith("[arena/fallback] settlement guard breached", { gameId: g.state.gameId })

    for (const fn of [wallet.settle1v1, wallet.awardCpuReward, wallet.chargeArenaStake, wallet.refundArenaStake]) {
      expect(vi.mocked(fn)).not.toHaveBeenCalled()
    }
    expect((await loadGame(g.state.gameId))!.rev).toBe(1) // and nothing was written
  })

  it("the same finished game without botMatch does pay: the guard is what stops it", async () => {
    const g = convertedMatch(decline, "bmv-settle-real")
    playToLineup(g.state)
    startSimulation(g.state)
    delete g.state.botMatch
    g.guestUserId = "guest"
    g.state.econ = { mode: "pvp", amount: 25, settled: false }
    await saveGame(g)

    await settleArenaGame(g)

    expect(vi.mocked(wallet.settle1v1)).toHaveBeenCalledTimes(1)
  })
})
