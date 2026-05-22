import { describe, it, expect } from "vitest"
import {
  roundTo,
  getColorCode,
  computeEPPS,
  computeSelfCreatedFGA,
  computePGAConversionRate,
  computeProjectedRebounds,
  computeStocks,
  computeFoulsDrawn,
  computeDerivedStats,
  DerivedStatsInput,
} from "./derived-stats"

describe("roundTo", () => {
  it("rounds to 1 decimal place", () => {
    expect(roundTo(3.456, 1)).toBe(3.5)
    expect(roundTo(3.44, 1)).toBe(3.4)
  })

  it("rounds to 2 decimal places", () => {
    expect(roundTo(0.9234, 2)).toBe(0.92)
    expect(roundTo(0.925, 2)).toBe(0.93)
  })

  it("handles zero decimals", () => {
    expect(roundTo(3.7, 0)).toBe(4)
    expect(roundTo(3.4, 0)).toBe(3)
  })

  it("handles already-rounded values", () => {
    expect(roundTo(5.0, 1)).toBe(5.0)
  })
})

describe("getColorCode", () => {
  it("returns green when player exceeds league average by more than 10%", () => {
    expect(getColorCode(11.1, 10)).toBe("green")
    expect(getColorCode(20, 10)).toBe("green")
  })

  it("returns red when player is below league average by more than 10%", () => {
    expect(getColorCode(8.9, 10)).toBe("red")
    expect(getColorCode(5, 10)).toBe("red")
  })

  it("returns default when within 10% inclusive", () => {
    expect(getColorCode(11, 10)).toBe("default")
    expect(getColorCode(9, 10)).toBe("default")
    expect(getColorCode(10, 10)).toBe("default")
  })

  it("returns default when league average is 0 or negative", () => {
    expect(getColorCode(5, 0)).toBe("default")
    expect(getColorCode(5, -1)).toBe("default")
  })
})

describe("computeEPPS", () => {
  it("computes ePPS correctly", () => {
    // 18.5 / (16.2 + 0.44 * 8.1) = 18.5 / 19.764 ≈ 0.936
    const result = computeEPPS(18.5, 16.2, 8.1)
    expect(result).toBeCloseTo(0.936, 2)
  })

  it("returns 0 when denominator is 0", () => {
    expect(computeEPPS(0, 0, 0)).toBe(0)
  })

  it("handles zero FTA", () => {
    // 20 / (15 + 0) = 1.333
    expect(computeEPPS(20, 15, 0)).toBeCloseTo(1.333, 2)
  })
})

describe("computeSelfCreatedFGA", () => {
  it("computes self-created FGA correctly", () => {
    // assistedPct = (60/100 * (1 - 40/100)) + (70/100 * 40/100)
    //            = 0.6 * 0.6 + 0.7 * 0.4 = 0.36 + 0.28 = 0.64
    // selfCreated = 16 * (1 - 0.64) = 16 * 0.36 = 5.76
    const result = computeSelfCreatedFGA(16, 60, 70, 40)
    expect(result).toBeCloseTo(5.76, 2)
  })

  it("returns full FGA when no shots are assisted", () => {
    const result = computeSelfCreatedFGA(15, 0, 0, 50)
    expect(result).toBe(15)
  })

  it("returns 0 when all shots are assisted", () => {
    const result = computeSelfCreatedFGA(15, 100, 100, 50)
    expect(result).toBeCloseTo(0, 5)
  })
})

describe("computePGAConversionRate", () => {
  it("computes conversion rate correctly", () => {
    // (8 / 12) * 100 = 66.67
    expect(computePGAConversionRate(8, 12)).toBeCloseTo(66.67, 1)
  })

  it("returns null when PGA is 0", () => {
    expect(computePGAConversionRate(5, 0)).toBeNull()
  })
})

describe("computeProjectedRebounds", () => {
  it("computes projected rebounds correctly", () => {
    // (15 / 100) * 44 = 6.6
    expect(computeProjectedRebounds(15, 44)).toBeCloseTo(6.6, 1)
  })

  it("returns 0 when trbPct is 0", () => {
    expect(computeProjectedRebounds(0, 44)).toBe(0)
  })
})

describe("computeStocks", () => {
  it("computes stocks correctly", () => {
    expect(computeStocks(1.5, 0.8)).toBeCloseTo(2.3, 1)
  })

  it("handles zero values", () => {
    expect(computeStocks(0, 0)).toBe(0)
  })
})

describe("computeFoulsDrawn", () => {
  it("computes fouls drawn correctly", () => {
    // 8.1 / 1.8 = 4.5
    expect(computeFoulsDrawn(8.1)).toBeCloseTo(4.5, 1)
  })

  it("returns 0 when FTA is 0", () => {
    expect(computeFoulsDrawn(0)).toBe(0)
  })
})

