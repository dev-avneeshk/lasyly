import { describe, it, expect } from "vitest"
import { STAKE_PRESETS, stakePayout } from "@/lib/economy/arena"
import {
  createRequest,
  matchmakeRequest,
  joinRequest,
  parseArenaError,
  parseHeldLobby,
  stakeOptionState,
  stakeTerms,
  INSUFFICIENT_FUNDS_MESSAGE,
  pairRequest,
  pairDelayMs,
  shouldRequestPair,
  parsePairResponse,
  newPairPlan,
  nextPairPlan,
  unparkPairPlan,
  seatLabel,
  matchedLine,
  shouldAnnounceMatch,
  coinChipText,
  friendlyCoinNote,
  PAIR_MAX_ATTEMPTS,
  PAIR_REQUEST_TIMEOUT_MS,
  PAIR_BACKOFF_MAX_MS,
  PAIR_RETRY_JITTER_MS,
  PAIR_PARK_PROBE_MS,
  MATCHED_BANNER_MS,
  type PairPlan,
  type PairStep,
} from "@/lib/arena/clientRequests"
import { BOT_FALLBACK_JITTER_MS, BOT_FALLBACK_WAIT_MS } from "@/lib/arena/fallbackTiming"
import type { ArenaViewEcon } from "@/lib/arena/types"

const base = { season: "2025-26", budget: 25, difficulty: "medium" } as const

describe("request bodies sent by useArenaServer", () => {
  it("create (human) carries the chosen stake", () => {
    const r = createRequest({ ...base, mode: "human", stake: 100 })
    expect(r.url).toBe("/api/arena")
    expect(r.body).toEqual({ ...base, mode: "human", stake: 100 })
  })

  it("create (ai) never sends a stake", () => {
    const r = createRequest({ ...base, mode: "ai", stake: 100 })
    expect(r.body).not.toHaveProperty("stake")
    expect(r.body.mode).toBe("ai")
  })

  it("matchmake carries the stake", () => {
    const r = matchmakeRequest({ ...base, stake: 25 })
    expect(r.url).toBe("/api/arena/matchmake")
    expect(r.body).toEqual({ ...base, stake: 25 })
  })

  it("join encodes the game id and sends no stake", () => {
    const r = joinRequest("a/b c")
    expect(r.url).toBe("/api/arena/a%2Fb%20c/join")
    expect(r.body).toEqual({})
  })
})

describe("parseArenaError", () => {
  it("402 with a server message keeps it and flags INSUFFICIENT_FUNDS", () => {
    expect(parseArenaError(402, { error: "Not enough coins. You need 250 to play.", code: "INSUFFICIENT_FUNDS" }, "x")).toEqual({
      message: "Not enough coins. You need 250 to play.",
      code: "INSUFFICIENT_FUNDS",
    })
  })

  it("402 without a body falls back to the coins message", () => {
    expect(parseArenaError(402, {}, "Failed to create game.")).toEqual({ message: INSUFFICIENT_FUNDS_MESSAGE, code: "INSUFFICIENT_FUNDS" })
  })

  it("409 surfaces the server message with no code", () => {
    expect(parseArenaError(409, { error: "You're already waiting in a 25-coin match." }, "x")).toEqual({
      message: "You're already waiting in a 25-coin match.",
      code: null,
    })
  })

  it("500 with no body uses the fallback", () => {
    expect(parseArenaError(500, null, "Failed to find a match.")).toEqual({ message: "Failed to find a match.", code: null })
  })
})

describe("stakeOptionState", () => {
  it("balance equal to stake is affordable", () => {
    expect(stakeOptionState(25, 25)).toEqual({ affordable: true, shortBy: 0 })
  })
  it("one coin short is not", () => {
    expect(stakeOptionState(25, 24)).toEqual({ affordable: false, shortBy: 1 })
  })
  it("unknown balance is affordable (server enforces)", () => {
    expect(stakeOptionState(250, null)).toEqual({ affordable: true, shortBy: 0 })
  })
})

