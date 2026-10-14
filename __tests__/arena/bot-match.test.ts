import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { AIDecision } from "@/lib/arena/ai"
import type { ArenaState } from "@/lib/arena/auction"
import type { StoredGame } from "@/lib/arena/store"
import type { TeamId } from "@/lib/arena/types"

// Global-match fallback core (lib/arena/botMatch.ts): the conversion verdict and
// commit, and the deferred opponent planner/lander. The opponent's decision can
// be forced per test; with `h.decide` unset the real engine decides.
const h = vi.hoisted(() => ({ decide: null as null | ((s: ArenaState, t: TeamId) => AIDecision) }))

vi.mock("@/lib/arena/ai", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/ai")>()
  return {
    ...real,
    decideAI: vi.fn((s: ArenaState, t: TeamId) => (h.decide ? h.decide(s, t) : real.decideAI(s, t))),
  }
})

import { decideAI } from "@/lib/arena/ai"
import { createGame, minRaise, openNextLot, otherTeam, pass, placeBid, resolveLot } from "@/lib/arena/auction"
import {
  BOT_DEADLINE_MARGIN_MS,
  BOT_DIFFICULTY,
  BOT_SEAT,
  BOT_THINK_MAX_MS,
  BOT_THINK_MIN_MS,
  applyConversion,
  conversionVerdict,
  lotKey,
  planBotTurn,
  runDueBotTurn,
  type ConversionOutcome,
} from "@/lib/arena/botMatch"
import { getSeasonPlayers } from "@/lib/arena/data"
import { BOT_FALLBACK_WAIT_MS } from "@/lib/arena/fallbackTiming"
import { mulberry32 } from "@/lib/arena/rng"
import { canFillSlot, emptyRoster, ownsPlayer, placePlayer } from "@/lib/arena/roster"
import { DEFAULT_CONFIG, ROSTER_SLOTS, bestPersonalityForDifficulty } from "@/lib/arena/types"

const T0 = Date.UTC(2026, 9, 13, 18, 0, 0) // the lobby opened
const T_ELIGIBLE = T0 + BOT_FALLBACK_WAIT_MS
const MAX_AGE_MS = 150 * 60_000 // the pair route passes LOBBY_MAX_AGE_MS
const PERSONA = "hoopsjunkie23"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const decline = (): AIDecision => ({ action: "pass" })
const bidMin = (s: ArenaState, t: TeamId): AIDecision => ({ action: "bid", amount: minRaise(s, t)! })

/** A lobby as matchmake step 2 creates it: 25-coin stake, owner "owner", opened at T0, a "hard" vs-CPU pick. */
function matchmadeLobby(): StoredGame {
  const s = createGame({
    gameId: "bm-lobby",
    config: { ...DEFAULT_CONFIG, difficulty: "hard", aiPersonality: "aggressive" },
    vsAI: false,
    seed: 7,
  })
  s.isAI.P2 = false
  s.status = "lobby"
  s.econ = { mode: "pvp", amount: 25, settled: false }
  s.matchmadeLobby = { openedAt: T0 }
  s.seatNames = { P1: "realowner" }
  return { rev: 1, ownerUserId: "owner", guestUserId: null, state: s }
}

/** The same lobby after a real joiner took P2. */
function seatedMatch(): StoredGame {
  const g = matchmadeLobby()
  g.guestUserId = "guest"
  g.state.status = "auction"
  openNextLot(g.state)
  return g
}

/** The lobby converted at T_ELIGIBLE; `decide` is the opponent's lot-1 decision (default: decline, so it stands pat). */
function convertedMatch(decide: (s: ArenaState, t: TeamId) => AIDecision = decline, rand?: () => number): StoredGame {
  vi.setSystemTime(T_ELIGIBLE)
  const g = matchmadeLobby()
  const prev = h.decide
  h.decide = decide
  const out = applyConversion(g, { userId: "owner", name: PERSONA, now: T_ELIGIBLE, maxAgeMs: MAX_AGE_MS, rand })
  h.decide = prev
  expect(out).toEqual({ kind: "converted" })
  return g
}

