import { describe, it, expect } from "vitest"
import {
  computeRecentForm,
  minMaxNormalize,
  computePropLine,
  computeL5Average,
  computeL10Average,
  computeProbability,
  ProbabilityInput,
} from "./probability"

describe("computeRecentForm", () => {
  it("returns proportion of games >= propLine using last 10 games", () => {
    const games = [25, 30, 20, 28, 22, 35, 18, 27, 24, 31]
    // propLine = 25, games >= 25: 25, 30, 28, 35, 27, 31 = 6/10
    expect(computeRecentForm(games, 25)).toBe(0.6)
  })

  it("uses only last 10 games when more are provided", () => {
    const games = [30, 25, 20, 15, 10, 30, 25, 20, 15, 10, 99, 99]
    // Only first 10 are used (most recent first)
    // games >= 20: 30, 25, 20, 30, 25, 20 = 6/10
    expect(computeRecentForm(games, 20)).toBe(0.6)
  })

  it("uses all games when fewer than 10", () => {
    const games = [30, 20, 25]
    // games >= 25: 30, 25 = 2/3
    expect(computeRecentForm(games, 25)).toBeCloseTo(2 / 3)
  })

  it("returns 0 for empty games array", () => {
    expect(computeRecentForm([], 25)).toBe(0)
  })

  it("returns 1 when all games meet the line", () => {
    expect(computeRecentForm([30, 35, 40], 25)).toBe(1)
  })

  it("returns 0 when no games meet the line", () => {
    expect(computeRecentForm([10, 15, 20], 25)).toBe(0)
  })
})

describe("minMaxNormalize", () => {
  it("normalizes value within range", () => {
    expect(minMaxNormalize(5, [0, 10])).toBe(0.5)
    expect(minMaxNormalize(0, [0, 10])).toBe(0)
    expect(minMaxNormalize(10, [0, 10])).toBe(1)
  })

  it("returns 0.5 when max equals min", () => {
    expect(minMaxNormalize(5, [5, 5, 5])).toBe(0.5)
  })

  it("returns 0.5 for empty allValues", () => {
    expect(minMaxNormalize(5, [])).toBe(0.5)
  })

  it("handles values outside the range by clamping", () => {
    expect(minMaxNormalize(-5, [0, 10])).toBe(0)
    expect(minMaxNormalize(15, [0, 10])).toBe(1)
  })

  it("works with multiple values in allValues", () => {
    // min=2, max=8, value=5 → (5-2)/(8-2) = 3/6 = 0.5
    expect(minMaxNormalize(5, [2, 4, 6, 8])).toBe(0.5)
  })
})

describe("computePropLine", () => {
  it("computes mean of last 10 games rounded to nearest 0.5", () => {
    // mean of [20, 22, 24, 26, 28, 30, 32, 34, 36, 38] = 29
    // rounded to nearest 0.5 = 29.0
    const games = [20, 22, 24, 26, 28, 30, 32, 34, 36, 38]
    expect(computePropLine(games)).toBe(29)
  })

  it("rounds 22.25 mean to 22.5", () => {
    // We need mean = 22.25 → Math.round(22.25 * 2) / 2 = Math.round(44.5) / 2 = 45/2 = 22.5
    const games = [22, 22, 22, 23] // mean = 89/4 = 22.25
    expect(computePropLine(games)).toBe(22.5)
  })

  it("uses only last 10 games when more provided", () => {
    const games = [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 100, 100]
    // Only first 10 used, mean = 20
    expect(computePropLine(games)).toBe(20)
  })

  it("returns 0 for empty array", () => {
    expect(computePropLine([])).toBe(0)
  })
})

describe("computeL5Average", () => {
  it("computes mean of last 5 games rounded to 1 decimal", () => {
    const games = [20, 22, 24, 26, 28]
    // mean = 120/5 = 24.0
    expect(computeL5Average(games)).toBe(24)
  })

  it("uses fewer games when less than 5 available", () => {
    const games = [20, 25, 30]
    // mean = 75/3 = 25.0
    expect(computeL5Average(games)).toBe(25)
  })

  it("rounds to 1 decimal place", () => {
    const games = [21, 22, 23, 24, 25]
    // mean = 115/5 = 23.0
    expect(computeL5Average(games)).toBe(23)
  })

  it("returns 0 for empty array", () => {
    expect(computeL5Average([])).toBe(0)
  })
})

