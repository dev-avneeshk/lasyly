/**
 * NBA Ranking Engine — Playmaking Score
 *
 * Measures passing and playmaking ability.
 *
 * Formula (LPI v2.1):
 *   70% ast_pct      — Assist % (% of teammate FG assisted while on court)
 *   30% ast_tov      — Assist to Turnover Ratio
 *
 * PGA (Potential Game Assists) was removed: it is an NBA.com tracking stat that
 * Basketball Reference does not publish, so it was NULL for the entire league
 * and its weight was always redistributed anyway. Keeping it as config gave a
 * false impression that a real third factor existed. The former 30% pga weight
 * is folded into ast_pct.
 */

import { percentileRank, weightedAverage, clampScore, evidenceShrinkage } from "../normalize"
import { PLAYMAKING_SCORE_WEIGHTS } from "../config"
import type { PlayerPerGameStats, PlayerAdvancedStats, LeagueMetricContext } from "../types"

export interface PlaymakingScoreInput {
  per_game: PlayerPerGameStats | null
  advanced: PlayerAdvancedStats | null
  minutes_played: number
}

export interface PlaymakingScoreResult {
  score: number
  ast_pct_score: number | null
  ast_tov_score: number | null
  factors_used: string[]
}

export function computePlaymakingScore(
  input: PlaymakingScoreInput,
  league: Pick<LeagueMetricContext, "ast_pct" | "ast_tov">
): PlaymakingScoreResult {
  const { advanced } = input
  const factors_used: string[] = []

  const minutesPlayed = input.minutes_played

  // ── Assist % (70%) ───────────────────────────────────────────────────────
  const ast_pct = advanced?.ast_pct
  let ast_pct_score: number | null = null
  if (ast_pct != null && league.ast_pct.length >= 5) {
    ast_pct_score = evidenceShrinkage(percentileRank(ast_pct, league.ast_pct), minutesPlayed)
    factors_used.push("ast_pct")
  }

  // ── Assist to Turnover Ratio (30%) ─────────────────────────────────────────
  const ast_tov = advanced?.ast_tov
  let ast_tov_score: number | null = null
  if (ast_tov != null && league.ast_tov.length >= 5) {
    ast_tov_score = evidenceShrinkage(percentileRank(ast_tov, league.ast_tov), minutesPlayed)
    factors_used.push("ast_tov")
  }

  // Only valid metrics enter the score; weightedAverage redistributes their
  // configured weights proportionally. Missing data never becomes a full-weight 50.
  const components: Array<{ value: number; weight: number }> = []
  if (ast_pct_score != null) components.push({ value: ast_pct_score, weight: PLAYMAKING_SCORE_WEIGHTS.ast_pct })
  if (ast_tov_score != null) components.push({ value: ast_tov_score, weight: PLAYMAKING_SCORE_WEIGHTS.ast_tov })
  const score = components.length > 0 ? clampScore(weightedAverage(components)) : 50

  return { score, ast_pct_score, ast_tov_score, factors_used }
}