/** Fill a seat's six slots with $1 players that are neither on the block nor on the other roster. */
function fillRoster(s: ArenaState, team: TeamId) {
  const other = s.rosters[otherTeam(team)]
  let roster = emptyRoster()
  for (const slot of ROSTER_SLOTS) {
    const player = getSeasonPlayers(s.season).find(
      (p) => p.id !== s.lot?.player.id && !ownsPlayer(other, p.id) && !ownsPlayer(roster, p.id) && canFillSlot(p, slot),
    )!
    roster = placePlayer(roster, player, 1, slot)
  }
  s.rosters[team] = roster
}

const p2Bids = (s: ArenaState) => s.history.filter((b) => b.bidder === "P2")

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(T_ELIGIBLE)
  vi.clearAllMocks()
  h.decide = null
})

afterEach(() => {
  vi.useRealTimers()
})

describe("conversionVerdict", () => {
  it("is eligible at exactly BOT_FALLBACK_WAIT_MS, with the lobby's age (AC-1)", () => {
    const g = matchmadeLobby()
    expect(conversionVerdict(g, "owner", T0 + BOT_FALLBACK_WAIT_MS, MAX_AGE_MS)).toEqual({ kind: "eligible", ageMs: BOT_FALLBACK_WAIT_MS })
    expect(conversionVerdict(g, "owner", T0 + 61_000, MAX_AGE_MS)).toEqual({ kind: "eligible", ageMs: 61_000 })
  })

  it("is not_yet one ms before the threshold, with retryAfterMs 1 (AC-2)", () => {
    expect(conversionVerdict(matchmadeLobby(), "owner", T_ELIGIBLE - 1, MAX_AGE_MS)).toEqual({ kind: "not_yet", retryAfterMs: 1 })
    expect(conversionVerdict(matchmadeLobby(), "owner", T0, MAX_AGE_MS)).toEqual({ kind: "not_yet", retryAfterMs: BOT_FALLBACK_WAIT_MS })
  })

  it("answers not_owner first, for an open, a converted and a seated record (AC-3)", () => {
    for (const g of [matchmadeLobby(), convertedMatch(), seatedMatch()]) {
      expect(conversionVerdict(g, "intruder", T_ELIGIBLE, MAX_AGE_MS)).toEqual({ kind: "not_owner" })
      expect(conversionVerdict(g, "guest", T_ELIGIBLE, MAX_AGE_MS)).toEqual({ kind: "not_owner" })
    }
  })

  it("is already once botMatch is present", () => {
    expect(conversionVerdict(convertedMatch(), "owner", T_ELIGIBLE + 5_000, MAX_AGE_MS)).toEqual({ kind: "already" })
  })

  it("is seated when a real guest holds P2 in the auction (AC-7)", () => {
    expect(conversionVerdict(seatedMatch(), "owner", T_ELIGIBLE, MAX_AGE_MS)).toEqual({ kind: "seated" })
  })

  it("refuses an invite or pre-deploy lobby (no public marker) at any age (AC-4)", () => {
    const g = matchmadeLobby()
    delete g.state.matchmadeLobby
    for (const now of [T_ELIGIBLE, T0 + 60 * 60_000]) {
      expect(conversionVerdict(g, "owner", now, MAX_AGE_MS)).toEqual({ kind: "unavailable", reason: "not_public" })
    }
  })

  it("refuses a swept lobby (lobby-closed) (AC-5)", () => {
    const g = matchmadeLobby()
    g.guestUserId = "lobby-closed"
    expect(conversionVerdict(g, "owner", T_ELIGIBLE, MAX_AGE_MS)).toEqual({ kind: "unavailable", reason: "closed" })
  })

  it("refuses a CPU seat, or a status other than lobby with no guest", () => {
    const cpu = matchmadeLobby()
    cpu.state.isAI.P2 = true
    const running = matchmadeLobby()
    running.state.status = "auction"
    for (const g of [cpu, running]) {
      expect(conversionVerdict(g, "owner", T_ELIGIBLE, MAX_AGE_MS)).toEqual({ kind: "unavailable", reason: "not_lobby" })
    }
  })

  it("refuses a game without a positive pvp stake: no econ, cpu econ, or amount 0", () => {
    const none = matchmadeLobby()
    delete none.state.econ
    const cpu = matchmadeLobby()
    cpu.state.econ = { mode: "cpu", amount: 50, cpuReward: 90, settled: false }
    const free = matchmadeLobby()
    free.state.econ = { mode: "pvp", amount: 0, settled: false }
    for (const g of [none, cpu, free]) {
      expect(conversionVerdict(g, "owner", T_ELIGIBLE, MAX_AGE_MS)).toEqual({ kind: "unavailable", reason: "not_pvp" })
    }
  })

  it("leaves a lobby at or past maxAgeMs to the sweep (Q-15)", () => {
    const g = matchmadeLobby()
    expect(conversionVerdict(g, "owner", T0 + MAX_AGE_MS, MAX_AGE_MS)).toEqual({ kind: "unavailable", reason: "expired" })
    expect(conversionVerdict(g, "owner", T0 + MAX_AGE_MS - 1, MAX_AGE_MS)).toEqual({ kind: "eligible", ageMs: MAX_AGE_MS - 1 })
  })
})