describe("stakeTerms (payout/commission copy)", () => {
  it("stake 5 pays 10 with no commission (rounding)", () => {
    expect(stakeTerms(5)).toEqual({ payout: 10, commission: 0 })
  })
  it("stake 25 shows the actual 2-coin cut, not 10%", () => {
    expect(stakeTerms(25)).toEqual({ payout: 48, commission: 2 })
  })
  it("stake 100 pays 190 with a 10-coin cut", () => {
    expect(stakeTerms(100)).toEqual({ payout: 190, commission: 10 })
  })
  it("matches stakePayout and conserves the pot for every preset", () => {
    for (const s of STAKE_PRESETS) {
      const t = stakeTerms(s)
      expect(t.payout).toBe(stakePayout(s))
      expect(t.payout + t.commission).toBe(2 * s)
    }
  })
})

describe("parseHeldLobby", () => {
  it("reads gameId and stake from a matchmake 409", () => {
    expect(parseHeldLobby(409, { error: "You're already waiting in a 25-coin match.", gameId: "g1", stake: 25 })).toEqual({ gameId: "g1", stake: 25 })
  })
  it("a 409 without a lobby (concurrent matchmake) offers no resume", () => {
    expect(parseHeldLobby(409, { error: "You're already looking for a match." })).toBeNull()
  })
  it("ignores other statuses and malformed bodies", () => {
    expect(parseHeldLobby(402, { gameId: "g1", stake: 25 })).toBeNull()
    expect(parseHeldLobby(409, { gameId: "g1", stake: "25" })).toBeNull()
    expect(parseHeldLobby(409, { gameId: "", stake: 25 })).toBeNull()
    expect(parseHeldLobby(409, null)).toBeNull()
  })
})

// ─── Global-match pairing ────────────────────────────────────────────────────

const NOW = 1_000_000
const zero = () => 0

const plan0 = (over: Partial<PairPlan> = {}): PairPlan => ({ gameId: "g1", fireAt: NOW, attempts: 0, parked: false, done: false, ...over })

/** One attempt as the hook runs it: parse with the plan's own attempt count, then step the plan. */
function attempt(plan: PairPlan, status: number | null, body: unknown = null, retryAfterMs: number | null = null): PairPlan {
  return nextPairPlan(plan, parsePairResponse(status, body, retryAfterMs, plan.attempts), NOW, zero)
}

const counted = (afterMs: number): PairStep => ({ kind: "retry", afterMs, countsAttempt: true })
const uncounted = (afterMs: number): PairStep => ({ kind: "retry", afterMs, countsAttempt: false })

describe("pairRequest", () => {
  it("encodes the game id and sends an empty body, so api() POSTs", () => {
    const r = pairRequest("a/b c")
    expect(r.url).toBe("/api/arena/a%2Fb%20c/pair")
    expect(r.body).toEqual({})
  })
})

describe("pairDelayMs", () => {
  it("is the server threshold plus [0, 3000) ms of jitter", () => {
    expect(pairDelayMs(() => 0)).toBe(15_000)
    expect(pairDelayMs(() => 0.9999)).toBe(17_999)
  })

  it("always lands on a whole ms within [15 000, 18 000)", () => {
    for (let i = 0; i < 1000; i++) {
      const ms = pairDelayMs()
      expect(Number.isInteger(ms)).toBe(true)
      expect(ms).toBeGreaterThanOrEqual(15_000)
      expect(ms).toBeLessThan(18_000)
    }
  })
})

describe("shouldRequestPair", () => {
  it("is true for the owner's public lobby", () => {
    expect(shouldRequestPair({ publicLobby: true, status: "lobby", viewer: "P1" })).toBe(true)
  })

  it.each([
    ["a private (invite) lobby", { publicLobby: false, status: "lobby", viewer: "P1" }],
    ["a matchmake joiner", { publicLobby: true, status: "lobby", viewer: "P2" }],
    ["a live auction", { publicLobby: true, status: "auction", viewer: "P1" }],
    ["lineup", { publicLobby: true, status: "lineup", viewer: "P1" }],
    ["no view yet", { publicLobby: true, status: undefined, viewer: undefined }],
  ] as const)("is false for %s", (_label, args) => {
    expect(shouldRequestPair(args)).toBe(false)
  })
})

