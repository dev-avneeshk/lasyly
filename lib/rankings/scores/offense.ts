/**
 * NBA Ranking Engine — Offense Score
 *
 * Computes a 0-100 offensive score for a player.
 * Higher = more offensively impactful player.
 *
 * Formula (weights from config.ts):
 *   40% obpm         — Offensive BPM percentile
 *   25% ts_pct       — True Shooting % percentile
 *   20% usg_pct      — Usage rate percentile
 *   15% pts_per_100   — Points per 36 minutes percentile
 *                      (schema gate: no per_100 data in DB; per_100 is the best available)
 *
 * Missing metrics: weight is proportionally redistributed among available metrics.
 * A missing metric NEVER contributes a fake 50 at full weight.
 */

import { percentileRank, weightedAverage, clampScore, evidenceShrinkage, pointsPer100Possessions } from "../normalize"
import { OFFENSE_SCORE_WEIGHTS } from "../config"
import type { PlayerPerGameStats, PlayerAdvancedStats, PlayerPer100Stats, LeagueMetricContext } from "../types"

// ─── Public API ───────────────────────────────────────────────────────────────

export interface OffenseScoreInput {
  per_game: PlayerPerGameStats | null
  advanced: PlayerAdvancedStats | null
  per_100: PlayerPer100Stats | null
  minutes_played: number
}

export interface OffenseScoreResult {
  score: number        // 0-100
  obpm_score: number | null
  ts_pct_score: number | null
  usg_score: number | null
  pts_per_100_score: number | null
  factors_used: string[]
}

/**
 * Computes the offensive score for a single player.
 * Uses proportional weight redistribution for any missing metrics.
 */
export function computeOffenseScore(
  input: OffenseScoreInput,
  league: Pick<LeagueMetricContext, "obpm" | "ts_pct" | "pts_per_100" | "usg_pct">
): OffenseScoreResult {
  const { advanced } = input
  const factors_used: string[] = []
  const minutesPlayed = input.minutes_played

  // ── OBPM (40%) ────────────────────────────────────────────────────────────
  let obpm_score: number | null = null
  if (advanced?.obpm != null && league.obpm.length >= 5) {
    obpm_score = evidenceShrinkage(percentileRank(advanced.obpm, league.obpm), minutesPlayed)
    factors_used.push("obpm")
  }

  // ── True Shooting % (25%) ────────────────────────────────────────────────
  let ts_pct_score: number | null = null
  if (advanced?.ts_pct != null && league.ts_pct.length >= 5) {
    ts_pct_score = evidenceShrinkage(percentileRank(advanced.ts_pct, league.ts_pct), minutesPlayed)
    factors_used.push("ts_pct")
  }

  // ── Usage Rate (20%) ──────────────────────────────────────────────────────
  let usg_score: number | null = null
  if (advanced?.usg_pct != null && league.usg_pct.length >= 5) {
    usg_score = evidenceShrinkage(percentileRank(advanced.usg_pct, league.usg_pct), minutesPlayed)
    factors_used.push("usg_pct")
  }

  // ── Points Per 100 Possessions (15%) ──────────────────────────────────────
  let pts_per_100_score: number | null = null
  const ptsPer100 = pointsPer100Possessions(input.per_100)
  if (ptsPer100 != null && league.pts_per_100.length >= 5) {
    pts_per_100_score = evidenceShrinkage(percentileRank(ptsPer100, league.pts_per_100), minutesPlayed)
    factors_used.push("pts_per_100")
  }

  // ── Proportional Weighted Combination ────────────────────────────────────
  // Only include metrics that are actually available.
  // Do NOT default a missing metric to 50 at full weight.
  const components: Array<{ value: number; weight: number }> = []
  if (obpm_score != null)    components.push({ value: obpm_score,    weight: OFFENSE_SCORE_WEIGHTS.obpm })
  if (ts_pct_score != null)  components.push({ value: ts_pct_score,  weight: OFFENSE_SCORE_WEIGHTS.ts_pct })
  if (usg_score != null)     components.push({ value: usg_score,     weight: OFFENSE_SCORE_WEIGHTS.usg_pct })
  if (pts_per_100_score != null) components.push({ value: pts_per_100_score, weight: OFFENSE_SCORE_WEIGHTS.pts_per_100 })

  // weightedAverage() automatically normalizes the remaining weights to sum to 1.
  const score = components.length > 0 ? clampScore(weightedAverage(components)) : 50

  return { score, obpm_score, ts_pct_score, usg_score, pts_per_100_score, factors_used }
}
