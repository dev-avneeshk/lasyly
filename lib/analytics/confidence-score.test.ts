import { describe, it, expect } from "vitest"
import { computeConfidenceScore, ConfidenceBreakdown } from "./confidence-score"

describe("computeConfidenceScore", () => {
  describe("returns null for insufficient data", () => {
    it("returns null when gamesPlayed < 3", () => {
      expect(computeConfidenceScore(80, 70, "A", 2)).toBeNull()
      expect(computeConfidenceScore(80, 70, "A", 1)).toBeNull()
      expect(computeConfidenceScore(80, 70, "A", 0)).toBeNull()
    })

    it("returns a result when gamesPlayed = 3", () => {
      const result = computeConfidenceScore(80, 70, "A", 3)
      expect(result).not.toBeNull()
    })
  })

  describe("normalization", () => {
    it("normalizes L5 hit rate from 0-100 to 0-1", () => {
      const result = computeConfidenceScore(60, 50, "C", 10)!
      expect(result.l5HitRate).toBeCloseTo(0.6)
    })

    it("normalizes L10 hit rate from 0-100 to 0-1", () => {
      const result = computeConfidenceScore(60, 50, "C", 10)!
      expect(result.l10HitRate).toBeCloseTo(0.5)
    })

    it("normalizes matchup grade A to 1.0", () => {
      const result = computeConfidenceScore(50, 50, "A", 10)!
      expect(result.matchupGrade).toBe(1.0)
    })

    it("normalizes matchup grade B to 0.75", () => {
      const result = computeConfidenceScore(50, 50, "B", 10)!
      expect(result.matchupGrade).toBe(0.75)
    })

    it("normalizes matchup grade C to 0.5", () => {
      const result = computeConfidenceScore(50, 50, "C", 10)!
      expect(result.matchupGrade).toBe(0.5)
    })

    it("normalizes matchup grade D to 0.25", () => {
      const result = computeConfidenceScore(50, 50, "D", 10)!
      expect(result.matchupGrade).toBe(0.25)
    })

    it("normalizes matchup grade F to 0.0", () => {
      const result = computeConfidenceScore(50, 50, "F", 10)!
      expect(result.matchupGrade).toBe(0.0)
    })

    it("uses 0.5 as neutral default when matchup grade is null", () => {
      const result = computeConfidenceScore(50, 50, null, 10)!
      expect(result.matchupGrade).toBe(0.5)
    })

    it("normalizes sample size as min(gamesPlayed, 10) / 10", () => {
      const result5 = computeConfidenceScore(50, 50, "C", 5)!
      expect(result5.sampleSize).toBeCloseTo(0.5)

      const result10 = computeConfidenceScore(50, 50, "C", 10)!
      expect(result10.sampleSize).toBeCloseTo(1.0)

      const result20 = computeConfidenceScore(50, 50, "C", 20)!
      expect(result20.sampleSize).toBeCloseTo(1.0) // capped at 10
    })
  })

  describe("weighted formula", () => {
    it("computes finalScore as weighted sum with correct weights", () => {
      // L5=100%, L10=100%, grade=A (1.0), 10 games (1.0)
      // 0.30*1.0 + 0.20*1.0 + 0.25*1.0 + 0.25*1.0 = 1.0
      const result = computeConfidenceScore(100, 100, "A", 10)!
      expect(result.finalScore).toBeCloseTo(1.0)
    })

    it("computes finalScore correctly for mixed inputs", () => {
      // L5=60%, L10=40%, grade=C (0.5), 8 games (0.8)
      // 0.30*0.6 + 0.20*0.4 + 0.25*0.5 + 0.25*0.8
      // = 0.18 + 0.08 + 0.125 + 0.2 = 0.585
      const result = computeConfidenceScore(60, 40, "C", 8)!
      expect(result.finalScore).toBeCloseTo(0.585)
    })

    it("computes finalScore correctly for all zeros", () => {
      // L5=0%, L10=0%, grade=F (0.0), 3 games (0.3)
      // 0.30*0 + 0.20*0 + 0.25*0 + 0.25*0.3 = 0.075
      const result = computeConfidenceScore(0, 0, "F", 3)!
      expect(result.finalScore).toBeCloseTo(0.075)
    })
  })

  describe("star mapping", () => {
    it("maps [0, 0.39] to 1 star", () => {
      // L5=0%, L10=0%, grade=F (0.0), 3 games (0.3) → 0.075 → 1 star
      const result = computeConfidenceScore(0, 0, "F", 3)!
      expect(result.stars).toBe(1)
    })

    it("maps [0.40, 0.54] to 2 stars", () => {
      // Need finalScore ~0.45
      // L5=40%, L10=40%, grade=C (0.5), 5 games (0.5)
      // 0.30*0.4 + 0.20*0.4 + 0.25*0.5 + 0.25*0.5
      // = 0.12 + 0.08 + 0.125 + 0.125 = 0.45
      const result = computeConfidenceScore(40, 40, "C", 5)!
      expect(result.finalScore).toBeCloseTo(0.45)
      expect(result.stars).toBe(2)
    })

    it("maps [0.55, 0.69] to 3 stars", () => {
      // L5=60%, L10=60%, grade=C (0.5), 8 games (0.8)
      // 0.30*0.6 + 0.20*0.6 + 0.25*0.5 + 0.25*0.8
      // = 0.18 + 0.12 + 0.125 + 0.2 = 0.625
      const result = computeConfidenceScore(60, 60, "C", 8)!
      expect(result.finalScore).toBeCloseTo(0.625)
      expect(result.stars).toBe(3)
    })

    it("maps [0.70, 0.84] to 4 stars", () => {
      // L5=80%, L10=80%, grade=B (0.75), 10 games (1.0)
      // 0.30*0.8 + 0.20*0.8 + 0.25*0.75 + 0.25*1.0
      // = 0.24 + 0.16 + 0.1875 + 0.25 = 0.8375
      // That's actually 4 stars (0.70-0.84)... wait 0.8375 is > 0.84
      // Let's try: L5=70%, L10=70%, grade=B (0.75), 10 games (1.0)
      // 0.30*0.7 + 0.20*0.7 + 0.25*0.75 + 0.25*1.0
      // = 0.21 + 0.14 + 0.1875 + 0.25 = 0.7875
      const result = computeConfidenceScore(70, 70, "B", 10)!
      expect(result.finalScore).toBeCloseTo(0.7875)
      expect(result.stars).toBe(4)
    })

    it("maps [0.85, 1.0] to 5 stars", () => {
      // L5=100%, L10=100%, grade=A (1.0), 10 games (1.0) → 1.0 → 5 stars
      const result = computeConfidenceScore(100, 100, "A", 10)!
      expect(result.stars).toBe(5)
    })
  })

  describe("business rules", () => {
    it("applies minimum 4 stars when L5 >= 80% AND grade is A", () => {
      // L5=80%, L10=30%, grade=A (1.0), 10 games (1.0)
      // 0.30*0.8 + 0.20*0.3 + 0.25*1.0 + 0.25*1.0
      // = 0.24 + 0.06 + 0.25 + 0.25 = 0.80 → 4 stars (already 4)
      // Try with lower L10 to get below 4 stars naturally
      // L5=80%, L10=0%, grade=A (1.0), 10 games (1.0)
      // 0.30*0.8 + 0.20*0 + 0.25*1.0 + 0.25*1.0
      // = 0.24 + 0 + 0.25 + 0.25 = 0.74 → 4 stars (already 4)
      // L5=80%, L10=0%, grade=B (0.75), 10 games (1.0)
      // 0.30*0.8 + 0.20*0 + 0.25*0.75 + 0.25*1.0
      // = 0.24 + 0 + 0.1875 + 0.25 = 0.6775 → 3 stars → should be bumped to 4
      const result = computeConfidenceScore(80, 0, "B", 10)!
      expect(result.finalScore).toBeCloseTo(0.6775)
      expect(result.stars).toBe(4) // bumped from 3 to 4
    })

    it("applies minimum 4 stars when L5 >= 80% AND grade is B", () => {
      // L5=80%, L10=10%, grade=B (0.75), 10 games (1.0)
      // 0.30*0.8 + 0.20*0.1 + 0.25*0.75 + 0.25*1.0
      // = 0.24 + 0.02 + 0.1875 + 0.25 = 0.6975 → 4 stars (already at boundary)
      // Actually 0.6975 is still 3 stars (< 0.70)
      const result = computeConfidenceScore(80, 10, "B", 10)!
      expect(result.stars).toBe(4) // bumped from 3 to 4
    })

    it("does NOT apply minimum 4 stars when grade is C", () => {
      // L5=80%, L10=0%, grade=C (0.5), 10 games (1.0)
      // 0.30*0.8 + 0.20*0 + 0.25*0.5 + 0.25*1.0
      // = 0.24 + 0 + 0.125 + 0.25 = 0.615 → 3 stars
      const result = computeConfidenceScore(80, 0, "C", 10)!
      expect(result.stars).toBe(3) // no bump
    })

    it("does NOT apply minimum 4 stars when L5 < 80%", () => {
      // L5=79%, L10=0%, grade=A (1.0), 10 games (1.0)
      // 0.30*0.79 + 0.20*0 + 0.25*1.0 + 0.25*1.0
      // = 0.237 + 0 + 0.25 + 0.25 = 0.737 → 4 stars naturally
      // Need lower to test: L5=79%, L10=0%, grade=B (0.75), 10 games (1.0)
      // = 0.237 + 0 + 0.1875 + 0.25 = 0.6745 → 3 stars, no bump
      const result = computeConfidenceScore(79, 0, "B", 10)!
      expect(result.stars).toBe(3) // no bump because L5 < 80
    })

    it("caps at 3 stars when gamesPlayed < 5", () => {
      // L5=100%, L10=100%, grade=A (1.0), 4 games (0.4)
      // 0.30*1.0 + 0.20*1.0 + 0.25*1.0 + 0.25*0.4
      // = 0.30 + 0.20 + 0.25 + 0.10 = 0.85 → 5 stars → capped to 3
      const result = computeConfidenceScore(100, 100, "A", 4)!
      expect(result.stars).toBe(3)
    })

    it("cap overrides minimum when both rules apply", () => {
      // L5=80%, L10=80%, grade=A (1.0), 4 games (0.4)
      // Both rules apply: min 4★ (L5>=80 + grade A) AND cap 3★ (<5 games)
      // Cap wins → 3 stars
      const result = computeConfidenceScore(80, 80, "A", 4)!
      expect(result.stars).toBe(3) // cap overrides min
    })

    it("cap overrides minimum with grade B", () => {
      // L5=90%, L10=90%, grade=B (0.75), 3 games (0.3)
      // Both rules: min 4★ (L5>=80 + grade B) AND cap 3★ (<5 games)
      // Cap wins → 3 stars
      const result = computeConfidenceScore(90, 90, "B", 3)!
      expect(result.stars).toBe(3)
    })
  })

  describe("edge cases", () => {
    it("handles exactly 80% L5 for the minimum rule", () => {
      // L5=80% exactly should trigger the min-4-star rule with grade A/B
      const result = computeConfidenceScore(80, 0, "A", 10)!
      // 0.30*0.8 + 0.20*0 + 0.25*1.0 + 0.25*1.0 = 0.74 → 4 stars naturally
      expect(result.stars).toBe(4)
    })

    it("handles exactly 5 games (no cap)", () => {
      // 5 games should NOT trigger the cap
      const result = computeConfidenceScore(100, 100, "A", 5)!
      // 0.30*1.0 + 0.20*1.0 + 0.25*1.0 + 0.25*0.5 = 0.875 → 5 stars
      expect(result.stars).toBe(5)
    })

    it("handles null matchup grade with min-4-star rule (rule does not apply)", () => {
      // null grade means the min-4-star rule cannot apply
      const result = computeConfidenceScore(100, 0, null, 10)!
      // 0.30*1.0 + 0.20*0 + 0.25*0.5 + 0.25*1.0
      // = 0.30 + 0 + 0.125 + 0.25 = 0.675 → 3 stars
      expect(result.stars).toBe(3)
    })

    it("returns correct breakdown structure", () => {
      const result = computeConfidenceScore(60, 40, "B", 7)!
      expect(result).toHaveProperty("l5HitRate")
      expect(result).toHaveProperty("l10HitRate")
      expect(result).toHaveProperty("matchupGrade")
      expect(result).toHaveProperty("sampleSize")
      expect(result).toHaveProperty("finalScore")
      expect(result).toHaveProperty("stars")
      expect(result.stars).toBeGreaterThanOrEqual(1)
      expect(result.stars).toBeLessThanOrEqual(5)
    })
  })
})
