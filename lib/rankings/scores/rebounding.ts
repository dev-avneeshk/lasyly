/**
 * NBA Ranking Engine — Rebounding Score
 *
 * Measures rebounding ability, normalized by role group.
 *
 * Formula:
 *   55% trb_pct      — Total Rebound % (role-normalized)
 *   25% drb_pct      — Defensive Rebound % (role-normalized)
 *   20% orb_pct      — Offensive Rebound % (role-normalized)
 */

import {
  roleAwarePercentileRank,
  weightedAverage,
  clampScore,
  evidenceShrinkage,
  getRoleGroup
} from "../normalize"
import { REBOUNDING_SCORE_WEIGHTS } from "../config"
import type { PlayerPerGameStats, PlayerAdvancedStats, LeagueMetricContext, NBAPosition } from "../types"

export interface ReboundingScoreInput {
  per_game: PlayerPerGameStats | null
  advanced: PlayerAdvancedStats | null
  position: NBAPosition | null
  minutes_played: number
}

export interface ReboundingScoreResult {
  score: number
  trb_pct_score: number
  drb_pct_score: number
  orb_pct_score: number
  factors_used: string[]
}

export function computeReboundingScore(
  input: ReboundingScoreInput,
  league: Pick<LeagueMetricContext, "trb_pct_by_role" | "drb_pct_by_role" | "orb_pct_by_role" | "trb_pct" | "drb_pct" | "orb_pct">
): ReboundingScoreResult {
  const { advanced, per_game, position } = input
  const factors_used: string[] = []
  const roleGroup = getRoleGroup(position)
  
  const minutesPlayed = input.minutes_played

  // ── Total Rebound % (55%) ──────────────────────────────────────────────────
  const trb_pct = advanced?.trb_pct
  let trb_pct_score = 50
  if (trb_pct != null && league.trb_pct.length >= 5) {
    trb_pct_score = evidenceShrinkage(
      roleAwarePercentileRank(trb_pct, roleGroup, league.trb_pct_by_role, league.trb_pct),
      minutesPlayed
    )
    factors_used.push("trb_pct")
  }

  // ── Defensive Rebound % (25%) ─────────────────────────────────────────────
  const drb_pct = advanced?.drb_pct
  let drb_pct_score = 50
  if (drb_pct != null && league.drb_pct.length >= 5) {
    drb_pct_score = evidenceShrinkage(
      roleAwarePercentileRank(drb_pct, roleGroup, league.drb_pct_by_role, league.drb_pct),
      minutesPlayed
    )
    factors_used.push("drb_pct")
  }

  // ── Offensive Rebound % (20%) ─────────────────────────────────────────────
  const orb_pct = advanced?.orb_pct
  let orb_pct_score = 50
  if (orb_pct != null && league.orb_pct.length >= 5) {
    orb_pct_score = evidenceShrinkage(
      roleAwarePercentileRank(orb_pct, roleGroup, league.orb_pct_by_role, league.orb_pct),
      minutesPlayed
    )
    factors_used.push("orb_pct")
  }

  // ── Weighted Combination ──────────────────────────────────────────────────
  const score = clampScore(
    weightedAverage([
      { value: trb_pct_score, weight: REBOUNDING_SCORE_WEIGHTS.trb_pct },
      { value: drb_pct_score, weight: REBOUNDING_SCORE_WEIGHTS.drb_pct },
      { value: orb_pct_score, weight: REBOUNDING_SCORE_WEIGHTS.orb_pct },
    ])
  )

  return { score, trb_pct_score, drb_pct_score, orb_pct_score, factors_used }
}