describe("applyConversion", () => {
  it("commits every field in one call (AC-1, AC-21)", () => {
    h.decide = decline
    const now = T_ELIGIBLE + 2_000
    vi.setSystemTime(now)
    const g = matchmadeLobby()

    expect(applyConversion(g, { userId: "owner", name: PERSONA, now, maxAgeMs: MAX_AGE_MS })).toEqual({ kind: "converted" })

    expect(g.guestUserId).toBe(BOT_SEAT)
    expect(g.guestUserId).not.toMatch(UUID_RE)
    expect(g.ownerUserId).toBe("owner")
    expect(g.rev).toBe(1) // the store bumps rev, never the mutator
    expect(g.state.status).toBe("auction")
    expect(g.state.lot).not.toBeNull()
    expect(g.state.lotDeadline).toBe(now + DEFAULT_CONFIG.auctionTimerSeconds * 1000)
    expect(g.state.isAI).toEqual({ P1: false, P2: true })
    expect(BOT_DIFFICULTY).toBe("medium")
    expect(g.state.config.difficulty).toBe(BOT_DIFFICULTY) // despite the lobby's "hard"
    expect(g.state.config.aiPersonality).toBe(bestPersonalityForDifficulty(BOT_DIFFICULTY))
    expect(g.state.config.aiPersonality).toBe("superstar")
    expect(g.state.econ).toEqual({ mode: "pvp", amount: 25, settled: true })
    expect(g.state.seatNames).toEqual({ P1: "realowner", P2: PERSONA })
    expect(g.state.matchmadeLobby).toEqual({ openedAt: T0 })
    expect(g.state.botMatch).toEqual({
      convertedAt: now,
      waitedMs: BOT_FALLBACK_WAIT_MS + 2_000,
      refund: "pending",
      shownConfig: { difficulty: "hard", aiPersonality: "aggressive" },
      pending: null, // declining on an unclaimed lot while the human decides: stands pat
      lastKey: null,
    })
  })

  const cases: Array<[string, () => StoredGame, string, number, ConversionOutcome]> = [
    ["not_owner on an open lobby", matchmadeLobby, "intruder", T_ELIGIBLE, { kind: "not_owner" }],
    ["not_owner on a converted record", () => convertedMatch(), "intruder", T_ELIGIBLE, { kind: "not_owner" }],
    ["not_owner on a seated record", seatedMatch, "intruder", T_ELIGIBLE, { kind: "not_owner" }],
    ["already", () => convertedMatch(), "owner", T_ELIGIBLE, { kind: "already" }],
    ["seated", seatedMatch, "owner", T_ELIGIBLE, { kind: "seated" }],
    ["not_yet", matchmadeLobby, "owner", T_ELIGIBLE - 1, { kind: "not_yet", retryAfterMs: 1 }],
    ["not_public", () => { const g = matchmadeLobby(); delete g.state.matchmadeLobby; return g }, "owner", T_ELIGIBLE, { kind: "unavailable", reason: "not_public" }],
    ["closed", () => { const g = matchmadeLobby(); g.guestUserId = "lobby-closed"; return g }, "owner", T_ELIGIBLE, { kind: "unavailable", reason: "closed" }],
    ["not_lobby (CPU seat)", () => { const g = matchmadeLobby(); g.state.isAI.P2 = true; return g }, "owner", T_ELIGIBLE, { kind: "unavailable", reason: "not_lobby" }],
    ["not_lobby (auction, no guest)", () => { const g = matchmadeLobby(); g.state.status = "auction"; return g }, "owner", T_ELIGIBLE, { kind: "unavailable", reason: "not_lobby" }],
    ["not_pvp (no econ)", () => { const g = matchmadeLobby(); delete g.state.econ; return g }, "owner", T_ELIGIBLE, { kind: "unavailable", reason: "not_pvp" }],
    ["not_pvp (cpu econ)", () => { const g = matchmadeLobby(); g.state.econ = { mode: "cpu", amount: 50, settled: false }; return g }, "owner", T_ELIGIBLE, { kind: "unavailable", reason: "not_pvp" }],
    ["not_pvp (amount 0)", () => { const g = matchmadeLobby(); g.state.econ = { mode: "pvp", amount: 0, settled: false }; return g }, "owner", T_ELIGIBLE, { kind: "unavailable", reason: "not_pvp" }],
    ["expired", matchmadeLobby, "owner", T0 + MAX_AGE_MS, { kind: "unavailable", reason: "expired" }],
  ]

  it.each(cases)("%s leaves JSON.stringify(g) byte-identical (AC-3, finding 1)", (_label, make, userId, now, expected) => {
    const g = make()
    vi.setSystemTime(now)
    const before = JSON.stringify(g)
    expect(applyConversion(g, { userId, name: PERSONA, now, maxAgeMs: MAX_AGE_MS })).toEqual(expected)
    expect(JSON.stringify(g)).toBe(before)
  })

  it("a second call returns already and changes nothing (INV-R3, AC-12)", () => {
    const g = convertedMatch()
    const before = JSON.stringify(g)
    expect(applyConversion(g, { userId: "owner", name: "otherhandle", now: T_ELIGIBLE + 5_000, maxAgeMs: MAX_AGE_MS })).toEqual({ kind: "already" })
    expect(JSON.stringify(g)).toBe(before)
    expect(g.state.seatNames?.P2).toBe(PERSONA)
  })

  it("with a forced bid, the lot-1 move lands in [now+700, now+2200] and before lotDeadline − 750 (AC-24)", () => {
    for (const r of [0, 0.37, 1]) {
      const g = convertedMatch(bidMin, () => r)
      const s = g.state
      const p = s.botMatch!.pending!
      expect(p.kind).toBe("bid")
      expect(p.dueAt).toBe(T_ELIGIBLE + BOT_THINK_MIN_MS + Math.round(r * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS)))
      expect(p.dueAt).toBeLessThan(s.lotDeadline! - BOT_DEADLINE_MARGIN_MS)
      expect(s.history).toHaveLength(0) // nothing lands at conversion

      expect(runDueBotTurn(s, p.dueAt - 1)).toBe(false)
      h.decide = bidMin
      vi.setSystemTime(p.dueAt)
      expect(runDueBotTurn(s, p.dueAt)).toBe(true)
      const [bid] = p2Bids(s)
      expect(bid.ts).toBe(p.dueAt)
      expect(bid.ts - s.botMatch!.convertedAt).toBeGreaterThanOrEqual(BOT_THINK_MIN_MS)
      expect(bid.ts - s.botMatch!.convertedAt).toBeLessThanOrEqual(BOT_THINK_MAX_MS)
      h.decide = null
    }
  })
})

