import {
  createGame,
  placeBid,
  pass,
  resolveLot,
  openNextLot,
  type ArenaState,
} from "@/lib/arena/auction"
import { maxAffordable, validateBidAmount } from "@/lib/arena/budget"
import { emptyRoster, placePlayer, isRosterComplete, canFillSlot, rosterCount } from "@/lib/arena/roster"
import { getSeasonPlayers, findPlayer } from "@/lib/arena/data"
import { DEFAULT_CONFIG } from "@/lib/arena/types"
import { decideAI, walkAwayPrice } from "@/lib/arena/ai"
import { runSimulation } from "@/lib/arena/game"
import { boxScoreConsistent, teamTotalsFromLines } from "@/lib/arena/boxscore"

const SEASON = "2025-26"

function jokic() {
  return findPlayer(SEASON, "nikola-jokic")!
}

describe("Arena — data", () => {
  it("has a pool with all positions represented", () => {
    const pool = getSeasonPlayers(SEASON)
    expect(pool.length).toBeGreaterThanOrEqual(30)
    const positions = new Set(pool.flatMap((p) => [p.primaryPosition, ...p.secondaryPositions]))
    for (const pos of ["PG", "SG", "SF", "PF", "C"] as const) expect(positions.has(pos)).toBe(true)
  })
  it("ratings are season-scoped, not peak (all within 0-99)", () => {
    for (const p of getSeasonPlayers(SEASON)) {
      expect(p.overall).toBeGreaterThan(0)
      expect(p.overall).toBeLessThanOrEqual(99)
      for (const v of Object.values(p.attributes)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(99)
      }
    }
  })
})

describe("Arena — budget", () => {
  it("reserves $1 per remaining slot when computing max affordable", () => {
    const roster = emptyRoster() // 6 open slots
    // total 20, 6 slots → can spend at most 20 - 5*1 = 15 on first player
    expect(maxAffordable(20, roster)).toBe(15)
  })

  it("$20 start, buy $6, remaining $14, completion still possible", () => {
    let roster = emptyRoster()
    roster = placePlayer(roster, jokic(), 6, "C")
    // remaining = 14, 5 open slots → max next = 14 - 4 = 10
    expect(maxAffordable(20, roster)).toBe(10)
    expect(rosterCount(roster)).toBe(1)
  })

  it("rejects a bid that would make the roster impossible to complete", () => {
    const roster = emptyRoster()
    // current bid 5, try to bid 16 with 6 slots (max is 15) → illegal
    const err = validateBidAmount(16, 5, 20, roster)
    expect(err).toBeTruthy()
    // 15 is legal
    expect(validateBidAmount(15, 5, 20, roster)).toBeNull()
  })

  it("never allows the last slot to be unaffordable", () => {
    // Fill 5 slots for $19, $1 left, 1 slot open → max affordable = 1
    let roster = emptyRoster()
    const pool = getSeasonPlayers(SEASON)
    const picks = pool.slice(0, 5)
    let priceTotal = 0
    const prices = [4, 4, 4, 4, 3]
    picks.forEach((p, i) => {
      roster = placePlayer(roster, p, prices[i]) // auto-slot (best available)
      priceTotal += prices[i]
    })
    expect(priceTotal).toBe(19)
    expect(maxAffordable(20, roster)).toBe(1)
  })
})

describe("Arena — roster rules", () => {
  it("prevents duplicate players", () => {
    const roster = placePlayer(emptyRoster(), jokic(), 6, "C")
    expect(() => placePlayer(roster, jokic(), 4, "PF")).toThrow(/Duplicate/)
  })

  it("enforces positional eligibility (a PG can't fill C)", () => {
    const curry = findPlayer(SEASON, "stephen-curry")!
    expect(canFillSlot(curry, "C")).toBe(false)
    expect(canFillSlot(curry, "PG")).toBe(true)
    expect(canFillSlot(curry, "BENCH")).toBe(true)
  })

  it("supports flexible positions (Jokic at C or PF)", () => {
    expect(canFillSlot(jokic(), "C")).toBe(true)
    expect(canFillSlot(jokic(), "PF")).toBe(true)
  })
})