describe("parsePairResponse (D-26 table)", () => {
  const view = { gameId: "g1", rev: 2, status: "auction", viewer: "P1" }

  it("apply: a 200 that carries a gameId", () => {
    expect(parsePairResponse(200, view, null, 0)).toEqual({ kind: "apply", view })
    expect(parsePairResponse(200, view, null, 7)).toEqual({ kind: "apply", view })
  })

  it.each([
    ["{}", {}],
    ['gameId ""', { gameId: "" }],
    ["a non-string gameId", { gameId: 7 }],
    ["no body", null],
  ])("counted retry, 1000 × 2^attempts: a 200 with %s", (_label, body) => {
    expect(parsePairResponse(200, body, null, 0)).toEqual(counted(1000))
    expect(parsePairResponse(200, body, null, 2)).toEqual(counted(4000))
  })

  it("stop with the server's error: 404", () => {
    expect(parsePairResponse(404, { error: "Game not found." }, null, 0)).toEqual({ kind: "stop", error: "Game not found." })
    expect(parsePairResponse(404, { error: "That game has ended." }, null, 3)).toEqual({ kind: "stop", error: "That game has ended." })
  })

  it.each([[{}], [{ error: "" }], [{ error: 42 }], [null]])("stop with 'Game not found.': a 404 with %j", (body) => {
    expect(parsePairResponse(404, body, null, 0)).toEqual({ kind: "stop", error: "Game not found." })
  })

  it("stop, no error: 409 UNAVAILABLE", () => {
    expect(parsePairResponse(409, { error: "This search can't be paired.", code: "UNAVAILABLE" }, null, 0)).toEqual({ kind: "stop" })
    expect(parsePairResponse(409, { code: "UNAVAILABLE" }, 2000, 5)).toEqual({ kind: "stop" })
  })

  it.each([
    [3200, 3200],
    [10, 250],
    [250, 250],
    [15_000, 15_000],
    [99_000, 15_000],
  ])("uncounted retry: 409 NOT_YET reporting %s ms waits %s ms", (reported, expected) => {
    // The body's remainder wins over the Retry-After header (whole seconds).
    const body = { error: "Still looking for an opponent.", code: "NOT_YET", retryAfterMs: reported }
    expect(parsePairResponse(409, body, 4000, 5)).toEqual(uncounted(expected))
  })

  it.each([["x"], [NaN], [Infinity], [-Infinity], [undefined]])("uncounted retry: 409 NOT_YET reporting %s waits 1000 ms", (reported) => {
    const body = reported === undefined ? { code: "NOT_YET" } : { code: "NOT_YET", retryAfterMs: reported }
    expect(parsePairResponse(409, body, null, 0)).toEqual(uncounted(1000))
  })

  it.each([
    ["409 CONFLICT", 409, { error: "That game changed. Try again.", code: "CONFLICT" }],
    ["a 409 with no code", 409, { error: "Conflict." }],
    ["401", 401, { error: "Authentication required." }],
    ["429 without Retry-After", 429, { error: "Too many attempts. Slow down." }],
    ["500", 500, {}],
    ["502", 502, null],
    ["503 without Retry-After", 503, { error: "That game is busy right now. Retry in a moment." }],
    ["504", 504, {}],
  ])("counted retry, 1000 × 2^attempts: %s", (_label, status, body) => {
    expect(parsePairResponse(status, body, null, 0)).toEqual(counted(1000))
    expect(parsePairResponse(status, body, null, 3)).toEqual(counted(8000))
  })

  it.each([
    [0, 1000],
    [1, 2000],
    [2, 4000],
    [3, 8000],
    [4, 15_000],
    [7, 15_000],
  ])("counted retry: no response (null) at attempts %s waits %s ms", (attempts, expected) => {
    expect(parsePairResponse(null, null, null, attempts)).toEqual(counted(expected))
  })

  it("counted retry: Retry-After wins over the backoff", () => {
    expect(parsePairResponse(429, { error: "Too many attempts. Slow down." }, 3000, 0)).toEqual(counted(3000))
    expect(parsePairResponse(503, { error: "That game is busy right now. Retry in a moment." }, 2000, 6)).toEqual(counted(2000))
    expect(parsePairResponse(500, {}, null, 1)).toEqual(counted(2000))
  })

  it.each([[400], [403], [405], [413], [418]])("stop, no error: %s", (status) => {
    expect(parsePairResponse(status, { error: "Nope." }, null, 0)).toEqual({ kind: "stop" })
  })
})

describe("newPairPlan", () => {
  it("schedules the first request pairDelayMs(rand) from now, with no attempts", () => {
    expect(newPairPlan("g1", NOW, zero)).toEqual({ gameId: "g1", fireAt: NOW + 15_000, attempts: 0, parked: false, done: false })
    expect(newPairPlan("g1", NOW, () => 0.5).fireAt).toBe(NOW + pairDelayMs(() => 0.5))
  })
})

