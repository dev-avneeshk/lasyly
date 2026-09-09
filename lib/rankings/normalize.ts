/**
 * NBA Ranking Engine — Normalization Utilities
 *
 * Pure math functions for normalizing raw basketball statistics
 * into comparable 0-100 scores.
 *
 * Key principle: percentile-based normalization is preferred over
 * min-max for basketball stats because they are highly right-skewed
 * (a few elite players distort the range).
 *
 * Reuses `minMaxNormalize` logic from lib/analytics/probability.ts
 * but extends it with percentile-rank and position-aware variants.
 *
 * All functions are pure — no side effects.
 */

import type { NBAPosition } from "./types"

// ─── Percentile Rank (Primary Normalization) ──────────────────────────────────

/**
 * Returns the percentile rank of `value` within `population` as a 0-100 score.
 * Higher value = higher percentile = higher score.
 *
 * Uses "proportion of population strictly below" definition,
 * adjusted by 0.5 for ties (midrank method) for stability.
 *
 * @example
 *   percentileRank(28, [20, 25, 28, 30, 35]) → 60 (3rd out of 5 = 60th percentile)
 */
export function percentileRank(value: number, population: number[]): number {
  if (population.length === 0) return 50  // unknown = neutral
  if (population.length === 1) return 50

  const below = population.filter((v) => v < value).length
  const equal = population.filter((v) => v === value).length

  // Midrank: count of below + 0.5 * equal, divided by total
  const rank = (below + equal * 0.5) / population.length
  return Math.round(rank * 1000) / 10  // 0.0 - 100.0
}

/**
 * Like percentileRank but INVERTED — lower value = higher score.
 * Used for metrics where lower = better (e.g., turnovers, defensive rating).
 */
export function percentileRankInverted(value: number, population: number[]): number {
  return 100 - percentileRank(value, population)
}

// ─── Min-Max Normalization ────────────────────────────────────────────────────

/**
 * Standard min-max normalization into 0-100 range.
 * Use only when the population is well-behaved (no extreme outliers).
 * Prefer `percentileRank` for most basketball stats.
 */
export function minMaxNormalize100(value: number, population: number[]): number {
  if (population.length === 0) return 50
  const min = Math.min(...population)
  const max = Math.max(...population)
  if (max === min) return 50
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
}

// ─── Z-Score Normalization ────────────────────────────────────────────────────

/**
 * Z-score normalization, then scaled to 0-100 assuming ±3 sigma range.
 * Useful for BPM-style metrics that are already centered around 0.
 */
export function zScoreNormalize100(
  value: number,
  population: number[],
  sigmaRange = 3
): number {
  if (population.length < 2) return 50

  const mean = population.reduce((s, v) => s + v, 0) / population.length
  const variance = population.reduce((s, v) => s + (v - mean) ** 2, 0) / population.length
  const stddev = Math.sqrt(variance)

  if (stddev === 0) return 50

  const z = (value - mean) / stddev
  // Map z from [-sigmaRange, +sigmaRange] → [0, 100]
  const normalized = ((z + sigmaRange) / (2 * sigmaRange)) * 100
  return Math.max(0, Math.min(100, normalized))
}

export function roleAwarePercentileRank(
  value: number,
  roleGroup: "GUARD" | "WING" | "BIG" | null,
  populationByRole: Partial<Record<"GUARD" | "WING" | "BIG", number[]>>,
  fullPopulation: number[],
  minSampleSize = 10
): number {
  if (roleGroup && populationByRole[roleGroup] && populationByRole[roleGroup]!.length >= minSampleSize) {
    return percentileRank(value, populationByRole[roleGroup]!)
  }
  // Fallback to full population
  return percentileRank(value, fullPopulation)
}

// ─── Weighted Average ─────────────────────────────────────────────────────────

/**
 * Computes a weighted average of (value, weight) pairs.
 * Automatically normalizes weights if they don't sum to 1.
 * Returns 0 for empty input.
 */
export function weightedAverage(
  components: Array<{ value: number; weight: number }>
): number {
  if (components.length === 0) return 0

  const totalWeight = components.reduce((s, c) => s + c.weight, 0)
  if (totalWeight === 0) return 0

  return components.reduce((s, c) => s + (c.value * c.weight) / totalWeight, 0)
}

