import { describe, it, expect } from "vitest"
import {
  computePayout,
  formatOdds,
  computeStreak,
  computeParlayStats,
} from "./computations"
import type { ParlayWithLegs } from "@/lib/types/parlay"

// Helper to create a minimal ParlayWithLegs for testing
function makeParlay(
  overrides: Partial<ParlayWithLegs> & { legs?: ParlayWithLegs["legs"] }
): ParlayWithLegs {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    status: "pending",
    visibility: "private",
    odds: null,
    stake: null,
    custom_note: null,
    combined_hit_rate: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
    legs: [
      {
        id: "leg-1",
        parlay_id: "p-1",
        player_name: "Player A",
        stat_category: "Points",
        prop_line: 20.5,
        direction: "over",
        l10_hit_rate: 70,
        leg_order: 1,
        sport: "NBA",
      },
      {
        id: "leg-2",
        parlay_id: "p-1",
        player_name: "Player B",
        stat_category: "Assists",
        prop_line: 5.5,
        direction: "under",
        l10_hit_rate: 60,
        leg_order: 2,
        sport: "NBA",
      },
    ],
    ...overrides,
  }
}

describe("computePayout", () => {
  it("computes payout for positive American odds (+150)", () => {
    // stake × (odds / 100) + stake = 100 × (150/100) + 100 = 250
    expect(computePayout(100, 150)).toBe(250)
  })

  it("computes payout for negative American odds (-200)", () => {
    // stake × (100 / |odds|) + stake = 100 × (100/200) + 100 = 150
    expect(computePayout(100, -200)).toBe(150)
  })

  it("computes payout for decimal odds (2.5x)", () => {
    // stake × odds = 100 × 2.5 = 250
    expect(computePayout(100, 2.5)).toBe(250)
  })

  it("treats odds = 100 as positive American", () => {
    // stake × (100/100) + stake = 100 + 100 = 200
    expect(computePayout(100, 100)).toBe(200)
  })

  it("treats odds = -100 as negative American", () => {
    // stake × (100/100) + stake = 100 + 100 = 200
    expect(computePayout(100, -100)).toBe(200)
  })

  it("handles decimal odds like 1.5x", () => {
    // stake × odds = 50 × 1.5 = 75
    expect(computePayout(50, 1.5)).toBe(75)
  })
})

describe("formatOdds", () => {
  it("formats positive American odds with + prefix", () => {
    expect(formatOdds(150)).toBe("+150")
  })

  it("formats negative American odds (already has minus)", () => {
    expect(formatOdds(-200)).toBe("-200")
  })

  it("formats decimal odds with x suffix", () => {
    expect(formatOdds(2.5)).toBe("2.5x")
  })

  it("formats odds = 100 as positive American", () => {
    expect(formatOdds(100)).toBe("+100")
  })

  it("formats odds = -100 as negative American", () => {
    expect(formatOdds(-100)).toBe("-100")
  })

  it("formats small decimal like 1.1 with x suffix", () => {
    expect(formatOdds(1.1)).toBe("1.1x")
  })
})

describe("computeStreak", () => {
  it("returns zeros for empty array", () => {
    const result = computeStreak([])
    expect(result).toEqual({ best: 0, current: { count: 0, type: null } })
  })

  it("returns zeros when all parlays are pending", () => {
    const parlays = [makeParlay({ status: "pending" })]
    const result = computeStreak(parlays)
    expect(result).toEqual({ best: 0, current: { count: 0, type: null } })
  })

  it("computes best streak of consecutive wins", () => {
    const parlays = [
      makeParlay({ status: "won", resolved_at: "2024-01-01T00:00:00Z" }),
      makeParlay({ status: "won", resolved_at: "2024-01-02T00:00:00Z" }),
      makeParlay({ status: "won", resolved_at: "2024-01-03T00:00:00Z" }),
      makeParlay({ status: "lost", resolved_at: "2024-01-04T00:00:00Z" }),
      makeParlay({ status: "won", resolved_at: "2024-01-05T00:00:00Z" }),
    ]
    const result = computeStreak(parlays)
    expect(result.best).toBe(3)
  })

  it("computes current streak from most recent backwards", () => {
    const parlays = [
      makeParlay({ status: "won", resolved_at: "2024-01-01T00:00:00Z" }),
      makeParlay({ status: "lost", resolved_at: "2024-01-02T00:00:00Z" }),
      makeParlay({ status: "lost", resolved_at: "2024-01-03T00:00:00Z" }),
    ]
    const result = computeStreak(parlays)
    expect(result.current).toEqual({ count: 2, type: "lost" })
  })

  it("handles single resolved parlay", () => {
    const parlays = [
      makeParlay({ status: "won", resolved_at: "2024-01-01T00:00:00Z" }),
    ]
    const result = computeStreak(parlays)
    expect(result.best).toBe(1)
    expect(result.current).toEqual({ count: 1, type: "won" })
  })

  it("sorts by resolved_at ascending regardless of input order", () => {
    const parlays = [
      makeParlay({ status: "lost", resolved_at: "2024-01-03T00:00:00Z" }),
      makeParlay({ status: "won", resolved_at: "2024-01-01T00:00:00Z" }),
      makeParlay({ status: "won", resolved_at: "2024-01-02T00:00:00Z" }),
    ]
    const result = computeStreak(parlays)
    // Sorted: won, won, lost → best = 2, current = 1 lost
    expect(result.best).toBe(2)
    expect(result.current).toEqual({ count: 1, type: "lost" })
  })
})