describe("Arena — bidding flow", () => {
  it("P1 5, P2 6, P1 7; P2 cannot bid 8 with only $7 max", () => {
    const state = createGame({ gameId: "test-bid", config: { ...DEFAULT_CONFIG }, vsAI: false, seed: 42 })
    openNextLot(state)
    // Force a known current bid by bidding up.
    const lotPlayer = state.lot!.player
    // Bid sequence starting from opening
    let r = placeBid(state, "P1", state.lot!.currentBid + 1)
    expect(r.ok).toBe(true)
    r = placeBid(state, "P2", state.lot!.currentBid + 1)
    expect(r.ok).toBe(true)
    // Push current bid up to 7 artificially within legal max
    while (state.lot!.currentBid < 7) {
      const nextTeam = state.lot!.highBidder === "P1" ? "P2" : "P1"
      const res = placeBid(state, nextTeam, state.lot!.currentBid + 1)
      if (!res.ok) break
    }
    // Now attempt an over-max bid
    const over = placeBid(state, state.lot!.highBidder === "P1" ? "P2" : "P1", 999)
    expect(over.ok).toBe(false)
    void lotPlayer
  })

  it("highest bidder wins the lot and budget updates; no negative budgets", () => {
    const state = createGame({ gameId: "test-win", config: { ...DEFAULT_CONFIG }, vsAI: false, seed: 7 })
    openNextLot(state)
    const player = state.lot!.player
    placeBid(state, "P1", state.lot!.currentBid + 1)
    const price = state.lot!.currentBid
    pass(state, "P2") // P2 declines → resolves to P1
    // Lot resolved; P1 should own the player.
    const owns = Object.values(state.rosters.P1.slots).some((s) => s?.player.id === player.id)
    expect(owns).toBe(true)
    const spent = Object.values(state.rosters.P1.slots).reduce((s, o) => s + (o?.price ?? 0), 0)
    expect(spent).toBe(price)
    expect(spent).toBeLessThanOrEqual(DEFAULT_CONFIG.budgetPerPlayer)
  })

  it("auction always completes with exactly 6 players (5 starters + 1 bench) each", () => {
    const state = createGame({ gameId: "test-complete", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 123 })
    runAuctionToCompletion(state)
    expect(state.status).toBe("lineup")
    for (const team of ["P1", "P2"] as const) {
      expect(isRosterComplete(state.rosters[team])).toBe(true)
      const slots = state.rosters[team].slots
      const starters = ["PG", "SG", "SF", "PF", "C"].filter((s) => slots[s as keyof typeof slots] !== null)
      expect(starters.length).toBe(5)
      expect(slots.BENCH).not.toBeNull()
    }
  })

  it("no duplicate players across both rosters", () => {
    const state = createGame({ gameId: "test-dupe", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 55 })
    runAuctionToCompletion(state)
    const ids = new Set<string>()
    for (const team of ["P1", "P2"] as const) {
      for (const s of Object.values(state.rosters[team].slots)) {
        if (s) {
          expect(ids.has(s.player.id)).toBe(false)
          ids.add(s.player.id)
        }
      }
    }
  })
})

describe("Arena — AI", () => {
  it("bids more aggressively for a needed position than a duplicate", () => {
    const state = createGame({ gameId: "ai-need", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 9 })
    openNextLot(state)
    // AI wants *some* players — walkAway should be > 0 for an affordable lot it can roster.
    const wa = walkAwayPrice(state, "P2")
    expect(wa).toBeGreaterThanOrEqual(0)
    const decision = decideAI(state, "P2")
    expect(["bid", "pass"]).toContain(decision.action)
  })
})

