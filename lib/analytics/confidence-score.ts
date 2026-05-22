/**
 * Confidence score computation module.
 *
 * Computes a composite 1-to-5 star rating that weights recency (L5, L10),
 * matchup grade, and sample size into a single pick quality indicator.
 *
 * Pure computation — no side effects or external dependencies.
 */

import { Grade } from "./matchup-grades"

export interface ConfidenceBreakdown {
  /** Normalized L5 hit rate (0-1) */
  l5HitRate: number
  /** Normalized L10 hit rate (0-1) */
  l10HitRate: number
  /** Normalized matchup grade factor (0-1) */
  matchupGrade: number
  /** Normalized sample size factor (0-1) */
  sampleSize: number
  /** Weighted sum (0-1) */
  finalScore: number
  /** Star rating (1-5) */
  stars: number
}

/** Weights for each factor in the confidence formula */
const WEIGHTS = {
  l5: 0.3,
  l10: 0.2,
  matchup: 0.25,
  sampleSize: 0.25,
} as const

/** Map matchup grade to normalized value (0-1) */
const GRADE_MAP: Record<Grade, number> = {
  A: 1.0,
  B: 0.75,
  C: 0.5,
  D: 0.25,
  F: 0.0,
}

/** Neutral default when no matchup grade is available */
const GRADE_NULL_DEFAULT = 0.5

/**
 * Map a weighted score (0-1) to a star rating (1-5).
 *
 * Ranges:
 * - [0, 0.39] → 1 star
 * - [0.40, 0.54] → 2 stars
 * - [0.55, 0.69] → 3 stars
 * - [0.70, 0.84] → 4 stars
 * - [0.85, 1.0] → 5 stars
 */
function scoreToStars(score: number): number {
  if (score >= 0.85) return 5
  if (score >= 0.70) return 4
  if (score >= 0.55) return 3
  if (score >= 0.40) return 2
  return 1
}

/**
 * Compute the confidence score for a prop.
 *
 * @param l5HitRate - L5 hit rate as a percentage (0-100)
 * @param l10HitRate - L10 hit rate as a percentage (0-100)
 * @param matchupGrade - The matchup grade (A-F) or null if unavailable
 * @param gamesPlayed - Total number of games the player has played
 * @returns ConfidenceBreakdown or null if insufficient data (< 3 games)
 */
export function computeConfidenceScore(
  l5HitRate: number,
  l10HitRate: number,
  matchupGrade: Grade | null,
  gamesPlayed: number
): ConfidenceBreakdown | null {
  // Return null if fewer than 3 games (insufficient data)
  if (gamesPlayed < 3) {
    return null
  }

  // Normalize inputs to 0-1 scale
  const normalizedL5 = l5HitRate / 100
  const normalizedL10 = l10HitRate / 100
  const normalizedMatchup =
    matchupGrade !== null ? GRADE_MAP[matchupGrade] : GRADE_NULL_DEFAULT
  const normalizedSampleSize = Math.min(gamesPlayed, 10) / 10

  // Compute weighted sum
  const finalScore =
    WEIGHTS.l5 * normalizedL5 +
    WEIGHTS.l10 * normalizedL10 +
    WEIGHTS.matchup * normalizedMatchup +
    WEIGHTS.sampleSize * normalizedSampleSize

  // Map to stars
  let stars = scoreToStars(finalScore)

  // Business rule: minimum 4 stars when L5 >= 80% AND grade is A or B
  const hasMinFourStarRule =
    l5HitRate >= 80 && (matchupGrade === "A" || matchupGrade === "B")
  if (hasMinFourStarRule && stars < 4) {
    stars = 4
  }

  // Business rule: cap at 3 stars when fewer than 5 games
  const hasThreeStarCap = gamesPlayed < 5
  if (hasThreeStarCap && stars > 3) {
    stars = 3
  }

  return {
    l5HitRate: normalizedL5,
    l10HitRate: normalizedL10,
    matchupGrade: normalizedMatchup,
    sampleSize: normalizedSampleSize,
    finalScore,
    stars,
  }
}
