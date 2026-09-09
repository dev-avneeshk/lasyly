/**
 * NBA Ranking Engine — Shooting Score (Standalone Leaderboard)
 *
 * Measures shooting ability (efficiency and range).
 * NOTE: Standalone leaderboard — metrics may overlap with Overall LPI components.
 *
 * Formula:
 *   35% ts_pct       — True Shooting % (efficiency)
 *   20% efg_pct      — Effective FG%
 *   20% fg3_pct      — 3-Point % (efficiency)
 *   10% ft_pct       — Free Throw % (real league ft_pct population)
 *   15% fg3a_rate    — 3PA / FGA (range / volume)
 *
 * Missing metrics: proportionally redistributed.
 * No synthetic reference arrays — all comparisons use real league populations.
 */

import {
  percentileRank,
  weightedAverage,
  clampScore,
  evidenceShrinkage
} from "../normalize"
import { SHOOTING_SCORE_WEIGHTS } from "../config"
import type { PlayerPerGameStats, PlayerAdvancedStats, LeagueMetricContext } from "../types"

export interface ShootingScoreInput {
  per_game: PlayerPerGameStats | null
  advanced: PlayerAdvancedStats | null
  minutes_played: number
}

export interface ShootingScoreResult {
  score: number
  ts_pct_score: number | null
  efg_pct_score: number | null
  fg3_pct_score: number | null
  ft_pct_score: number | null
  fg3a_rate_score: number | null
  factors_used: string[]
}

export function computeShootingScore(
  input: ShootingScoreInput,
  league: Pick<LeagueMetricContext, "ts_pct" | "efg_pct" | "fg3_pct" | "fg3a_rate" | "ft_pct">
): ShootingScoreResult {
  const { per_game, advanced } = input
  const factors_used: string[] = []
  const minutesPlayed = input.minutes_played

  // ── True Shooting % (35%) ─────────────────────────────────────────────────
  let ts_pct_score: number | null = null
  if (advanced?.ts_pct != null && league.ts_pct.length >= 5) {
    ts_pct_score = evidenceShrinkage(percentileRank(advanced.ts_pct, league.ts_pct), minutesPlayed)
    factors_used.push("ts_pct")
  }

  // ── Effective FG % (20%) ─────────────────────────────────────────────────
  let efg_pct_score: number | null = null
  if (per_game?.efg_pct != null && league.efg_pct && league.efg_pct.length >= 5) {
    efg_pct_score = evidenceShrinkage(percentileRank(per_game.efg_pct, league.efg_pct), minutesPlayed)
    factors_used.push("efg_pct")
  }

  // ── 3-Point % (20%) ───────────────────────────────────────────────────────
  let fg3_pct_score: number | null = null
  if (per_game?.fg3_pct != null && league.fg3_pct && league.fg3_pct.length >= 5) {
    fg3_pct_score = evidenceShrinkage(percentileRank(per_game.fg3_pct, league.fg3_pct), minutesPlayed)
    factors_used.push("fg3_pct")
  }

  // ── Free Throw % (10%) — real league ft_pct population ───────────────────
  // No more synthetic [0.60, 0.65...0.90] array.
  let ft_pct_score: number | null = null
  if (per_game?.ft_pct != null && league.ft_pct && league.ft_pct.length >= 5) {
    ft_pct_score = evidenceShrinkage(percentileRank(per_game.ft_pct, league.ft_pct), minutesPlayed)
    factors_used.push("ft_pct")
  }

  // ── 3PA Rate (15%) ────────────────────────────────────────────────────────
  let fg3a_rate_score: number | null = null
  if (per_game?.fga && per_game.fga > 0) {
    const fg3a_rate = (per_game.fg3a ?? 0) / per_game.fga
    if (league.fg3a_rate && league.fg3a_rate.length >= 5) {
      fg3a_rate_score = evidenceShrinkage(percentileRank(fg3a_rate, league.fg3a_rate), minutesPlayed)
      factors_used.push("fg3a_rate")
    }
  }

  // ── Proportional Weighted Combination ────────────────────────────────────
  const components: Array<{ value: number; weight: number }> = []
  if (ts_pct_score != null)    components.push({ value: ts_pct_score,    weight: SHOOTING_SCORE_WEIGHTS.ts_pct })
  if (efg_pct_score != null)   components.push({ value: efg_pct_score,   weight: SHOOTING_SCORE_WEIGHTS.efg_pct })
  if (fg3_pct_score != null)   components.push({ value: fg3_pct_score,   weight: SHOOTING_SCORE_WEIGHTS.fg3_pct })
  if (ft_pct_score != null)    components.push({ value: ft_pct_score,    weight: SHOOTING_SCORE_WEIGHTS.ft_pct })
  if (fg3a_rate_score != null) components.push({ value: fg3a_rate_score, weight: SHOOTING_SCORE_WEIGHTS.fg3a_rate })

  const score = components.length > 0 ? clampScore(weightedAverage(components)) : 50

  return { score, ts_pct_score, efg_pct_score, fg3_pct_score, ft_pct_score, fg3a_rate_score, factors_used }
}