describe("nextPairPlan", () => {
  it("apply and stop end the plan", () => {
    expect(nextPairPlan(plan0(), { kind: "apply", view: { gameId: "g1" } }, NOW, zero)).toEqual({ ...plan0(), done: true })
    expect(nextPairPlan(plan0(), { kind: "stop" }, NOW, zero)).toEqual({ ...plan0(), done: true })
    expect(nextPairPlan(plan0({ attempts: 3 }), { kind: "stop", error: "Game not found." }, NOW, zero)).toEqual({ ...plan0({ attempts: 3 }), done: true })
  })

  it("8 counted failures park the plan, after 1, 2, 4, 8, 15, 15, 15 s waits (rand 0)", () => {
    let plan = plan0()
    const waits: number[] = []
    for (let i = 0; i < PAIR_MAX_ATTEMPTS; i++) {
      plan = attempt(plan, null)
      if (!plan.parked) waits.push(plan.fireAt - NOW)
    }
    expect(waits).toEqual([1000, 2000, 4000, 8000, 15_000, 15_000, 15_000])
    expect(plan).toEqual({ gameId: "g1", fireAt: NOW + 15_000, attempts: PAIR_MAX_ATTEMPTS, parked: true, done: false })
  })

  it("every counted kind adds up to the same parking point", () => {
    const failures: [number | null, unknown][] = [[null, null], [401, {}], [500, {}], [409, { code: "CONFLICT" }], [200, {}], [502, null], [504, {}], [429, {}]]
    let plan = plan0()
    failures.forEach(([status, body], i) => {
      plan = attempt(plan, status, body)
      expect(plan.attempts).toBe(i + 1)
      expect(plan.parked).toBe(i + 1 === PAIR_MAX_ATTEMPTS)
    })
  })

  it("7 counted failures don't park", () => {
    let plan = plan0()
    for (let i = 0; i < PAIR_MAX_ATTEMPTS - 1; i++) plan = attempt(plan, 503)
    expect(plan).toMatchObject({ attempts: PAIR_MAX_ATTEMPTS - 1, parked: false, done: false, fireAt: NOW + 15_000 })
  })

  it("20 NOT_YETs never park and attempts stays 0", () => {
    let plan = plan0()
    for (let i = 0; i < 20; i++) {
      plan = attempt(plan, 409, { code: "NOT_YET", retryAfterMs: 1200 })
      expect(plan).toEqual({ ...plan0(), fireAt: NOW + 1200 })
    }
  })

  it("NOT_YETs between counted failures don't count", () => {
    let plan = plan0()
    for (let i = 0; i < 3; i++) plan = attempt(plan, null)
    for (let i = 0; i < 5; i++) plan = attempt(plan, 409, { code: "NOT_YET", retryAfterMs: 400 })
    expect(plan).toMatchObject({ attempts: 3, parked: false, fireAt: NOW + 400 })
    expect(attempt(plan, null).fireAt).toBe(NOW + 8000)
  })

  it("adds [0, 500) ms of jitter to every retry", () => {
    expect(nextPairPlan(plan0(), counted(1000), NOW, () => 0).fireAt).toBe(NOW + 1000)
    expect(nextPairPlan(plan0(), counted(1000), NOW, () => 0.999).fireAt).toBe(NOW + 1499)
    expect(nextPairPlan(plan0(), uncounted(250), NOW, () => 0.999).fireAt).toBe(NOW + 749)
  })

  it("returns a new plan and leaves the old one untouched", () => {
    const before = plan0()
    const snapshot = { ...before }
    expect(nextPairPlan(before, counted(1000), NOW, zero)).not.toBe(before)
    expect(nextPairPlan(before, { kind: "stop" }, NOW, zero)).not.toBe(before)
    expect(before).toEqual(snapshot)
  })
})

