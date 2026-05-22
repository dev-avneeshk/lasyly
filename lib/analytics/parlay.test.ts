import { describe, it, expect } from "vitest"
import {
  computeParlayStats,
  identifyWeakLink,
  ParlayLeg,
  CorrelationPair,
} from "./parlay"

describe("identifyWeakLink", () => {
  it("returns the single leg with the lowest L10 hit rate", () => {
    const legs = [
      { propId: "a", l10HitRate: 70 },
      { propId: "b", l10HitRate: 50 },
      { propId: "c", l10HitRate: 80 },
    ]
    expect(identifyWeakLink(legs)).toEqual(["b"])
  })

  it("returns all tied legs when multiple share the minimum", () => {
    const legs = [
      { propId: "a", l10HitRate: 40 },
      { propId: "b", l10HitRate: 40 },
      { propId: "c", l10HitRate: 80 },
    ]
    expect(identifyWeakLink(legs)).toEqual(["a", "b"])
  })

  it("returns all legs when all have the same hit rate", () => {
    const legs = [
      { propId: "a", l10HitRate: 60 },
      { propId: "b", l10HitRate: 60 },
    ]
    expect(identifyWeakLink(legs)).toEqual(["a", "b"])
  })

  it("returns empty array for empty input", () => {
    expect(identifyWeakLink([])).toEqual([])
  })

  it("returns the single leg when only one leg exists", () => {
    const legs = [{ propId: "a", l10HitRate: 90 }]
    expect(identifyWeakLink(legs)).toEqual(["a"])
  })
})

