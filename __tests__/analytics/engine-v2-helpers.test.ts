/**
 * Unit tests for engine-v2 helper functions:
 * - buildGraphData
 * - computeDefensiveGrade
 * - computePaceRating
 */

import {
  buildGraphData,
  computeDefensiveGrade,
  computePaceRating,
  BatchPlayerGameRow,
} from "@/lib/analytics/engine-v2"

// ─── buildGraphData Tests ───────────────────────────────────────────────────

describe("buildGraphData", () => {
  const makeGame = (
    statValue: number,
    gameDate: string,
    opponent: string
  ): BatchPlayerGameRow => ({
    playerName: "Test Player",
    team: "LAL",
    opponent,
    gameDate,
    homeTeam: "LAL",
    awayTeam: opponent,
    statValue,
    minutes: 25,
    position: "PG",
  })

  it("returns empty array for empty games input", () => {
    const result = buildGraphData([], 20)
    expect(result).toEqual([])
  })

  it("returns all games in chronological order when fewer than 6 games", () => {
    // Games in most-recent-first order (as from DB)
    const games = [
      makeGame(25, "2025-01-03", "GSW"),
      makeGame(18, "2025-01-02", "BOS"),
      makeGame(30, "2025-01-01", "MIA"),
    ]

    const result = buildGraphData(games, 20)

    expect(result).toHaveLength(3)
    // Should be oldest to newest
    expect(result[0].date).toBe("2025-01-01")
    expect(result[1].date).toBe("2025-01-02")
    expect(result[2].date).toBe("2025-01-03")
  })

  it("takes only the most recent 6 games when more are available", () => {
    const games = [
      makeGame(20, "2025-01-08", "PHX"),
      makeGame(22, "2025-01-07", "DEN"),
      makeGame(18, "2025-01-06", "OKC"),
      makeGame(30, "2025-01-05", "SAS"),
      makeGame(15, "2025-01-04", "DAL"),
      makeGame(28, "2025-01-03", "HOU"),
      makeGame(12, "2025-01-02", "MEM"), // should be excluded (7th game)
      makeGame(35, "2025-01-01", "NOP"), // should be excluded (8th game)
    ]

    const result = buildGraphData(games, 20)

    expect(result).toHaveLength(6)
    // Oldest of the 6 most recent should be first
    expect(result[0].date).toBe("2025-01-03")
    // Most recent should be last
    expect(result[5].date).toBe("2025-01-08")
  })

  it("correctly computes overLine boolean", () => {
    const games = [
      makeGame(25, "2025-01-03", "GSW"), // >= 20 → true
      makeGame(20, "2025-01-02", "BOS"), // >= 20 → true (equal counts)
      makeGame(19, "2025-01-01", "MIA"), // < 20 → false
    ]

    const result = buildGraphData(games, 20)

    // Chronological order: MIA, BOS, GSW
    expect(result[0].overLine).toBe(false) // 19 < 20
    expect(result[1].overLine).toBe(true) // 20 >= 20
    expect(result[2].overLine).toBe(true) // 25 >= 20
  })

  it("includes correct opponent in each data point", () => {
    const games = [
      makeGame(25, "2025-01-02", "GSW"),
      makeGame(18, "2025-01-01", "BOS"),
    ]

    const result = buildGraphData(games, 20)

    expect(result[0].opponent).toBe("BOS")
    expect(result[1].opponent).toBe("GSW")
  })

  it("includes correct value in each data point", () => {
    const games = [
      makeGame(25, "2025-01-02", "GSW"),
      makeGame(18, "2025-01-01", "BOS"),
    ]

    const result = buildGraphData(games, 20)

    expect(result[0].value).toBe(18)
    expect(result[1].value).toBe(25)
  })
})

// ─── computeDefensiveGrade Tests ────────────────────────────────────────────

describe("computeDefensiveGrade", () => {
  it("returns A when team allows >= 15% more than league average", () => {
    // 25 / 20 = 1.25 → A
    expect(computeDefensiveGrade(25, 20)).toBe("A")
    // Exactly 15% more: 23 / 20 = 1.15 → A
    expect(computeDefensiveGrade(23, 20)).toBe("A")
  })

  it("returns B when team allows 5-15% more than league average", () => {
    // 22 / 20 = 1.10 → B
    expect(computeDefensiveGrade(22, 20)).toBe("B")
    // Exactly 5% more: 21 / 20 = 1.05 → B
    expect(computeDefensiveGrade(21, 20)).toBe("B")
  })

  it("returns C when team allows within ±5% of league average", () => {
    // 20 / 20 = 1.0 → C
    expect(computeDefensiveGrade(20, 20)).toBe("C")
    // 19 / 20 = 0.95 → C
    expect(computeDefensiveGrade(19, 20)).toBe("C")
  })

  it("returns D when team allows 5-15% less than league average", () => {
    // 18 / 20 = 0.90 → D
    expect(computeDefensiveGrade(18, 20)).toBe("D")
    // 17 / 20 = 0.85 → D
    expect(computeDefensiveGrade(17, 20)).toBe("D")
  })

  it("returns F when team allows >= 15% less than league average", () => {
    // 16 / 20 = 0.80 → F
    expect(computeDefensiveGrade(16, 20)).toBe("F")
    // 10 / 20 = 0.50 → F
    expect(computeDefensiveGrade(10, 20)).toBe("F")
  })

  it("returns C when league average is 0 (guard against division by zero)", () => {
    expect(computeDefensiveGrade(25, 0)).toBe("C")
  })
})

// ─── computePaceRating Tests ────────────────────────────────────────────────

describe("computePaceRating", () => {
  it("returns 'fast' when pace is more than 2 above league average", () => {
    expect(computePaceRating(102.5, 100)).toBe("fast")
    expect(computePaceRating(105, 100)).toBe("fast")
  })

  it("returns 'slow' when pace is more than 2 below league average", () => {
    expect(computePaceRating(97.5, 100)).toBe("slow")
    expect(computePaceRating(95, 100)).toBe("slow")
  })

  it("returns 'average' when pace is within ±2 of league average", () => {
    expect(computePaceRating(100, 100)).toBe("average")
    expect(computePaceRating(101, 100)).toBe("average")
    expect(computePaceRating(99, 100)).toBe("average")
    expect(computePaceRating(102, 100)).toBe("average")
    expect(computePaceRating(98, 100)).toBe("average")
  })

  it("returns 'average' at exactly +2 boundary", () => {
    // pace = leagueAvg + 2 → NOT > leagueAvg + 2, so "average"
    expect(computePaceRating(102, 100)).toBe("average")
  })

  it("returns 'average' at exactly -2 boundary", () => {
    // pace = leagueAvg - 2 → NOT < leagueAvg - 2, so "average"
    expect(computePaceRating(98, 100)).toBe("average")
  })

  it("returns 'fast' just above +2 boundary", () => {
    expect(computePaceRating(102.1, 100)).toBe("fast")
  })

  it("returns 'slow' just below -2 boundary", () => {
    expect(computePaceRating(97.9, 100)).toBe("slow")
  })

  it("returns 'average' when pace is null", () => {
    expect(computePaceRating(null, 100)).toBe("average")
  })
})
