/**
 * NBA Ranking Engine — Defense Score
 *
 * Computes a 0-100 defensive score for a player.
 * Position-aware: guards, wings, and bigs are normalized within GUARD/WING/BIG role groups.
 *
 * Formula:
 *   50% dbpm         — Defensive BPM (league-wide percentile)
 *   20% dws          — Defensive Win Shares (league-wide percentile)
 *   10% stl_pct      — Steal % (role-normalized: GUARD/WING/BIG)
 *   10% blk_pct      — Block % (role-normalized: GUARD/WING/BIG)
 *   10% drb_pct      — Defensive rebound % (role-normalized: GUARD/WING/BIG)
 *
 * Missing metrics: weight is proportionally redistributed among available metrics.
 * A missing metric NEVER contributes a fake 50 at full weight.
 */

import {
  percentileRank,
  roleAwarePercentileRank,
  weightedAverage,
  clampScore,
  evidenceShrinkage,
  getRoleGroup
} from "../normalize"
import { DEFENSE_SCORE_WEIGHTS } from "../config"
import type { PlayerPerGameStats, PlayerAdvancedStats, LeagueMetricContext, NBAPosition } from "../types"

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DefenseScoreInput {
  per_game: PlayerPerGameStats | null
  advanced: PlayerAdvancedStats | null
  position: NBAPosition | null
  minutes_played: number
}

export interface DefenseScoreResult {
  score: number
  dbpm_score: number | null
  dws_score: number | null
  stl_pct_score: number | null
  blk_pct_score: number | null
  drb_pct_score: number | null
  factors_used: string[]
}

export function computeDefenseScore(
  input: DefenseScoreInput,
  league: Pick<
    LeagueMetricContext,
    "dbpm" | "dws" | "drb_pct_by_role" | "stl_pct_by_role" | "blk_pct_by_role" | "drb_pct" | "stl_pct" | "blk_pct"
  >
): DefenseScoreResult {
  const { advanced, position } = input
  const factors_used: string[] = []
  const roleGroup = getRoleGroup(position)
  const minutesPlayed = input.minutes_played

  // ── DBPM (50%) ────────────────────────────────────────────────────────────
  let dbpm_score: number | null = null
  if (advanced?.dbpm != null && league.dbpm.length >= 5) {
    dbpm_score = evidenceShrinkage(percentileRank(advanced.dbpm, league.dbpm), minutesPlayed)
    factors_used.push("dbpm")
  }

  // ── DWS (20%) ─────────────────────────────────────────────────────────────
  let dws_score: number | null = null
  if (advanced?.dws != null && league.dws.length >= 5) {
    dws_score = evidenceShrinkage(percentileRank(advanced.dws, league.dws), minutesPlayed)
    factors_used.push("dws")
  }

  // ── Steal % (10%) — role-normalized ───────────────────────────────────────
  let stl_pct_score: number | null = null
  if (advanced?.stl_pct != null && league.stl_pct.length >= 5) {
    stl_pct_score = evidenceShrinkage(
      roleAwarePercentileRank(advanced.stl_pct, roleGroup, league.stl_pct_by_role, league.stl_pct),
      minutesPlayed
    )
    factors_used.push("stl_pct")
  }

  // ── Block % (10%) — role-normalized ───────────────────────────────────────
  let blk_pct_score: number | null = null
  if (advanced?.blk_pct != null && league.blk_pct.length >= 5) {
    blk_pct_score = evidenceShrinkage(
      roleAwarePercentileRank(advanced.blk_pct, roleGroup, league.blk_pct_by_role, league.blk_pct),
      minutesPlayed
    )
    factors_used.push("blk_pct")
  }

  // ── Defensive Rebound % (10%) — role-normalized ───────────────────────────
  let drb_pct_score: number | null = null
  if (advanced?.drb_pct != null && league.drb_pct.length >= 5) {
    drb_pct_score = evidenceShrinkage(
      roleAwarePercentileRank(advanced.drb_pct, roleGroup, league.drb_pct_by_role, league.drb_pct),
      minutesPlayed
    )
    factors_used.push("drb_pct")
  }

  // ── Proportional Weighted Combination ────────────────────────────────────
  const components: Array<{ value: number; weight: number }> = []
  if (dbpm_score != null)    components.push({ value: dbpm_score,    weight: DEFENSE_SCORE_WEIGHTS.dbpm })
  if (dws_score != null)     components.push({ value: dws_score,     weight: DEFENSE_SCORE_WEIGHTS.dws })
  if (stl_pct_score != null) components.push({ value: stl_pct_score, weight: DEFENSE_SCORE_WEIGHTS.stl_pct })
  if (blk_pct_score != null) components.push({ value: blk_pct_score, weight: DEFENSE_SCORE_WEIGHTS.blk_pct })
  if (drb_pct_score != null) components.push({ value: drb_pct_score, weight: DEFENSE_SCORE_WEIGHTS.drb_pct })

  const score = components.length > 0 ? clampScore(weightedAverage(components)) : 50

  return { score, dbpm_score, dws_score, stl_pct_score, blk_pct_score, drb_pct_score, factors_used }
}
