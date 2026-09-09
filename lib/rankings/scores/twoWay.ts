/**
 * NBA Ranking Engine — Two-Way Score
 *
 * Measures balance between offensive and defensive impact.
 *
 * Formula: Geometric Mean
 *   two_way_score = sqrt(offense_score * defense_score)
 *
 * This heavily penalizes one-dimensional players. A player with 90 offense
 * and 30 defense gets sqrt(2700) = ~52, whereas a 60/60 player gets 60.
 */

import { clampScore } from "../normalize"

export interface TwoWayScoreInput {
  offense_score: number
  defense_score: number
}

export interface TwoWayScoreResult {
  score: number
}

export function computeTwoWayScore(input: TwoWayScoreInput): TwoWayScoreResult {
  const { offense_score, defense_score } = input

  const geometricMean = Math.sqrt(offense_score * defense_score)

  return { score: clampScore(geometricMean) }
}
