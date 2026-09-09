/**
 * NBA Ranking Engine — Team Power Score (LPI v1)
 *
 * Full rewrite from the old starter/rotation/bench model (rejected).
 * Implements the P1-P8 diminishing coefficient model per spec §23-§29.
 *
 * Formula:
 *   TeamPower = 0.60*CORE + 0.15*DEPTH + 0.10*STAR + 0.10*TEAM_AVAIL + 0.05*CONTINUITY
 *
 * Where:
 *   CORE       = weighted sum of top-8 players using P1-P8 coefficients (normalized to 0-100)
 *   DEPTH      = same formula applied to players 4-8 (P4-P8 slots), normalized to 0-100
 *   STAR       = min(10, sum of max(0, score - 85) for top 3 players) * 10 → 0-100
 *   TEAM_AVAIL = weighted average of top-8 availability scores by player value
 *   CONTINUITY = weighted average continuity by projected player value
 */

import { TEAM_POWER_WEIGHTS, ROSTER_SLOT_WEIGHTS, ROSTER_SLOT_DENOMINATOR } from "../config"
import { clampScore, weightedAverage } from "../normalize"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamPlayerInput {
  player_name: string
  projected_score: number      // 0-100 LPI score
  availability_score: number   // 0-100
  is_returning: boolean        // played for team last season
}

export interface TeamPowerResult {
  team: string
  team_power_score: number     // 0-100
  core_score: number
  depth_score: number
  star_score: number
  team_avail_score: number
  continuity_score: number
  player_count: number
}

// ─── Main Computation ─────────────────────────────────────────────────────────

/**
 * Computes Team Power for a single team.
 * Players are sorted descending by projected_score before slot assignment.
 */
export function computeTeamPower(team: string, players: TeamPlayerInput[]): TeamPowerResult {
  if (players.length === 0) {
    return { team, team_power_score: 0, core_score: 0, depth_score: 0, star_score: 0, team_avail_score: 0, continuity_score: 0, player_count: 0 }
  }

  // Sort by projected score descending — rank order determines slot assignment
  const sorted = [...players].sort((a, b) => b.projected_score - a.projected_score)

  // Take up to 8 players
  const top8 = sorted.slice(0, 8)

  // ── CORE: P1-P8 weighted sum, normalized to 0-100 ─────────────────────────
  // core_raw = sum(P_i * score_i) where P_i from ROSTER_SLOT_WEIGHTS
  // Theoretical max = 100 * sum(P_i) = 100 * ROSTER_SLOT_DENOMINATOR
  // Normalize: core = core_raw / ROSTER_SLOT_DENOMINATOR
  const core_raw = top8.reduce((sum, player, i) => {
    const w = ROSTER_SLOT_WEIGHTS[i] ?? 0
    return sum + w * player.projected_score
  }, 0)
  const core_score = clampScore(core_raw / ROSTER_SLOT_DENOMINATOR)

  // ── DEPTH: P4-P8 players only (slots 3-7 in 0-indexed), normalized ─────────
  // Uses same P4-P8 coefficients and normalizes by sum(P4..P8) = 0.64+0.55+0.48+0.42+0.37 = 2.46
  const depth_players = top8.slice(3)  // players ranked 4-8
  const depth_coeff = ROSTER_SLOT_WEIGHTS.slice(3)
  const depth_sum = depth_coeff.reduce((s, w) => s + w, 0)  // ≈ 2.46
  const depth_raw = depth_players.reduce((sum, player, i) => {
    const w = depth_coeff[i] ?? 0
    return sum + w * player.projected_score
  }, 0)
  const depth_score = depth_sum > 0 ? clampScore(depth_raw / depth_sum) : 0

  // ── STAR: sum of individual "star value" for each qualifying player ─────────
  // STAR_i = max(0, score_i - 85)
  // STAR_total = min(10, sum(STAR_i) / 2)   (divide by 2 to normalize stars)
  // Converted to 0-100 scale: star_score = STAR_total * 10
  const star_raw = top8.reduce((sum, player) => sum + Math.max(0, player.projected_score - 85), 0)
  const star_total = Math.min(10, star_raw / 2)
  const star_score = clampScore(star_total * 10)  // 0-100

  // ── TEAM AVAILABILITY: weighted by player value using P1-P8 coefficients ───
  // Not a simple average — star players' availability matters more.
  const avail_components = top8.map((player, i) => ({
    value: player.availability_score,
    weight: ROSTER_SLOT_WEIGHTS[i] ?? 0,
  }))
  const team_avail_score = clampScore(weightedAverage(avail_components))

  // ── CONTINUITY: proportion of roster value held by returning players ────────
  // continuity = sum(P_i * is_returning_i) / sum(P_i) for top-8
  const continuity_num = top8.reduce((sum, player, i) => {
    const w = ROSTER_SLOT_WEIGHTS[i] ?? 0
    return sum + (player.is_returning ? w : 0)
  }, 0)
  const continuity_denom = top8.reduce((sum, _, i) => sum + (ROSTER_SLOT_WEIGHTS[i] ?? 0), 0)
  const continuity_score = continuity_denom > 0 ? clampScore((continuity_num / continuity_denom) * 100) : 0

  // ── Final TeamPower composite ──────────────────────────────────────────────
  const team_power_score = clampScore(
    weightedAverage([
      { value: core_score,       weight: TEAM_POWER_WEIGHTS.core },
      { value: depth_score,      weight: TEAM_POWER_WEIGHTS.depth },
      { value: star_score,       weight: TEAM_POWER_WEIGHTS.star },
      { value: team_avail_score, weight: TEAM_POWER_WEIGHTS.teamAvail },
      { value: continuity_score, weight: TEAM_POWER_WEIGHTS.continuity },
    ])
  )

  return {
    team,
    team_power_score,
    core_score,
    depth_score,
    star_score,
    team_avail_score,
    continuity_score,
    player_count: players.length,
  }
}

// ─── Multi-Team Aggregation ───────────────────────────────────────────────────

/**
 * Computes Team Power for all teams from a flat array of player rankings.
 * Each player must have a `team` field.
 */
export function computeAllTeamPower(
  players: (TeamPlayerInput & { team: string })[]
): Map<string, TeamPowerResult> {
  const byTeam = new Map<string, TeamPlayerInput[]>()
  for (const p of players) {
    if (!byTeam.has(p.team)) byTeam.set(p.team, [])
    byTeam.get(p.team)!.push(p)
  }

  const results = new Map<string, TeamPowerResult>()
  for (const [team, teamPlayers] of byTeam) {
    results.set(team, computeTeamPower(team, teamPlayers))
  }
  return results
}