describe("planBotTurn", () => {
  const now = T_ELIGIBLE + 100

  it("plans a bid with rand 0 → +700 and rand 1 → +2200 (AC-22)", () => {
    const s = convertedMatch().state
    h.decide = bidMin
    planBotTurn(s, now, () => 0)
    expect(s.botMatch!.pending).toEqual({ dueAt: now + 700, key: lotKey(s), kind: "bid" })
    s.botMatch!.pending = null
    planBotTurn(s, now, () => 1)
    expect(s.botMatch!.pending).toEqual({ dueAt: now + 2_200, key: lotKey(s), kind: "bid" })
  })

  it("clamps to lotDeadline − 751 when the deadline is near, and plans nothing when that is earlier than now + 700", () => {
    const s = convertedMatch().state
    h.decide = bidMin
    s.lotDeadline = now + 2_000
    planBotTurn(s, now, () => 1)
    expect(s.botMatch!.pending!.dueAt).toBe(s.lotDeadline - 751)

    s.botMatch!.pending = null
    s.lotDeadline = now + 1_451 // lotDeadline − 751 is exactly now + 700
    planBotTurn(s, now, () => 1)
    expect(s.botMatch!.pending!.dueAt).toBe(now + 700)

    s.botMatch!.pending = null
    s.lotDeadline = now + 1_400 // lotDeadline − 751 = now + 649
    planBotTurn(s, now, () => 0)
    expect(s.botMatch!.pending).toBeNull()
  })

  it("plans a pass when declining while the human leads (Q-7, D-13)", () => {
    const s = convertedMatch().state
    placeBid(s, "P1", minRaise(s, "P1")!)
    h.decide = decline
    planBotTurn(s, now, () => 0)
    expect(s.botMatch!.pending).toEqual({ dueAt: now + 700, key: lotKey(s), kind: "pass" })
  })

  it("plans a pass when declining after the human has passed (Q-7, D-13)", () => {
    const s = convertedMatch().state
    pass(s, "P1")
    expect(s.lot).not.toBeNull() // P2 hasn't passed, so the lot is still open
    h.decide = decline
    planBotTurn(s, now, () => 0)
    expect(s.botMatch!.pending).toMatchObject({ kind: "pass", key: lotKey(s) })
  })

  it("plans a pass when declining once the human's roster is full (Q-7, D-13)", () => {
    const s = convertedMatch().state
    fillRoster(s, "P1")
    h.decide = decline
    planBotTurn(s, now, () => 0)
    expect(s.botMatch!.pending).toMatchObject({ kind: "pass", key: lotKey(s) })
  })

  it("stands pat on an unclaimed lot while the human is deciding", () => {
    const s = convertedMatch().state
    s.botMatch!.pending = { dueAt: 1, key: "stale", kind: "bid" }
    h.decide = decline
    planBotTurn(s, now, () => 0)
    expect(s.botMatch!.pending).toBeNull()
    expect(s.lot!.highBidder).toBeNull()
  })

  const nothing: Array<[string, (s: ArenaState) => void]> = [
    ["P2 leads", (s) => { placeBid(s, "P2", minRaise(s, "P2")!) }],
    ["P2 has passed", (s) => { pass(s, "P2") }],
    ["the status is not auction", (s) => { s.status = "lineup" }],
    ["there is no lot", (s) => { s.lot = null }],
    ["the deadline is null", (s) => { s.lotDeadline = null }],
    ["P2's roster is full", (s) => fillRoster(s, "P2")],
  ]

  it.each(nothing)("plans nothing (and clears a stale move) when %s", (_label, setup) => {
    const s = convertedMatch().state
    setup(s)
    s.botMatch!.pending = { dueAt: 1, key: "stale", kind: "bid" }
    h.decide = bidMin
    planBotTurn(s, now, () => 0)
    expect(s.botMatch!.pending).toBeNull()
  })

  it("keeps the existing move for the same lot state: a second call doesn't move dueAt (AC-23)", () => {
    const s = convertedMatch().state
    h.decide = bidMin
    planBotTurn(s, now, () => 0)
    const first = { ...s.botMatch!.pending! }
    planBotTurn(s, now + 500, () => 1)
    planBotTurn(s, now + 600, () => 0.5)
    expect(s.botMatch!.pending).toEqual(first)
  })

  it("plans nothing while lotKey equals lastKey, and plans again once a human bid changes the key (INV-R6)", () => {
    const s = convertedMatch().state
    h.decide = bidMin
    s.botMatch!.lastKey = lotKey(s)
    planBotTurn(s, now, () => 0)
    expect(s.botMatch!.pending).toBeNull()

    placeBid(s, "P1", minRaise(s, "P1")!)
    expect(lotKey(s)).not.toBe(s.botMatch!.lastKey)
    planBotTurn(s, now, () => 0)
    expect(s.botMatch!.pending).toEqual({ dueAt: now + 700, key: lotKey(s), kind: "bid" })
  })
})

