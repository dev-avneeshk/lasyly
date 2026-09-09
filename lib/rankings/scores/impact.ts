/**
 * NBA Ranking Engine — Impact Score (LPI v2)
 *
 * Measures total two-way value produced, NOT per-minute rate alone.
 *
 * This component exists to fix a structural flaw in LPI v1: every v1 component
 * was a rate or percentage percentile (BPM, TS%, USG%, per-100, stl%, blk%,
 * drb%, ast%). Averaging only rates lets a 22-minute bench player compete
 * head-to-head with a 35-minute franchise guard, because nothing in the score
 * rewarded producing that value across a full workload.
 *
 * VORP is the anchor here: it is BPM scaled by minutes played, so it cannot be
 * inflated by a small efficient sample. WS/48 and BPM supply the rate view so
 * that high-minute, low-quality players don't rise on volume alone.
 *
 * Formula:
 *   45% bpm        — Box Plus/Minus percentile (rate view of two-way impact)
 *   35% vorp       — Value Over Replacement Player (volume-inclusive)
 *   20% ws_per_48  — Win Shares per 48 (efficiency of contribution)
 *
 * Missing metrics: weight is proportionally redistributed among available
 * metrics. A missing metric NEVER contributes a fake 50 at full weight.
 */

import { percentileRank, weightedAverage, clampScore, evidenceShrinkage } from "../normalize"
import { IMPACT_SCORE_WEIGHTS } from "../config"
import type { PlayerAdvancedStats, LeagueMetricContext } from "../types"

export interface ImpactScoreInput {
  advanced: PlayerAdvancedStats | null
  minutes_played: number
}

export interface ImpactScoreResult {
  score: number
  bpm_score: number | null
  vorp_score: number | null
  ws_per_48_score: number | null
  factors_used: string[]
}

export function computeImpactScore(
  input: ImpactScoreInput,
  league: Pick<LeagueMetricContext, "bpm" | "vorp" | "ws_per_48">
): ImpactScoreResult {
  const { advanced } = input
  const factors_used: string[] = []
  const minutesPlayed = input.minutes_played

  // ── BPM (45%) ─────────────────────────────────────────────────────────────
  let bpm_score: number | null = null
  if (advanced?.bpm != null && league.bpm.length >= 5) {
    bpm_score = evidenceShrinkage(percentileRank(advanced.bpm, league.bpm), minutesPlayed)
    factors_used.push("bpm")
  }

  // ── VORP (35%) ────────────────────────────────────────────────────────────
  // Deliberately NOT shrunk: VORP already embeds minutes played, so applying
  // evidence shrinkage on top would double-count the same sample-size signal.
  let vorp_score: number | null = null
  if (advanced?.vorp != null && league.vorp.length >= 5) {
    vorp_score = percentileRank(advanced.vorp, league.vorp)
    factors_used.push("vorp")
  }

  // ── WS/48 (20%) ───────────────────────────────────────────────────────────
  let ws_per_48_score: number | null = null
  if (advanced?.ws_per_48 != null && league.ws_per_48.length >= 5) {
    ws_per_48_score = evidenceShrinkage(
      percentileRank(advanced.ws_per_48, league.ws_per_48),
      minutesPlayed
    )
    factors_used.push("ws_per_48")
  }

  const components: Array<{ value: number; weight: number }> = []
  if (bpm_score != null)       components.push({ value: bpm_score,       weight: IMPACT_SCORE_WEIGHTS.bpm })
  if (vorp_score != null)      components.push({ value: vorp_score,      weight: IMPACT_SCORE_WEIGHTS.vorp })
  if (ws_per_48_score != null) components.push({ value: ws_per_48_score, weight: IMPACT_SCORE_WEIGHTS.ws_per_48 })

  const score = components.length > 0 ? clampScore(weightedAverage(components)) : 50

  return { score, bpm_score, vorp_score, ws_per_48_score, factors_used }
}