// ─── Clamp ────────────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Clamp to 0-100 score range */
export function clampScore(value: number): number {
  return clamp(Math.round(value * 100) / 100, 0, 100)
}

// ─── Null-Safe Value ──────────────────────────────────────────────────────────

/**
 * Returns `value` if non-null, otherwise returns `fallback`.
 * Used when a stat is missing — falls back to 0 or league average.
 */
export function orDefault(value: number | null | undefined, fallback: number): number {
  return value == null ? fallback : value
}

// ─── Consistency Score ────────────────────────────────────────────────────────

/**
 * Computes a consistency score (0-100) from a game log array.
 * High consistency = low coefficient of variation = high score.
 * Used for scoring/availability reliability.
 */
export function consistencyScore(gameLog: number[], statName?: string): number {
  if (gameLog.length < 5) return 50  // insufficient data = neutral

  const mean = gameLog.reduce((s, v) => s + v, 0) / gameLog.length
  if (mean === 0) return 50

  const variance = gameLog.reduce((s, v) => s + (v - mean) ** 2, 0) / gameLog.length
  const stddev = Math.sqrt(variance)
  const cv = stddev / mean  // coefficient of variation

  // CV of 0 = perfectly consistent = 100
  // CV of 1 = very inconsistent = 0
  // CV of 0.5 = moderate = 50
  // Score = (1 - min(cv, 1)) * 100
  return clampScore((1 - Math.min(cv, 1)) * 100)
}

// ─── 3-Point Volume Weight ────────────────────────────────────────────────────

/**
 * Weights a player's 3P% by their 3-point attempt rate.
 * A player shooting 45% on 1 attempt/game shouldn't rank above
 * a player shooting 40% on 8 attempts/game.
 *
 * Returns a "weighted 3P score" that accounts for both efficiency and volume.
 */
export function weighted3PScore(
  fg3_pct: number | null,
  fg3a_per_g: number | null,
  league_fg3a_population: number[]
): number {
  if (fg3_pct === null || fg3a_per_g === null || fg3a_per_g < 0.5) {
    return 30  // very low volume — penalize to neutral-low
  }

  const efficiencyScore = percentileRank(fg3_pct, [0.25, 0.30, 0.33, 0.35, 0.37, 0.39, 0.42, 0.45])
  const volumeScore = percentileRank(fg3a_per_g, league_fg3a_population)

  // Blend: 60% efficiency, 40% volume
  return clampScore(efficiencyScore * 0.6 + volumeScore * 0.4)
}

// ─── Evidence Shrinkage ───────────────────────────────────────────────────────

/**
 * LPI v1 Evidence Shrinkage.
 * Pulls low-evidence percentiles toward league average (50).
 *
 * Formula: P_shrunk = 50 + (P - 50) * (1 - e^(-Minutes / 1500))
 *
 * @param score - computed score (0-100)
 * @param minutesPlayed - actual minutes played
 */
export function evidenceShrinkage(
  score: number,
  minutesPlayed: number | null
): number {
  if (minutesPlayed === null || minutesPlayed === 0) return 50
  
  const r = 1 - Math.exp(-minutesPlayed / 1500)
  const shrunk = 50 + (score - 50) * r
  return clampScore(shrunk)
}

// ─── Role Groups ──────────────────────────────────────────────────────────────

export type RoleGroup = "GUARD" | "WING" | "BIG"

export function getRoleGroup(position: NBAPosition | null): RoleGroup | null {
  if (!position) return null
  if (position === "PG" || position === "SG") return "GUARD"
  if (position === "SF") return "WING"
  if (position === "PF" || position === "C") return "BIG"
  return null
}

// ─── Population Builder ───────────────────────────────────────────────────────

/**
 * Extracts a numeric column from an array of objects, filtering out nulls.
 * Used to build population arrays for normalization.
 */
export function buildPopulation<T>(
  rows: T[],
  getter: (row: T) => number | null | undefined
): number[] {
  return rows
    .map(getter)
    .filter((v): v is number => v != null && isFinite(v))
}

/**
 * Canonical points-per-100-possessions accessor. The loader only supplies this
 * field from Basketball Reference's `per_poss` rows, which are already a
 * possession-based rate; it never derives it from minutes.
 */
export function pointsPer100Possessions(
  per100: { pts: number | null } | null | undefined
): number | null {
  const value = per100?.pts
  return value != null && Number.isFinite(value) ? value : null
}
