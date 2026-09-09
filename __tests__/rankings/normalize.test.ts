import {
  percentileRank,
  percentileRankInverted,
  roleAwarePercentileRank,
  clampScore,
  weightedAverage,
  consistencyScore,
  weighted3PScore,
  
} from "../../lib/rankings/normalize"

describe("Ranking Normalization Utils", () => {
  describe("percentileRank", () => {
    it("returns 50 for empty population", () => {
      expect(percentileRank(10, [])).toBe(50)
    })

    it("computes accurate percentile using midrank", () => {
      // 5 values: 10, 20, 30, 40, 50
      const pop = [10, 20, 30, 40, 50]
      expect(percentileRank(10, pop)).toBe(10) // (0 + 0.5*1)/5 = 0.1
      expect(percentileRank(30, pop)).toBe(50) // (2 + 0.5*1)/5 = 0.5
      expect(percentileRank(50, pop)).toBe(90) // (4 + 0.5*1)/5 = 0.9
    })

    it("handles duplicates correctly", () => {
      // 5 values: 10, 20, 20, 20, 30
      const pop = [10, 20, 20, 20, 30]
      // For 20: 1 below, 3 equal -> (1 + 0.5*3)/5 = (1 + 1.5)/5 = 2.5/5 = 50th percentile
      expect(percentileRank(20, pop)).toBe(50)
    })
  })

  describe("percentileRankInverted", () => {
    it("inverts the percentile (lower is better)", () => {
      const pop = [10, 20, 30, 40, 50]
      // 10 is the best (lowest). Percentile rank of 10 is 10. Inverted = 90.
      expect(percentileRankInverted(10, pop)).toBe(90)
      // 50 is the worst (highest). Percentile rank of 50 is 90. Inverted = 10.
      expect(percentileRankInverted(50, pop)).toBe(10)
    })
  })

  describe("roleAwarePercentileRank", () => {
    const popByPos = {
      GUARD: [1, 2, 3, 4, 5],
      BIG: [10, 15, 20, 25, 30],
    }
    const fullPop = [...popByPos.GUARD, ...popByPos.BIG]

    it("normalizes against positional cohort if enough samples", () => {
      // 4 rebounds for a GUARD is 70th percentile among GUARDs
      expect(roleAwarePercentileRank(4, "GUARD", popByPos, fullPop, 5)).toBe(70)
      
      // 15 rebounds for a BIG is only 30th percentile among BIGs
      expect(roleAwarePercentileRank(15, "BIG", popByPos, fullPop, 5)).toBe(30)
    })

    it("falls back to full population if position unknown or sample too small", () => {
      expect(roleAwarePercentileRank(15, "WING", popByPos, fullPop, 5)).toBe(65) // midrank: (6 below + 0.5 equal) / 10
    })
  })

  describe("weightedAverage", () => {
    it("computes weighted average and normalizes weights", () => {
      expect(weightedAverage([
        { value: 100, weight: 0.5 },
        { value: 0, weight: 0.5 },
      ])).toBe(50)

      expect(weightedAverage([
        { value: 100, weight: 1 },
        { value: 0, weight: 3 },
      ])).toBe(25)
    })
  })

  describe("clampScore", () => {
    it("clamps to 0-100 and rounds to 2 decimals", () => {
      expect(clampScore(150)).toBe(100)
      expect(clampScore(-50)).toBe(0)
      expect(clampScore(50.1234)).toBe(50.12)
    })
  })

  describe("consistencyScore", () => {
    it("returns 50 for insufficient data", () => {
      expect(consistencyScore([10, 20])).toBe(50)
    })

    it("rewards low variance", () => {
      // High consistency (BIGV = 0)
      expect(consistencyScore([20, 20, 20, 20, 20])).toBe(100)
      
      // Moderate consistency
      expect(consistencyScore([10, 20, 10, 20, 15, 15])).toBeCloseTo(72.78, 2)
      
      // Low consistency (BIGV > 1) -> 0
      expect(consistencyScore([0, 0, 0, 0, 50])).toBe(0)
    })
  })

  describe("weighted3PScore", () => {
    const lgPop = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    it("penalizes low volume regardless of efficiency", () => {
      expect(weighted3PScore(0.50, 0.4, lgPop)).toBe(30)
    })

    it("blends efficiency and volume", () => {
      const elite = weighted3PScore(0.45, 9, lgPop) // Elite efficiency, high volume
      const good = weighted3PScore(0.38, 5, lgPop) // Good efficiency, mid volume
      const chucking = weighted3PScore(0.25, 9, lgPop) // Poor efficiency, high volume

      expect(elite).toBeGreaterThan(good)
      expect(good).toBeGreaterThan(chucking)
      
      // Elite should be close to 100
      expect(elite).toBeCloseTo(90.28, 2)
    })
  })

  
})
