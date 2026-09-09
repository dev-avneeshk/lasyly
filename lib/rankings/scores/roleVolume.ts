/**
 * NBA Ranking Engine — Role & Volume Score (LPI v2)
 *
 * Measures how much a team actually trusted this player: total workload
 * absorbed across the season.
 *
 * Rationale: rate stats answer "how good was he per minute?" but a ranking of
 * PLAYERS must also answer "how much did he actually do?". A 22-minute reserve
 * and a 35-minute primary option are not interchangeable even at identical
 * per-minute efficiency, because minutes are a scarce resource coaches allocate
 * to the players who can hold up against starters.
 *
 * This component is intentionally NOT run through evidence shrinkage. Shrinkage
 * exists to discount small samples; here the sample size IS the signal being
 * measured, so shrinking it would cancel the term out entirely.
 *
 * Formula:
 *   60% total_minutes  — season minutes percentile (workload actually absorbed)
 *   40% minutes_per_g  — role size when active (starter vs reserve)
 *
 * Note: this is distinct from availability_score, which is durability metadata
 * (games played / 82) and never enters LPI. This term is about role weight.
 */

import { percentileRank, weightedAverage, clampScore } from "../normalize"
import { ROLE_VOLUME_SCORE_WEIGHTS } from "../config"
import type { LeagueMetricContext } from "../types"

export interface RoleVolumeScoreInput {
  minutes_played: number
  minutes_per_game: number
}

export interface RoleVolumeScoreResult {
  score: number
  total_minutes_score: number | null
  minutes_per_game_score: number | null
  factors_used: string[]
}

export function computeRoleVolumeScore(
  input: RoleVolumeScoreInput,
  league: Pick<LeagueMetricContext, "minutes_played" | "minutes_per_game">
): RoleVolumeScoreResult {
  const factors_used: string[] = []

  let total_minutes_score: number | null = null
  if (Number.isFinite(input.minutes_played) && league.minutes_played.length >= 5) {
    total_minutes_score = percentileRank(input.minutes_played, league.minutes_played)
    factors_used.push("total_minutes")
  }

  let minutes_per_game_score: number | null = null
  if (Number.isFinite(input.minutes_per_game) && league.minutes_per_game.length >= 5) {
    minutes_per_game_score = percentileRank(input.minutes_per_game, league.minutes_per_game)
    factors_used.push("minutes_per_game")
  }

  const components: Array<{ value: number; weight: number }> = []
  if (total_minutes_score != null) {
    components.push({ value: total_minutes_score, weight: ROLE_VOLUME_SCORE_WEIGHTS.total_minutes })
  }
  if (minutes_per_game_score != null) {
    components.push({ value: minutes_per_game_score, weight: ROLE_VOLUME_SCORE_WEIGHTS.minutes_per_game })
  }

  const score = components.length > 0 ? clampScore(weightedAverage(components)) : 50

  return { score, total_minutes_score, minutes_per_game_score, factors_used }
}
