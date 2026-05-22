import { describe, it, expect } from "vitest"
import { computeHitRates, getColorBand } from "./hit-rates"

describe("computeHitRates", () => {
  it("computes correct hit rates for all windows with sufficient data", () => {
    // 20 games, values 1-20 (most recent first: 20, 19, 18, ..., 1)
    const gameValues = Array.from({ length: 20 }, (_, i) => 20 - i)
    const propLine = 15

    const results = computeHitRates(gameValues, propLine)

    // L5: values [20, 19, 18, 17, 16] — all >= 15 → 5/5 = 100%
    const l5 = results.find((r) => r.window === "L5")!
    expect(l5.available).toBe(true)
    expect(l5.over).toBe(5)
    expect(l5.total).toBe(5)
    expect(l5.hitRate).toBe(100)

    // L10: values [20, 19, ..., 11] — 6 values >= 15 → 6/10 = 60%
    const l10 = results.find((r) => r.window === "L10")!
    expect(l10.available).toBe(true)
    expect(l10.over).toBe(6)
    expect(l10.total).toBe(10)
    expect(l10.hitRate).toBe(60)

    // L15: values [20, 19, ..., 6] — 6 values >= 15 → 6/15 = 40%
    const l15 = results.find((r) => r.window === "L15")!
    expect(l15.available).toBe(true)
    expect(l15.over).toBe(6)
    expect(l15.total).toBe(15)
    expect(l15.hitRate).toBe(40)

    // L20: values [20, 19, ..., 1] — 6 values >= 15 → 6/20 = 30%
    const l20 = results.find((r) => r.window === "L20")!
    expect(l20.available).toBe(true)
    expect(l20.over).toBe(6)
    expect(l20.total).toBe(20)
    expect(l20.hitRate).toBe(30)

    // Season: same as L20 since we have exactly 20 games
    const season = results.find((r) => r.window === "Season")!
    expect(season.available).toBe(true)
    expect(season.over).toBe(6)
    expect(season.total).toBe(20)
    expect(season.hitRate).toBe(30)
  })

  it("marks windows with fewer than 3 games as unavailable", () => {
    const gameValues = [10, 12] // only 2 games
    const results = computeHitRates(gameValues, 5)

    for (const r of results) {
      expect(r.available).toBe(false)
    }
  })

  it("handles exactly 3 games — L5 uses all 3, larger windows unavailable-like but still 3 games", () => {
    const gameValues = [10, 8, 12]
    const propLine = 9
    const results = computeHitRates(gameValues, propLine)

    // L5: sliced to 3 games (only 3 available), total=3, over = [10, 12] = 2
    const l5 = results.find((r) => r.window === "L5")!
    expect(l5.available).toBe(true)
    expect(l5.over).toBe(2)
    expect(l5.total).toBe(3)
    expect(l5.hitRate).toBe(67) // Math.round(2/3 * 100)

    // L10, L15, L20: also sliced to 3 games (same data)
    const l10 = results.find((r) => r.window === "L10")!
    expect(l10.available).toBe(true)
    expect(l10.total).toBe(3)
  })

  it("uses vsOppValues for the vsOpp window", () => {
    const gameValues = Array.from({ length: 10 }, () => 20)
    const vsOppValues = [25, 30, 15, 10, 5]
    const propLine = 20

    const results = computeHitRates(gameValues, propLine, vsOppValues)
    const vsOpp = results.find((r) => r.window === "vsOpp")!

    expect(vsOpp.available).toBe(true)
    expect(vsOpp.over).toBe(2) // 25 and 30 are >= 20
    expect(vsOpp.total).toBe(5)
    expect(vsOpp.hitRate).toBe(40)
  })

  it("marks vsOpp as unavailable when no opponent data provided", () => {
    const gameValues = Array.from({ length: 10 }, () => 20)
    const results = computeHitRates(gameValues, 15)
    const vsOpp = results.find((r) => r.window === "vsOpp")!

    expect(vsOpp.available).toBe(false)
    expect(vsOpp.total).toBe(0)
  })

  it("marks vsOpp as unavailable when fewer than 3 opponent games", () => {
    const gameValues = Array.from({ length: 10 }, () => 20)
    const results = computeHitRates(gameValues, 15, [25, 30])
    const vsOpp = results.find((r) => r.window === "vsOpp")!

    expect(vsOpp.available).toBe(false)
    expect(vsOpp.total).toBe(2)
  })

  it("returns results in fixed order: L5, L10, L15, L20, Season, vsOpp", () => {
    const gameValues = Array.from({ length: 20 }, () => 10)
    const results = computeHitRates(gameValues, 5)

    expect(results.map((r) => r.window)).toEqual([
      "L5", "L10", "L15", "L20", "Season", "vsOpp",
    ])
  })

  it("counts values equal to propLine as over", () => {
    const gameValues = [10, 10, 10, 10, 10]
    const results = computeHitRates(gameValues, 10)
    const l5 = results.find((r) => r.window === "L5")!

    expect(l5.over).toBe(5)
    expect(l5.hitRate).toBe(100)
  })

  it("handles empty game values array", () => {
    const results = computeHitRates([], 10)

    for (const r of results) {
      expect(r.available).toBe(false)
      expect(r.total).toBe(0)
    }
  })
})

describe("getColorBand", () => {
  it("returns red for 0%", () => {
    expect(getColorBand(0)).toBe("red")
  })

  it("returns red for 30% (boundary belongs to red)", () => {
    expect(getColorBand(30)).toBe("red")
  })

  it("returns yellow for 31%", () => {
    expect(getColorBand(31)).toBe("yellow")
  })

  it("returns yellow for 60% (boundary belongs to yellow)", () => {
    expect(getColorBand(60)).toBe("yellow")
  })

  it("returns green for 61%", () => {
    expect(getColorBand(61)).toBe("green")
  })

  it("returns green for 100%", () => {
    expect(getColorBand(100)).toBe("green")
  })

  it("returns red for values in 1-29 range", () => {
    expect(getColorBand(1)).toBe("red")
    expect(getColorBand(15)).toBe("red")
    expect(getColorBand(29)).toBe("red")
  })

  it("returns yellow for values in 32-59 range", () => {
    expect(getColorBand(32)).toBe("yellow")
    expect(getColorBand(45)).toBe("yellow")
    expect(getColorBand(59)).toBe("yellow")
  })

  it("returns green for values in 62-99 range", () => {
    expect(getColorBand(62)).toBe("green")
    expect(getColorBand(80)).toBe("green")
    expect(getColorBand(99)).toBe("green")
  })
})
