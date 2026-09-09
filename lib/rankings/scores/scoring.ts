/**
 * NBA Ranking Engine — Scoring Score (Standalone Leaderboard)
 *
 * Measures pure scoring ability: volume + efficiency + consistency.
 * NOTE: Standalone leaderboard — metrics may overlap with Overall LPI components.
 * Metric ownership rules apply only to paths feeding LPI Overall.
 *
 * Formula:
 *   35% volume          — pts_per_100 percentile (real league population)
 *   30% ts_pct          — True Shooting % (efficiency)
 *   15% fg3_pct         — 3-Point %
 *   10% ft_creation     — FTA per game (real league fta_per_g population)
 *   10% consistency     — low variance in game log
 *
 * Missing metrics: proportionally redistributed.
 */

import {
  percentileRank,
  weightedAverage,
  consistencyScore,
  clampScore,
  evidenceShrinkage,
  pointsPer100Possessions
} from "../normalize"
import { SCORING_SCORE_WEIGHTS } from "../config"
import type { PlayerPerGameStats, PlayerAdvancedStats, PlayerPer100Stats, LeagueMetricContext } from "../types"

export interface ScoringScoreInput {
  per_game: PlayerPerGameStats | null
  advanced: PlayerAdvancedStats | null
  per_100: PlayerPer100Stats | null
  game_log_pts: number[]  // most recent first, used for consistency
  minutes_played: number
}

export interface ScoringScoreResult {
  score: number
  volume_score: number | null
  ts_pct_score: number | null
  fg3_pct_score: number | null
  ft_creation_score: number | null
  consistency: number | null
  factors_used: string[]
}

export function computeScoringScore(
  input: ScoringScoreInput,
  league: Pick<LeagueMetricContext, "pts_per_100" | "ts_pct" | "fg3_pct" | "fta_per_g">
): ScoringScoreResult {
  const { per_game, advanced, game_log_pts } = input
  const factors_used: string[] = []
  const minutesPlayed = input.minutes_played

  // ── Volume (35%) — pts_per_100 ─────────────────────────────────────────────
  let volume_score: number | null = null
  const ptsPer100 = pointsPer100Possessions(input.per_100)
  if (ptsPer100 != null && league.pts_per_100.length >= 5) {
    volume_score = evidenceShrinkage(percentileRank(ptsPer100, league.pts_per_100), minutesPlayed)
    factors_used.push("pts_per_100")
  }

  // ── True Shooting % (30%) ─────────────────────────────────────────────────
  let ts_pct_score: number | null = null
  if (advanced?.ts_pct != null && league.ts_pct.length >= 5) {
    ts_pct_score = evidenceShrinkage(percentileRank(advanced.ts_pct, league.ts_pct), minutesPlayed)
    factors_used.push("ts_pct")
  }

  // ── 3-Point % (15%) ───────────────────────────────────────────────────────
  let fg3_pct_score: number | null = null
  if (per_game?.fg3_pct != null && league.fg3_pct && league.fg3_pct.length >= 5) {
    fg3_pct_score = evidenceShrinkage(percentileRank(per_game.fg3_pct, league.fg3_pct), minutesPlayed)
    factors_used.push("fg3_pct")
  }

  // ── FT Creation (10%) — real league fta_per_g population ─────────────────
  // No more synthetic [0,1,2,...10] array.
  let ft_creation_score: number | null = null
  if (per_game?.fta != null && league.fta_per_g && league.fta_per_g.length >= 5) {
    ft_creation_score = evidenceShrinkage(percentileRank(per_game.fta, league.fta_per_g), minutesPlayed)
    factors_used.push("ft_creation")
  }

  // ── Consistency (10%) ─────────────────────────────────────────────────────
  let consistency: number | null = null
  if (game_log_pts.length >= 5) {
    consistency = consistencyScore(game_log_pts.slice(0, 20))
    factors_used.push("consistency")
  }

  // ── Proportional Weighted Combination ────────────────────────────────────
  const components: Array<{ value: number; weight: number }> = []
  if (volume_score != null)     components.push({ value: volume_score,     weight: SCORING_SCORE_WEIGHTS.volume })
  if (ts_pct_score != null)     components.push({ value: ts_pct_score,     weight: SCORING_SCORE_WEIGHTS.ts_pct })
  if (fg3_pct_score != null)    components.push({ value: fg3_pct_score,    weight: SCORING_SCORE_WEIGHTS.fg3_pct })
  if (ft_creation_score != null)components.push({ value: ft_creation_score,weight: SCORING_SCORE_WEIGHTS.ft_creation })
  if (consistency != null)      components.push({ value: consistency,      weight: SCORING_SCORE_WEIGHTS.consistency })

  const score = components.length > 0 ? clampScore(weightedAverage(components)) : 50

  return { score, volume_score, ts_pct_score, fg3_pct_score, ft_creation_score, consistency, factors_used }
}