describe("computeParlayStats", () => {
  it("returns null win_rate when no resolved parlays", () => {
    const parlays = [makeParlay({ status: "pending" })]
    const stats = computeParlayStats(parlays)
    expect(stats.win_rate).toBeNull()
    expect(stats.total).toBe(1)
    expect(stats.pending).toBe(1)
  })

  it("computes win_rate correctly", () => {
    const parlays = [
      makeParlay({ status: "won", resolved_at: "2024-01-01T00:00:00Z" }),
      makeParlay({ status: "won", resolved_at: "2024-01-02T00:00:00Z" }),
      makeParlay({ status: "lost", resolved_at: "2024-01-03T00:00:00Z" }),
    ]
    const stats = computeParlayStats(parlays)
    // 2 / (2 + 1) × 100 = 66.7
    expect(stats.win_rate).toBe(66.7)
  })

  it("computes net_profit_loss for won and lost parlays", () => {
    const parlays = [
      makeParlay({
        status: "won",
        stake: 100,
        odds: 2.5,
        resolved_at: "2024-01-01T00:00:00Z",
      }),
      makeParlay({
        status: "lost",
        stake: 50,
        odds: 3.0,
        resolved_at: "2024-01-02T00:00:00Z",
      }),
    ]
    const stats = computeParlayStats(parlays)
    // Won profit: 100 × (2.5 - 1) = 150
    // Lost: 50
    // Net: 150 - 50 = 100
    expect(stats.net_profit_loss).toBe(100)
  })

  it("ignores parlays without stake or odds for net_profit_loss", () => {
    const parlays = [
      makeParlay({
        status: "won",
        stake: null,
        odds: 2.5,
        resolved_at: "2024-01-01T00:00:00Z",
      }),
      makeParlay({
        status: "lost",
        stake: 50,
        odds: null,
        resolved_at: "2024-01-02T00:00:00Z",
      }),
    ]
    const stats = computeParlayStats(parlays)
    expect(stats.net_profit_loss).toBe(0)
  })

  it("computes avg_legs correctly", () => {
    const parlays = [
      makeParlay({
        legs: [
          { id: "1", parlay_id: "p", player_name: "A", stat_category: "Pts", prop_line: 20, direction: "over", l10_hit_rate: 70, leg_order: 1, sport: "NBA" },
          { id: "2", parlay_id: "p", player_name: "B", stat_category: "Ast", prop_line: 5, direction: "under", l10_hit_rate: 60, leg_order: 2, sport: "NBA" },
        ],
      }),
      makeParlay({
        legs: [
          { id: "3", parlay_id: "p", player_name: "C", stat_category: "Reb", prop_line: 8, direction: "over", l10_hit_rate: 55, leg_order: 1, sport: "NFL" },
          { id: "4", parlay_id: "p", player_name: "D", stat_category: "Pts", prop_line: 25, direction: "over", l10_hit_rate: 65, leg_order: 2, sport: "NFL" },
          { id: "5", parlay_id: "p", player_name: "E", stat_category: "Ast", prop_line: 7, direction: "under", l10_hit_rate: 50, leg_order: 3, sport: "NFL" },
          { id: "6", parlay_id: "p", player_name: "F", stat_category: "Stl", prop_line: 2, direction: "over", l10_hit_rate: 45, leg_order: 4, sport: "NFL" },
        ],
      }),
    ]
    const stats = computeParlayStats(parlays)
    // (2 + 4) / 2 = 3.0
    expect(stats.avg_legs).toBe(3)
  })

  it("returns null avg_legs when no parlays", () => {
    const stats = computeParlayStats([])
    expect(stats.avg_legs).toBeNull()
  })

  it("computes most_common_sport", () => {
    const parlays = [
      makeParlay({
        legs: [
          { id: "1", parlay_id: "p", player_name: "A", stat_category: "Pts", prop_line: 20, direction: "over", l10_hit_rate: 70, leg_order: 1, sport: "NBA" },
          { id: "2", parlay_id: "p", player_name: "B", stat_category: "Ast", prop_line: 5, direction: "under", l10_hit_rate: 60, leg_order: 2, sport: "NBA" },
          { id: "3", parlay_id: "p", player_name: "C", stat_category: "Reb", prop_line: 8, direction: "over", l10_hit_rate: 55, leg_order: 3, sport: "NFL" },
        ],
      }),
    ]
    const stats = computeParlayStats(parlays)
    expect(stats.most_common_sport).toBe("NBA")
  })

  it("breaks most_common_sport tie using most recently resolved parlay", () => {
    const parlays = [
      makeParlay({
        status: "won",
        resolved_at: "2024-01-01T00:00:00Z",
        legs: [
          { id: "1", parlay_id: "p", player_name: "A", stat_category: "Pts", prop_line: 20, direction: "over", l10_hit_rate: 70, leg_order: 1, sport: "NBA" },
          { id: "2", parlay_id: "p", player_name: "B", stat_category: "Ast", prop_line: 5, direction: "under", l10_hit_rate: 60, leg_order: 2, sport: "NBA" },
        ],
      }),
      makeParlay({
        status: "lost",
        resolved_at: "2024-01-02T00:00:00Z",
        legs: [
          { id: "3", parlay_id: "p", player_name: "C", stat_category: "Reb", prop_line: 8, direction: "over", l10_hit_rate: 55, leg_order: 1, sport: "NFL" },
          { id: "4", parlay_id: "p", player_name: "D", stat_category: "Stl", prop_line: 2, direction: "over", l10_hit_rate: 45, leg_order: 2, sport: "NFL" },
        ],
      }),
    ]
    const stats = computeParlayStats(parlays)
    // NBA: 2 legs, NFL: 2 legs — tied. Most recently resolved is the NFL parlay.
    expect(stats.most_common_sport).toBe("NFL")
  })

  it("returns null most_common_sport when no parlays", () => {
    const stats = computeParlayStats([])
    expect(stats.most_common_sport).toBeNull()
  })

  it("computes by_leg_count buckets correctly", () => {
    const parlays = [
      makeParlay({
        status: "won",
        resolved_at: "2024-01-01T00:00:00Z",
        legs: [
          { id: "1", parlay_id: "p", player_name: "A", stat_category: "Pts", prop_line: 20, direction: "over", l10_hit_rate: 70, leg_order: 1, sport: "NBA" },
          { id: "2", parlay_id: "p", player_name: "B", stat_category: "Ast", prop_line: 5, direction: "under", l10_hit_rate: 60, leg_order: 2, sport: "NBA" },
        ],
      }),
      makeParlay({
        status: "lost",
        resolved_at: "2024-01-02T00:00:00Z",
        legs: [
          { id: "3", parlay_id: "p", player_name: "C", stat_category: "Reb", prop_line: 8, direction: "over", l10_hit_rate: 55, leg_order: 1, sport: "NBA" },
          { id: "4", parlay_id: "p", player_name: "D", stat_category: "Stl", prop_line: 2, direction: "over", l10_hit_rate: 45, leg_order: 2, sport: "NBA" },
        ],
      }),
      makeParlay({
        status: "won",
        resolved_at: "2024-01-03T00:00:00Z",
        legs: [
          { id: "5", parlay_id: "p", player_name: "E", stat_category: "Pts", prop_line: 25, direction: "over", l10_hit_rate: 65, leg_order: 1, sport: "NFL" },
          { id: "6", parlay_id: "p", player_name: "F", stat_category: "Ast", prop_line: 7, direction: "under", l10_hit_rate: 50, leg_order: 2, sport: "NFL" },
          { id: "7", parlay_id: "p", player_name: "G", stat_category: "Reb", prop_line: 10, direction: "over", l10_hit_rate: 55, leg_order: 3, sport: "NFL" },
        ],
      }),
    ]
    const stats = computeParlayStats(parlays)
    // 2-leg: 1 won, 1 lost → total 2, win_rate = 50%
    expect(stats.by_leg_count["2-leg"]).toEqual({ won: 1, total: 2, win_rate: 50 })
    // 3-leg: 1 won → total 1, win_rate = 100%
    expect(stats.by_leg_count["3-leg"]).toEqual({ won: 1, total: 1, win_rate: 100 })
    // 4+-leg: none → total 0, win_rate = null
    expect(stats.by_leg_count["4+-leg"]).toEqual({ won: 0, total: 0, win_rate: null })
  })

  it("excludes pending parlays from by_leg_count", () => {
    const parlays = [
      makeParlay({ status: "pending" }),
      makeParlay({
        status: "won",
        resolved_at: "2024-01-01T00:00:00Z",
      }),
    ]
    const stats = computeParlayStats(parlays)
    // Only the won parlay (2 legs) counts
    expect(stats.by_leg_count["2-leg"].total).toBe(1)
  })
})