describe("runDueBotTurn", () => {
  const now = T_ELIGIBLE

  it("is false and changes nothing before the move is due, or with no move", () => {
    const s = convertedMatch(bidMin, () => 0).state
    const before = JSON.stringify(s)
    expect(runDueBotTurn(s, s.botMatch!.pending!.dueAt - 1)).toBe(false)
    expect(JSON.stringify(s)).toBe(before)

    s.botMatch!.pending = null
    const idle = JSON.stringify(s)
    expect(runDueBotTurn(s, now + 60_000)).toBe(false)
    expect(JSON.stringify(s)).toBe(idle)
  })

  it("lands a due bid through decideAI → placeBid at the decided amount (AC-21)", () => {
    const s = convertedMatch(bidMin, () => 0).state
    const p = { ...s.botMatch!.pending! }
    s.lotDeadline = p.dueAt + BOT_DEADLINE_MARGIN_MS + 1 // just inside the margin: still lands
    let decided = 0
    let difficulty = ""
    h.decide = (st) => {
      decided = st.lot!.currentBid
      difficulty = st.config.difficulty
      return { action: "bid", amount: decided }
    }
    vi.mocked(decideAI).mockClear()
    vi.setSystemTime(p.dueAt)

    expect(runDueBotTurn(s, p.dueAt)).toBe(true)

    expect(vi.mocked(decideAI)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(decideAI).mock.calls[0][0]).toBe(s)
    expect(vi.mocked(decideAI).mock.calls[0][1]).toBe("P2")
    expect(difficulty).toBe("medium")
    expect(s.lot!.highBidder).toBe("P2")
    expect(s.lot!.currentBid).toBe(decided)
    expect(s.history.at(-1)).toMatchObject({ bidder: "P2", amount: decided, ts: p.dueAt })
    expect(s.botMatch).toMatchObject({ pending: null, lastKey: p.key })
  })

  it("lands a due pass through pass(), which resolves the lot to the leading human", () => {
    const s = convertedMatch().state
    const player = s.lot!.player.id
    placeBid(s, "P1", minRaise(s, "P1")!)
    h.decide = decline
    planBotTurn(s, now, () => 0)
    const p = { ...s.botMatch!.pending! }
    expect(p.kind).toBe("pass")
    vi.mocked(decideAI).mockClear()
    vi.setSystemTime(p.dueAt)

    expect(runDueBotTurn(s, p.dueAt)).toBe(true)

    expect(vi.mocked(decideAI)).not.toHaveBeenCalled() // a planned pass is applied as is
    expect(s.results.at(-1)).toMatchObject({ playerId: player, winner: "P1" })
    expect(p2Bids(s)).toHaveLength(0)
    expect(s.botMatch!.lastKey).toBe(p.key)
  })

  const spoilers: Array<[string, (s: ArenaState, dueAt: number) => void]> = [
    ["a stale key (the human bid first)", (s) => { placeBid(s, "P1", minRaise(s, "P1")!) }],
    ["a too-late move (at lotDeadline − 750)", (s, dueAt) => { s.lotDeadline = dueAt + BOT_DEADLINE_MARGIN_MS }],
    ["a non-auction status", (s) => { s.status = "lineup" }],
    ["a lot that is gone", (s) => { s.lot = null }],
  ]

  it.each(spoilers)("%s is consumed and dropped: lastKey set, no bid placed (AC-22, INV-R6)", (_label, spoil) => {
    const s = convertedMatch(bidMin, () => 0).state
    const p = { ...s.botMatch!.pending! }
    spoil(s, p.dueAt)
    h.decide = bidMin
    vi.setSystemTime(p.dueAt)

    expect(runDueBotTurn(s, p.dueAt)).toBe(true)

    expect(s.botMatch).toMatchObject({ pending: null, lastKey: p.key })
    expect(p2Bids(s)).toHaveLength(0)
  })

  it("a bid placeBid refuses is still consumed, and planBotTurn then plans nothing on the unchanged state (finding 7)", () => {
    const s = convertedMatch().state
    h.decide = () => ({ action: "bid", amount: 999 }) // over budget: placeBid refuses it
    planBotTurn(s, now, () => 0)
    const p = { ...s.botMatch!.pending! }
    expect(p.kind).toBe("bid")
    const engine = () => JSON.stringify({ ...s, botMatch: null })
    const before = engine()
    vi.setSystemTime(p.dueAt)

    expect(runDueBotTurn(s, p.dueAt)).toBe(true)

    expect(engine()).toBe(before)
    expect(s.botMatch).toMatchObject({ pending: null, lastKey: p.key })
    planBotTurn(s, p.dueAt, () => 0)
    expect(s.botMatch!.pending).toBeNull()
  })
})