describe("unparkPairPlan", () => {
  const parked = (): PairPlan => plan0({ attempts: PAIR_MAX_ATTEMPTS, parked: true, fireAt: NOW - 60_000 })

  it("turns a parked plan into one probe due now", () => {
    expect(unparkPairPlan(parked(), NOW)).toEqual({ gameId: "g1", fireAt: NOW, attempts: PAIR_MAX_ATTEMPTS - 1, parked: false, done: false })
  })

  it("a counted failure on the probe parks it again, with no fresh burst", () => {
    const probe = unparkPairPlan(parked(), NOW)
    expect(attempt(probe, null)).toMatchObject({ attempts: PAIR_MAX_ATTEMPTS, parked: true, done: false })
    expect(attempt(probe, 401)).toMatchObject({ attempts: PAIR_MAX_ATTEMPTS, parked: true, done: false })
  })

  it("a NOT_YET on the probe stays unparked and uncounted", () => {
    const probe = unparkPairPlan(parked(), NOW)
    expect(attempt(probe, 409, { code: "NOT_YET", retryAfterMs: 2000 })).toEqual({ ...probe, fireAt: NOW + 2000 })
  })

  it("a 200 on the probe applies and ends the plan", () => {
    const probe = unparkPairPlan(parked(), NOW)
    const step = parsePairResponse(200, { gameId: "g1" }, null, probe.attempts)
    expect(step.kind).toBe("apply")
    expect(nextPairPlan(probe, step, NOW, zero).done).toBe(true)
  })

  it("leaves a done or unparked plan unchanged", () => {
    const done = plan0({ done: true })
    const doneAndParked = plan0({ done: true, parked: true, attempts: PAIR_MAX_ATTEMPTS })
    const live = plan0({ attempts: 3, fireAt: NOW + 5000 })
    expect(unparkPairPlan(done, NOW)).toBe(done)
    expect(unparkPairPlan(doneAndParked, NOW)).toBe(doneAndParked)
    expect(unparkPairPlan(live, NOW)).toBe(live)
  })
})

// ─── Seat labels, the matched banner and coin copy ───────────────────────────

describe("seatLabel", () => {
  const names = { P1: "realowner", P2: "  hoopsjunkie23 " }

  it("is 'You' for the viewer's own seat, whatever name it carries", () => {
    expect(seatLabel("P1", "P1", names)).toBe("You")
    expect(seatLabel("P2", "P2", names)).toBe("You")
  })

  it("shows the opponent's name, trimmed", () => {
    expect(seatLabel("P2", "P1", names)).toBe("hoopsjunkie23")
    expect(seatLabel("P1", "P2", names)).toBe("realowner")
  })

  it.each([[null], [""], ["   "]])("falls back to 'Opponent' for a name of %j", (name) => {
    expect(seatLabel("P2", "P1", { P1: "realowner", P2: name })).toBe("Opponent")
  })

  it("falls back to 'Opponent' when the view carries no names", () => {
    expect(seatLabel("P2", "P1", undefined)).toBe("Opponent")
    expect(seatLabel("P2", "P1", null)).toBe("Opponent")
    expect(seatLabel("P2", "P1", {})).toBe("Opponent")
  })
})

describe("matchedLine", () => {
  it("names the opponent", () => {
    expect(matchedLine("hoopsjunkie23")).toBe("You matched against hoopsjunkie23")
    expect(matchedLine("  hoopsjunkie23 ")).toBe("You matched against hoopsjunkie23")
  })

  it.each([[null], [undefined], [""], ["   "]])("says 'Opponent found' when no name is known (%j)", (name) => {
    expect(matchedLine(name)).toBe("Opponent found")
  })
})

describe("shouldAnnounceMatch", () => {
  const live = { announce: true, status: "auction", gameId: "g1", announcedFor: null } as const

  it("is true for a global match's first auction view", () => {
    expect(shouldAnnounceMatch(live)).toBe(true)
    expect(shouldAnnounceMatch({ ...live, announcedFor: "an-older-game" })).toBe(true)
  })

  it("is false once this gameId has been announced", () => {
    expect(shouldAnnounceMatch({ ...live, announcedFor: "g1" })).toBe(false)
  })

  it.each([
    ["an invite or a reload (announce false)", { announce: false }],
    ["announce unset", { announce: undefined }],
    ["the waiting room", { status: "lobby" }],
    ["lineup", { status: "lineup" }],
    ["complete", { status: "complete" }],
    ["no view yet", { status: undefined, gameId: undefined }],
    ["an empty gameId", { gameId: "" }],
    ["a null gameId", { gameId: null }],
  ] as const)("is false for %s", (_label, over) => {
    expect(shouldAnnounceMatch({ ...live, ...over })).toBe(false)
  })
})