describe("computeL10Average", () => {
  it("computes mean of last 10 games rounded to 1 decimal", () => {
    const games = [20, 22, 24, 26, 28, 30, 32, 34, 36, 38]
    // mean = 290/10 = 29.0
    expect(computeL10Average(games)).toBe(29)
  })

  it("uses fewer games when less than 10 available", () => {
    const games = [20, 25, 30, 35, 40]
    // mean = 150/5 = 30.0
    expect(computeL10Average(games)).toBe(30)
  })

  it("returns 0 for empty array", () => {
    expect(computeL10Average([])).toBe(0)
  })
})

describe("computeProbability", () => {
  it("uses full model when all factors available", () => {
    const input: ProbabilityInput = {
      recentGames: [30, 28, 32, 25, 27, 29, 31, 26, 28, 30],
      propLine: 25,
      defensiveStatAllowed: 28,
      leagueDefensiveValues: [20, 24, 28, 32, 36],
      opponentPace: 102,
      leaguePaceValues: [96, 98, 100, 102, 104],
    }

    const result = computeProbability(input)

    expect(result.factorsUsed).toBe("full")
    expect(result.recentFormFactor).toBe(1) // all 10 games >= 25
    expect(result.defensiveMatchupFactor).not.toBeNull()
    expect(result.paceAdjustmentFactor).not.toBeNull()
    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(100)
  })

  it("uses form-only when no defensive stats", () => {
    const input: ProbabilityInput = {
      recentGames: [30, 20, 30, 20, 30],
      propLine: 25,
      defensiveStatAllowed: null,
      leagueDefensiveValues: [],
      opponentPace: 100,
      leaguePaceValues: [96, 100, 104],
    }

    const result = computeProbability(input)

    expect(result.factorsUsed).toBe("form-only")
    expect(result.defensiveMatchupFactor).toBeNull()
    expect(result.paceAdjustmentFactor).toBeNull()
    // 3/5 games >= 25, so form = 0.6, probability = 60.0
    expect(result.probability).toBe(60)
  })

  it("uses no-pace fallback when pace is null but defense available", () => {
    const input: ProbabilityInput = {
      recentGames: [30, 20, 30, 20, 30],
      propLine: 25,
      defensiveStatAllowed: 28,
      leagueDefensiveValues: [20, 24, 28, 32, 36],
      opponentPace: null,
      leaguePaceValues: [],
    }

    const result = computeProbability(input)

    expect(result.factorsUsed).toBe("no-pace")
    expect(result.defensiveMatchupFactor).not.toBeNull()
    expect(result.paceAdjustmentFactor).toBeNull()
    // form = 3/5 = 0.6
    // defense = (28-20)/(36-20) = 8/16 = 0.5
    // probability = (0.6 * 0.57 + 0.5 * 0.43) * 100 = (0.342 + 0.215) * 100 = 55.7
    expect(result.probability).toBe(55.7)
  })

  it("computes full model correctly with known values", () => {
    const input: ProbabilityInput = {
      recentGames: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      propLine: 25,
      defensiveStatAllowed: 36,
      leagueDefensiveValues: [20, 24, 28, 32, 36],
      opponentPace: 104,
      leaguePaceValues: [96, 98, 100, 102, 104],
    }

    const result = computeProbability(input)

    expect(result.factorsUsed).toBe("full")
    // form = 10/10 = 1.0
    // defense = (36-20)/(36-20) = 1.0
    // pace = (104-96)/(104-96) = 1.0
    // probability = (1*0.4 + 1*0.35 + 1*0.25) * 100 = 100.0
    expect(result.recentFormFactor).toBe(1)
    expect(result.defensiveMatchupFactor).toBe(1)
    expect(result.paceAdjustmentFactor).toBe(1)
    expect(result.probability).toBe(100)
  })

  it("probability is always between 0 and 100", () => {
    const input: ProbabilityInput = {
      recentGames: [0, 0, 0, 0, 0],
      propLine: 25,
      defensiveStatAllowed: 20,
      leagueDefensiveValues: [20, 24, 28, 32, 36],
      opponentPace: 96,
      leaguePaceValues: [96, 98, 100, 102, 104],
    }

    const result = computeProbability(input)

    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(100)
  })

  it("probability rounded to 1 decimal place", () => {
    const input: ProbabilityInput = {
      recentGames: [26, 24, 26, 24, 26, 24, 26],
      propLine: 25,
      defensiveStatAllowed: 25,
      leagueDefensiveValues: [20, 25, 30],
      opponentPace: 100,
      leaguePaceValues: [95, 100, 105],
    }

    const result = computeProbability(input)

    // Check it's rounded to 1 decimal
    const decimalPlaces = (result.probability.toString().split(".")[1] || "")
      .length
    expect(decimalPlaces).toBeLessThanOrEqual(1)
  })
})