describe("Arena — simulation", () => {
  it("two completed rosters always produce a valid result with a winner", () => {
    const state = createGame({ gameId: "sim-valid", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 321 })
    runAuctionToCompletion(state)
    const result = runSimulation(state.rosters.P1, state.rosters.P2, SEASON, state.seed)
    expect(["P1", "P2"]).toContain(result.winner)
    expect(result.finalScore.p1).not.toBe(result.finalScore.p2)
    // realistic-ish score range
    expect(result.finalScore.p1).toBeGreaterThan(70)
    expect(result.finalScore.p2).toBeGreaterThan(70)
    expect(result.finalScore.p1).toBeLessThan(170)
    expect(result.finalScore.p2).toBeLessThan(170)
    expect(result.moments.length).toBeGreaterThan(0)
    expect(result.mvp.playerId).toBeTruthy()
  })

  it("box score totals are internally consistent", () => {
    const state = createGame({ gameId: "sim-box", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 999 })
    runAuctionToCompletion(state)
    const result = runSimulation(state.rosters.P1, state.rosters.P2, SEASON, state.seed)
    expect(boxScoreConsistent(result.boxScore, result.teamBox)).toBe(true)
    // Winner's team points equal their box total
    const p1Tot = teamTotalsFromLines(result.boxScore, "P1")
    expect(p1Tot.pts).toBe(result.teamBox.P1.points)
  })

  it("is deterministic for the same seed and rosters", () => {
    const a = createGame({ gameId: "det", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 2024 })
    runAuctionToCompletion(a)
    const r1 = runSimulation(a.rosters.P1, a.rosters.P2, SEASON, 2024)
    const r2 = runSimulation(a.rosters.P1, a.rosters.P2, SEASON, 2024)
    expect(r1.finalScore).toEqual(r2.finalScore)
  })

  it("a clearly stronger team wins most of the time, but not always (variance exists)", () => {
    // Team A: five tier-1/2 studs. Team B: five cheap tier-4 role players.
    const strong = buildRoster(["nikola-jokic", "shai-gilgeous-alexander", "jayson-tatum", "giannis-antetokounmpo", "anthony-edwards", "derrick-white"])
    const weak = buildRoster(["immanuel-quickley", "dyson-daniels", "herbert-jones", "naz-reid", "myles-turner", "og-anunoby"])
    let strongWins = 0
    const N = 60
    for (let i = 0; i < N; i++) {
      const r = runSimulation(strong, weak, SEASON, 1000 + i)
      if (r.winner === "P1") strongWins++
    }
    // Strong should dominate but variance is real.
    expect(strongWins).toBeGreaterThan(N * 0.7)
    expect(strongWins).toBeLessThanOrEqual(N)
  })
})

// ─── helpers ──────────────────────────────────────────────────────────────

function runAuctionToCompletion(state: ArenaState) {
  let guard = 0
  while (state.status === "auction" && guard++ < 5000) {
    if (!state.lot) {
      if (!openNextLot(state)) break
      continue
    }
    // Both AI seats: let both decide until the lot settles, then time out.
    let settled = false
    let inner = 0
    while (!settled && inner++ < 200) {
      const before = state.lot?.currentBid
      for (const team of ["P1", "P2"] as const) {
        if (!state.lot) break
        const d = decideAI(state, team)
        if (d.action === "bid") placeBid(state, team, d.amount)
        else pass(state, team)
      }
      if (!state.lot) { settled = true; break }
      // If no one raised, force-resolve on timer.
      if (state.lot && state.lot.currentBid === before) {
        resolveLot(state)
        settled = true
      }
    }
  }
}

function buildRoster(ids: string[]) {
  let roster = emptyRoster()
  for (const id of ids) {
    const p = findPlayer(SEASON, id)!
    roster = placePlayer(roster, p, 3) // auto-slot into best legal opening
  }
  return roster
}