describe("coinChipText", () => {
  it("shows the stake for a staked 1v1, as before", () => {
    expect(coinChipText({ mode: "pvp", amount: 25, settled: false })).toBe("25-coin stake")
    expect(coinChipText({ mode: "pvp", amount: 100, settled: true })).toBe("100-coin stake")
  })

  it("says 'Friendly match' for a friendly match, whatever its refund state", () => {
    for (const returned of [true, false, null]) expect(coinChipText({ mode: "friendly", amount: 25, returned })).toBe("Friendly match")
  })

  it.each([
    ["a cpu-mode game", { mode: "cpu", amount: 0, cpuReward: 10 }],
    ["a zero-stake pvp game", { mode: "pvp", amount: 0 }],
    ["no econ (null)", null],
    ["no econ (undefined)", undefined],
  ] as [string, ArenaViewEcon | null | undefined][])("shows nothing for %s", (_label, econ) => {
    expect(coinChipText(econ)).toBeNull()
  })
})

describe("friendlyCoinNote (D-21 copy)", () => {
  it("returned true: the stake is back", () => {
    expect(friendlyCoinNote({ mode: "friendly", amount: 25, returned: true })).toBe(
      "Friendly match: no coins changed hands. Your 25-coin stake is back in your wallet."
    )
  })

  it("returned false: the stake is on its way", () => {
    expect(friendlyCoinNote({ mode: "friendly", amount: 100, returned: false })).toBe(
      "Friendly match: no coins changed hands. Your 100-coin stake is being returned to your wallet."
    )
  })

  it("returned null: no coin claim at all", () => {
    expect(friendlyCoinNote({ mode: "friendly", amount: 25, returned: null })).toBe("Friendly match.")
  })

  it.each([
    ["a staked pvp game", { mode: "pvp", amount: 25, settled: false }],
    ["a cpu-mode game", { mode: "cpu", amount: 0, cpuReward: 10 }],
    ["no econ (null)", null],
    ["no econ (undefined)", undefined],
  ] as [string, ArenaViewEcon | null | undefined][])("is null for %s", (_label, econ) => {
    expect(friendlyCoinNote(econ)).toBeNull()
  })
})

describe("client copy never names a machine opponent", () => {
  it("no output of seatLabel, matchedLine, coinChipText, friendlyCoinNote or parsePairResponse matches cpu/ai/bot/computer", () => {
    const banned = /\b(cpu|ai|bot|computer)\b/i
    const econs: (ArenaViewEcon | null)[] = [
      { mode: "pvp", amount: 25, settled: false },
      { mode: "pvp", amount: 0 },
      { mode: "cpu", amount: 0, cpuReward: 10 },
      { mode: "friendly", amount: 25, returned: true },
      { mode: "friendly", amount: 25, returned: false },
      { mode: "friendly", amount: 25, returned: null },
      null,
    ]
    const outputs: string[] = []
    for (const name of [null, "", "  ", "hoopsjunkie23"]) {
      outputs.push(matchedLine(name))
      for (const seat of ["P1", "P2"] as const) {
        for (const viewer of ["P1", "P2"] as const) outputs.push(seatLabel(seat, viewer, { P1: name, P2: name }))
      }
    }
    for (const econ of econs) outputs.push(coinChipText(econ) ?? "", friendlyCoinNote(econ) ?? "")
    const step = parsePairResponse(404, {}, null, 0)
    if (step.kind === "stop" && step.error) outputs.push(step.error)
    expect(outputs.length).toBeGreaterThan(20)
    for (const out of outputs) expect(out).not.toMatch(banned)
  })
})

describe("pairing constants (D-26)", () => {
  it("match the locked values", () => {
    expect(PAIR_MAX_ATTEMPTS).toBe(8)
    expect(PAIR_REQUEST_TIMEOUT_MS).toBe(10_000)
    expect(PAIR_BACKOFF_MAX_MS).toBe(15_000)
    expect(PAIR_RETRY_JITTER_MS).toBe(500)
    expect(PAIR_PARK_PROBE_MS).toBe(60_000)
    expect(MATCHED_BANNER_MS).toBe(2500)
    expect(BOT_FALLBACK_WAIT_MS).toBe(15_000)
    expect(BOT_FALLBACK_JITTER_MS).toBe(3_000)
  })
})