describe("computeDerivedStats", () => {
  const fullInput: DerivedStatsInput = {
    fgaPerGame: 16.2,
    ftaPerGame: 8.1,
    ptsPerGame: 18.5,
    astPerGame: 8.0,
    tovPerGame: 3.5,
    stlPerGame: 1.5,
    blkPerGame: 0.8,
    fgaPct0_3ft: 30,
    fgaPctMidRange: 25,
    pct2pAssisted: 60,
    pct3pAssisted: 70,
    fgaPct3pt: 40,
    trbPct: 15,
    pgaPerGame: 12,
    teamTotalRebPerGame: 44,
  }

  it("computes all derived stats when all inputs are available", () => {
    const result = computeDerivedStats(fullInput)

    expect(result.midRangeAttemptsPerGame).not.toBeNull()
    expect(result.rimAttemptsPerGame).not.toBeNull()
    expect(result.ePPS).not.toBeNull()
    expect(result.selfCreatedFGAPerGame).not.toBeNull()
    expect(result.astTovRatio).not.toBeNull()
    expect(result.pgaConversionRate).not.toBeNull()
    expect(result.projectedReboundsPerGame).not.toBeNull()
    expect(result.stocksPerGame).not.toBeNull()
    expect(result.foulsDrawnPerGame).not.toBeNull()
  })

  it("returns correct mid-range attempts", () => {
    const result = computeDerivedStats(fullInput)
    // 16.2 * (25 / 100) = 4.05 → rounded to 4.1
    expect(result.midRangeAttemptsPerGame!.value).toBe(4.1)
  })

  it("returns correct rim attempts", () => {
    const result = computeDerivedStats(fullInput)
    // 16.2 * (30 / 100) = 4.86 → rounded to 4.9
    expect(result.rimAttemptsPerGame!.value).toBe(4.9)
  })

  it("returns correct ePPS", () => {
    const result = computeDerivedStats(fullInput)
    // 18.5 / (16.2 + 0.44 * 8.1) = 18.5 / 19.764 ≈ 0.94
    expect(result.ePPS!.value).toBe(0.94)
  })

  it("returns correct stocks", () => {
    const result = computeDerivedStats(fullInput)
    // 1.5 + 0.8 = 2.3
    expect(result.stocksPerGame!.value).toBe(2.3)
  })

  it("returns correct fouls drawn", () => {
    const result = computeDerivedStats(fullInput)
    // 8.1 / 1.8 = 4.5
    expect(result.foulsDrawnPerGame!.value).toBe(4.5)
  })

  it("returns correct AST/TOV ratio", () => {
    const result = computeDerivedStats(fullInput)
    // 8.0 / 3.5 = 2.29
    expect(result.astTovRatio!.value).toBe(2.29)
  })

  it("returns correct PGA conversion rate", () => {
    const result = computeDerivedStats(fullInput)
    // (8 / 12) * 100 = 66.7
    expect(result.pgaConversionRate!.value).toBe(66.7)
  })

  it("returns correct projected rebounds", () => {
    const result = computeDerivedStats(fullInput)
    // (15 / 100) * 44 = 6.6
    expect(result.projectedReboundsPerGame!.value).toBe(6.6)
  })

  it("returns null for mid-range when fgaPctMidRange is null", () => {
    const result = computeDerivedStats({ ...fullInput, fgaPctMidRange: null })
    expect(result.midRangeAttemptsPerGame).toBeNull()
  })

  it("returns null for rim attempts when fgaPct0_3ft is null", () => {
    const result = computeDerivedStats({ ...fullInput, fgaPct0_3ft: null })
    expect(result.rimAttemptsPerGame).toBeNull()
  })

  it("returns null for self-created FGA when pct2pAssisted is null", () => {
    const result = computeDerivedStats({ ...fullInput, pct2pAssisted: null })
    expect(result.selfCreatedFGAPerGame).toBeNull()
  })

  it("returns null for PGA conversion when pgaPerGame is null", () => {
    const result = computeDerivedStats({ ...fullInput, pgaPerGame: null })
    expect(result.pgaConversionRate).toBeNull()
  })

  it("returns null for PGA conversion when pgaPerGame is 0", () => {
    const result = computeDerivedStats({ ...fullInput, pgaPerGame: 0 })
    expect(result.pgaConversionRate).toBeNull()
  })

  it("returns null for projected rebounds when trbPct is null", () => {
    const result = computeDerivedStats({ ...fullInput, trbPct: null })
    expect(result.projectedReboundsPerGame).toBeNull()
  })

  it("returns null for projected rebounds when teamTotalRebPerGame is null", () => {
    const result = computeDerivedStats({
      ...fullInput,
      teamTotalRebPerGame: null,
    })
    expect(result.projectedReboundsPerGame).toBeNull()
  })

  it("includes formula strings with actual values", () => {
    const result = computeDerivedStats(fullInput)
    expect(result.ePPS!.formula).toContain("18.5")
    expect(result.ePPS!.formula).toContain("16.2")
    expect(result.ePPS!.formula).toContain("8.1")
    expect(result.ePPS!.formulaResult).toMatch(/^= /)
  })

  it("returns null for AST/TOV when tovPerGame is 0", () => {
    const result = computeDerivedStats({ ...fullInput, tovPerGame: 0 })
    expect(result.astTovRatio).toBeNull()
  })
})