describe("computeParlayStats", () => {
  // Helper to create a leg with game data
  function makeLeg(overrides: Partial<ParlayLeg> & { propId: string }): ParlayLeg {
    return {
      player: "Player",
      statCategory: "pts",
      propLine: 20,
      direction: "over",
      l10HitRate: 70,
      gameData: [],
      ...overrides,
    }
  }

  describe("combined hit rate", () => {
    it("returns null when fewer than 5 overlapping dates", () => {
      const legs: ParlayLeg[] = [
        makeLeg({
          propId: "a",
          gameData: [
            { date: "2024-01-01", value: 25 },
            { date: "2024-01-02", value: 25 },
            { date: "2024-01-03", value: 25 },
            { date: "2024-01-04", value: 25 },
          ],
        }),
        makeLeg({
          propId: "b",
          gameData: [
            { date: "2024-01-01", value: 25 },
            { date: "2024-01-02", value: 25 },
            { date: "2024-01-03", value: 25 },
            { date: "2024-01-04", value: 25 },
          ],
        }),
      ]

      const result = computeParlayStats(legs, [])
      expect(result.combinedHitRate).toBeNull()
      expect(result.overlappingDates).toBe(4)
    })

    it("computes combined hit rate when all legs hit on all overlapping dates", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"]
      const legs: ParlayLeg[] = [
        makeLeg({
          propId: "a",
          propLine: 20,
          direction: "over",
          gameData: dates.map((d) => ({ date: d, value: 25 })),
        }),
        makeLeg({
          propId: "b",
          propLine: 15,
          direction: "over",
          gameData: dates.map((d) => ({ date: d, value: 20 })),
        }),
      ]

      const result = computeParlayStats(legs, [])
      expect(result.combinedHitRate).toBe(100)
      expect(result.overlappingDates).toBe(5)
    })

    it("computes combined hit rate when some dates miss", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"]
      const legs: ParlayLeg[] = [
        makeLeg({
          propId: "a",
          propLine: 20,
          direction: "over",
          // Hits on all 5 dates
          gameData: dates.map((d) => ({ date: d, value: 25 })),
        }),
        makeLeg({
          propId: "b",
          propLine: 20,
          direction: "over",
          // Hits on 3 of 5 dates (misses on 01-04 and 01-05)
          gameData: [
            { date: "2024-01-01", value: 25 },
            { date: "2024-01-02", value: 25 },
            { date: "2024-01-03", value: 25 },
            { date: "2024-01-04", value: 15 },
            { date: "2024-01-05", value: 10 },
          ],
        }),
      ]

      const result = computeParlayStats(legs, [])
      // All hit on 3 of 5 dates → 60.0%
      expect(result.combinedHitRate).toBe(60)
      expect(result.overlappingDates).toBe(5)
    })

    it("only considers overlapping dates (intersection of all legs)", () => {
      const legs: ParlayLeg[] = [
        makeLeg({
          propId: "a",
          propLine: 20,
          direction: "over",
          gameData: [
            { date: "2024-01-01", value: 25 },
            { date: "2024-01-02", value: 25 },
            { date: "2024-01-03", value: 25 },
            { date: "2024-01-04", value: 25 },
            { date: "2024-01-05", value: 25 },
            { date: "2024-01-06", value: 25 },
            { date: "2024-01-07", value: 25 },
          ],
        }),
        makeLeg({
          propId: "b",
          propLine: 20,
          direction: "over",
          gameData: [
            { date: "2024-01-03", value: 25 },
            { date: "2024-01-04", value: 25 },
            { date: "2024-01-05", value: 25 },
            { date: "2024-01-06", value: 25 },
            { date: "2024-01-07", value: 25 },
          ],
        }),
      ]

      const result = computeParlayStats(legs, [])
      // Only 5 overlapping dates: 01-03 through 01-07
      expect(result.overlappingDates).toBe(5)
      expect(result.combinedHitRate).toBe(100)
    })

    it("handles under direction correctly", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"]
      const legs: ParlayLeg[] = [
        makeLeg({
          propId: "a",
          propLine: 20,
          direction: "under",
          // Under hits when value < propLine
          gameData: [
            { date: "2024-01-01", value: 15 }, // hit
            { date: "2024-01-02", value: 10 }, // hit
            { date: "2024-01-03", value: 25 }, // miss
            { date: "2024-01-04", value: 18 }, // hit
            { date: "2024-01-05", value: 12 }, // hit
          ],
        }),
        makeLeg({
          propId: "b",
          propLine: 30,
          direction: "under",
          gameData: [
            { date: "2024-01-01", value: 25 }, // hit
            { date: "2024-01-02", value: 35 }, // miss
            { date: "2024-01-03", value: 20 }, // hit
            { date: "2024-01-04", value: 28 }, // hit
            { date: "2024-01-05", value: 10 }, // hit
          ],
        }),
      ]

      const result = computeParlayStats(legs, [])
      // Both hit: 01-01 (a:15<20, b:25<30), 01-04 (a:18<20, b:28<30), 01-05 (a:12<20, b:10<30)
      // 3 of 5 = 60%
      expect(result.combinedHitRate).toBe(60)
    })

    it("handles mixed over/under directions", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"]
      const legs: ParlayLeg[] = [
        makeLeg({
          propId: "a",
          propLine: 20,
          direction: "over",
          gameData: [
            { date: "2024-01-01", value: 25 }, // hit (>=20)
            { date: "2024-01-02", value: 15 }, // miss
            { date: "2024-01-03", value: 22 }, // hit
            { date: "2024-01-04", value: 30 }, // hit
            { date: "2024-01-05", value: 10 }, // miss
          ],
        }),
        makeLeg({
          propId: "b",
          propLine: 10,
          direction: "under",
          gameData: [
            { date: "2024-01-01", value: 5 },  // hit (<10)
            { date: "2024-01-02", value: 12 }, // miss
            { date: "2024-01-03", value: 8 },  // hit
            { date: "2024-01-04", value: 15 }, // miss
            { date: "2024-01-05", value: 3 },  // hit
          ],
        }),
      ]

      const result = computeParlayStats(legs, [])
      // Both hit: 01-01 (a:25>=20, b:5<10), 01-03 (a:22>=20, b:8<10)
      // 2 of 5 = 40%
      expect(result.combinedHitRate).toBe(40)
    })

    it("rounds combined hit rate to 1 decimal place", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06"]
      const legs: ParlayLeg[] = [
        makeLeg({
          propId: "a",
          propLine: 20,
          direction: "over",
          gameData: dates.map((d) => ({ date: d, value: 25 })),
        }),
        makeLeg({
          propId: "b",
          propLine: 20,
          direction: "over",
          gameData: [
            { date: "2024-01-01", value: 25 },
            { date: "2024-01-02", value: 25 },
            { date: "2024-01-03", value: 15 }, // miss
            { date: "2024-01-04", value: 25 },
            { date: "2024-01-05", value: 25 },
            { date: "2024-01-06", value: 15 }, // miss
          ],
        }),
      ]

      const result = computeParlayStats(legs, [])
      // 4 of 6 = 66.666...% → rounded to 66.7
      expect(result.combinedHitRate).toBe(66.7)
    })

    it("returns 0 overlapping dates when legs have no common dates", () => {
      const legs: ParlayLeg[] = [
        makeLeg({
          propId: "a",
          gameData: [
            { date: "2024-01-01", value: 25 },
            { date: "2024-01-02", value: 25 },
          ],
        }),
        makeLeg({
          propId: "b",
          gameData: [
            { date: "2024-01-03", value: 25 },
            { date: "2024-01-04", value: 25 },
          ],
        }),
      ]

      const result = computeParlayStats(legs, [])
      expect(result.overlappingDates).toBe(0)
      expect(result.combinedHitRate).toBeNull()
    })
  })

  describe("correlation flags", () => {
    it("flags legs as correlated when coefficient > 0.5", () => {
      const legs: ParlayLeg[] = [
        makeLeg({ propId: "a", l10HitRate: 70 }),
        makeLeg({ propId: "b", l10HitRate: 80 }),
      ]
      const correlations: CorrelationPair[] = [
        { propA: "a", propB: "b", coefficient: 0.75 },
      ]

      const result = computeParlayStats(legs, correlations)
      expect(result.legs[0].correlationFlag).toBe("correlated")
      expect(result.legs[1].correlationFlag).toBe("correlated")
      expect(result.correlationPairs).toHaveLength(1)
    })

    it("flags legs as conflict when coefficient < -0.3", () => {
      const legs: ParlayLeg[] = [
        makeLeg({ propId: "a", l10HitRate: 70 }),
        makeLeg({ propId: "b", l10HitRate: 80 }),
      ]
      const correlations: CorrelationPair[] = [
        { propA: "a", propB: "b", coefficient: -0.5 },
      ]

      const result = computeParlayStats(legs, correlations)
      expect(result.legs[0].correlationFlag).toBe("conflict")
      expect(result.legs[1].correlationFlag).toBe("conflict")
    })

    it("does not flag legs when coefficient is between -0.3 and 0.5", () => {
      const legs: ParlayLeg[] = [
        makeLeg({ propId: "a", l10HitRate: 70 }),
        makeLeg({ propId: "b", l10HitRate: 80 }),
      ]
      const correlations: CorrelationPair[] = [
        { propA: "a", propB: "b", coefficient: 0.3 },
      ]

      const result = computeParlayStats(legs, correlations)
      expect(result.legs[0].correlationFlag).toBeUndefined()
      expect(result.legs[1].correlationFlag).toBeUndefined()
    })

    it("does not flag at exactly 0.5 (must be > 0.5)", () => {
      const legs: ParlayLeg[] = [
        makeLeg({ propId: "a", l10HitRate: 70 }),
        makeLeg({ propId: "b", l10HitRate: 80 }),
      ]
      const correlations: CorrelationPair[] = [
        { propA: "a", propB: "b", coefficient: 0.5 },
      ]

      const result = computeParlayStats(legs, correlations)
      expect(result.legs[0].correlationFlag).toBeUndefined()
      expect(result.legs[1].correlationFlag).toBeUndefined()
    })

    it("does not flag at exactly -0.3 (must be < -0.3)", () => {
      const legs: ParlayLeg[] = [
        makeLeg({ propId: "a", l10HitRate: 70 }),
        makeLeg({ propId: "b", l10HitRate: 80 }),
      ]
      const correlations: CorrelationPair[] = [
        { propA: "a", propB: "b", coefficient: -0.3 },
      ]

      const result = computeParlayStats(legs, correlations)
      expect(result.legs[0].correlationFlag).toBeUndefined()
      expect(result.legs[1].correlationFlag).toBeUndefined()
    })

    it("conflict takes precedence over correlated for the same leg", () => {
      const legs: ParlayLeg[] = [
        makeLeg({ propId: "a", l10HitRate: 70 }),
        makeLeg({ propId: "b", l10HitRate: 80 }),
        makeLeg({ propId: "c", l10HitRate: 60 }),
      ]
      const correlations: CorrelationPair[] = [
        { propA: "a", propB: "b", coefficient: 0.75 }, // a correlated with b
        { propA: "a", propB: "c", coefficient: -0.5 }, // a conflicts with c
      ]

      const result = computeParlayStats(legs, correlations)
      // "a" has both correlated (with b) and conflict (with c) — conflict wins
      expect(result.legs[0].correlationFlag).toBe("conflict")
      expect(result.legs[1].correlationFlag).toBe("correlated")
      expect(result.legs[2].correlationFlag).toBe("conflict")
    })

    it("only includes correlation pairs where both legs are in the parlay", () => {
      const legs: ParlayLeg[] = [
        makeLeg({ propId: "a", l10HitRate: 70 }),
        makeLeg({ propId: "b", l10HitRate: 80 }),
      ]
      const correlations: CorrelationPair[] = [
        { propA: "a", propB: "b", coefficient: 0.75 },
        { propA: "a", propB: "x", coefficient: 0.9 }, // x not in parlay
        { propA: "y", propB: "b", coefficient: 0.8 }, // y not in parlay
      ]

      const result = computeParlayStats(legs, correlations)
      expect(result.correlationPairs).toHaveLength(1)
      expect(result.correlationPairs[0]).toEqual({
        propA: "a",
        propB: "b",
        coefficient: 0.75,
      })
    })
  })

  describe("weak link identification", () => {
    it("marks the leg with lowest L10 hit rate as weak link", () => {
      const legs: ParlayLeg[] = [
        makeLeg({ propId: "a", l10HitRate: 80 }),
        makeLeg({ propId: "b", l10HitRate: 50 }),
        makeLeg({ propId: "c", l10HitRate: 70 }),
      ]

      const result = computeParlayStats(legs, [])
      expect(result.legs[0].isWeakLink).toBe(false)
      expect(result.legs[1].isWeakLink).toBe(true)
      expect(result.legs[2].isWeakLink).toBe(false)
    })

    it("marks all tied legs as weak link", () => {
      const legs: ParlayLeg[] = [
        makeLeg({ propId: "a", l10HitRate: 50 }),
        makeLeg({ propId: "b", l10HitRate: 50 }),
        makeLeg({ propId: "c", l10HitRate: 80 }),
      ]

      const result = computeParlayStats(legs, [])
      expect(result.legs[0].isWeakLink).toBe(true)
      expect(result.legs[1].isWeakLink).toBe(true)
      expect(result.legs[2].isWeakLink).toBe(false)
    })
  })

  describe("edge cases", () => {
    it("handles empty legs array", () => {
      const result = computeParlayStats([], [])
      expect(result.combinedHitRate).toBeNull()
      expect(result.overlappingDates).toBe(0)
      expect(result.legs).toEqual([])
      expect(result.correlationPairs).toEqual([])
    })

    it("handles single leg", () => {
      const legs: ParlayLeg[] = [
        makeLeg({
          propId: "a",
          l10HitRate: 70,
          gameData: [
            { date: "2024-01-01", value: 25 },
            { date: "2024-01-02", value: 25 },
            { date: "2024-01-03", value: 25 },
            { date: "2024-01-04", value: 25 },
            { date: "2024-01-05", value: 25 },
          ],
        }),
      ]

      const result = computeParlayStats(legs, [])
      // Single leg: all 5 dates overlap with itself, all hit
      expect(result.combinedHitRate).toBe(100)
      expect(result.overlappingDates).toBe(5)
      expect(result.legs[0].isWeakLink).toBe(true) // only leg = weak link
    })

    it("handles value exactly equal to propLine for over direction", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"]
      const legs: ParlayLeg[] = [
        makeLeg({
          propId: "a",
          propLine: 20,
          direction: "over",
          gameData: dates.map((d) => ({ date: d, value: 20 })), // exactly at line
        }),
      ]

      const result = computeParlayStats(legs, [])
      // value >= propLine → hits
      expect(result.combinedHitRate).toBe(100)
    })

    it("handles value exactly equal to propLine for under direction", () => {
      const dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"]
      const legs: ParlayLeg[] = [
        makeLeg({
          propId: "a",
          propLine: 20,
          direction: "under",
          gameData: dates.map((d) => ({ date: d, value: 20 })), // exactly at line
        }),
      ]

      const result = computeParlayStats(legs, [])
      // value < propLine for under → 20 is NOT < 20, so no hits
      expect(result.combinedHitRate).toBe(0)
    })
  })
})
