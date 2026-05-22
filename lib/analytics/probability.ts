/**
 * Probability model for NBA props analytics.
 * Pure computation module — no side effects or database calls.
 *
 * Weighted formula:
 *   Full:       40% recent form + 35% defensive matchup + 25% pace
 *   No pace:    57% recent form + 43% defensive matchup
 *   No defense: 100% recent form (form-only)
 */

export interface ProbabilityInput {
  recentGames: number[] // stat values, most recent first
  propLine: number
  defensiveStatAllowed: number | null // opposing team's positional stat
  leagueDefensiveValues: number[] // all teams' values for normalization
  opponentPace: number | null
  leaguePaceValues: number[] // all teams' pace for normalization
}

export interface ProbabilityOutput {
  probability: number // 0-100, 1 decimal
  recentFormFactor: number // 0-1
  defensiveMatchupFactor: number | null // 0-1 or null
  paceAdjustmentFactor: number | null // 0-1 or null
  factorsUsed: "full" | "no-defense" | "no-pace" | "form-only"
}

/**
 * Computes the recent form factor as the proportion of games where the stat
 * value met or exceeded the prop line, using the last min(10, length) games.
 * Returns a value in [0, 1].
 */
export function computeRecentForm(games: number[], propLine: number): number {
  if (games.length === 0) return 0

  const slice = games.slice(0, Math.min(10, games.length))
  const overCount = slice.filter((v) => v >= propLine).length
  return overCount / slice.length
}

/**
 * Min-max normalization. Returns 0.5 if max === min (all values identical),
 * otherwise returns (value - min) / (max - min), clamped to [0, 1].
 */
export function minMaxNormalize(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 0.5

  const min = Math.min(...allValues)
  const max = Math.max(...allValues)

  if (max === min) return 0.5

  const normalized = (value - min) / (max - min)
  return Math.max(0, Math.min(1, normalized))
}

/**
 * Computes the prop line as the arithmetic mean of the last min(10, length) games,
 * rounded to the nearest 0.5.
 */
export function computePropLine(games: number[]): number {
  if (games.length === 0) return 0

  const slice = games.slice(0, Math.min(10, games.length))
  const mean = slice.reduce((sum, v) => sum + v, 0) / slice.length
  return Math.round(mean * 2) / 2
}

/**
 * Computes the L5 average: mean of the last min(5, length) games,
 * rounded to 1 decimal place.
 */
export function computeL5Average(games: number[]): number {
  if (games.length === 0) return 0

  const slice = games.slice(0, Math.min(5, games.length))
  const mean = slice.reduce((sum, v) => sum + v, 0) / slice.length
  return Math.round(mean * 10) / 10
}

/**
 * Computes the L10 average: mean of the last min(10, length) games,
 * rounded to 1 decimal place.
 */
export function computeL10Average(games: number[]): number {
  if (games.length === 0) return 0

  const slice = games.slice(0, Math.min(10, games.length))
  const mean = slice.reduce((sum, v) => sum + v, 0) / slice.length
  return Math.round(mean * 10) / 10
}

/**
 * Computes the probability for a player-stat prop using the multi-factor model.
 *
 * Fallback logic:
 * - form-only: no defensive stats available → 100% recent form
 * - no-pace: defensive stats available but no pace → 57% form + 43% defense
 * - full: all factors available → 40% form + 35% defense + 25% pace
 */
export function computeProbability(input: ProbabilityInput): ProbabilityOutput {
  const {
    recentGames,
    propLine,
    defensiveStatAllowed,
    leagueDefensiveValues,
    opponentPace,
    leaguePaceValues,
  } = input

  const recentFormFactor = computeRecentForm(recentGames, propLine)

  // Determine defensive matchup factor
  let defensiveMatchupFactor: number | null = null
  if (defensiveStatAllowed !== null && leagueDefensiveValues.length > 0) {
    defensiveMatchupFactor = minMaxNormalize(
      defensiveStatAllowed,
      leagueDefensiveValues
    )
  }

  // Determine pace adjustment factor (only relevant when defense is available)
  let paceAdjustmentFactor: number | null = null
  if (
    defensiveMatchupFactor !== null &&
    opponentPace !== null &&
    leaguePaceValues.length > 0
  ) {
    paceAdjustmentFactor = minMaxNormalize(opponentPace, leaguePaceValues)
  }

  // Compute probability based on available factors
  let probability: number
  let factorsUsed: ProbabilityOutput["factorsUsed"]

  if (defensiveMatchupFactor === null) {
    // Form-only fallback
    factorsUsed = "form-only"
    probability = recentFormFactor * 100
  } else if (paceAdjustmentFactor === null) {
    // No pace fallback: 57% form + 43% defense
    factorsUsed = "no-pace"
    probability =
      (recentFormFactor * 0.57 + defensiveMatchupFactor * 0.43) * 100
  } else {
    // Full model: 40% form + 35% defense + 25% pace
    factorsUsed = "full"
    probability =
      (recentFormFactor * 0.4 +
        defensiveMatchupFactor * 0.35 +
        paceAdjustmentFactor * 0.25) *
      100
  }

  // Round to 1 decimal place and clamp to [0, 100]
  probability = Math.round(probability * 10) / 10
  probability = Math.max(0, Math.min(100, probability))

  return {
    probability,
    recentFormFactor,
    defensiveMatchupFactor,
    paceAdjustmentFactor,
    factorsUsed,
  }
}
