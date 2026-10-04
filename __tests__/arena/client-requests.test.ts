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
} from "@/lib/arena/clientRequests"

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