describe("lotKey", () => {
  it("changes on a bid, a pass, a resolution and a re-offer", () => {
    const s = convertedMatch().state
    const keys = [lotKey(s)]
    pass(s, "P1")
    keys.push(lotKey(s))
    placeBid(s, "P2", minRaise(s, "P2")!)
    keys.push(lotKey(s))
    placeBid(s, "P1", minRaise(s, "P1")!)
    keys.push(lotKey(s))
    resolveLot(s) // sold to P1, next lot opens
    expect(s.results).toHaveLength(1)
    keys.push(lotKey(s))

    // Re-offer: the only queued player passes out and comes straight back.
    const again = s.lot!.player.id
    s.queue = [again]
    resolveLot(s)
    expect(s.lot!.player.id).toBe(again)
    expect(s.reoffers?.[again]).toBe(1)
    keys.push(lotKey(s))

    for (let i = 1; i < keys.length; i++) expect(keys[i]).not.toBe(keys[i - 1])
  })

  it("never repeats across a long sequence of transitions", () => {
    const s = convertedMatch().state
    const rng = mulberry32(99)
    const keys = [lotKey(s)]
    for (let i = 0; i < 600 && s.status === "auction" && s.lot; i++) {
      const before = JSON.stringify(s)
      const action = rng()
      const team: TeamId = rng() < 0.5 ? "P1" : "P2"
      if (action < 0.45) {
        const amount = minRaise(s, team)
        if (amount !== null) placeBid(s, team, amount)
      } else if (action < 0.75) {
        pass(s, team)
      } else {
        resolveLot(s)
      }
      if (s.status !== "auction" || !s.lot) break
      if (JSON.stringify(s) !== before) keys.push(lotKey(s))
    }
    expect(keys.length).toBeGreaterThan(20)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
