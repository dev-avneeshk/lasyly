/**
 * NFL team power rankings.
 *
 * Derives a per-team power score from the scored player pool:
 *   - star_power : the team's best few offensive players
 *   - offense    : mean of the team's top offensive contributors
 *   - defense    : mean of the team's top defensive contributors
 *   - depth      : breadth of above-replacement players on the roster
 * blended into a 0-100 power score, then spread across a readable band and
 * mapped to the shared NBA-style tiers.
 */

import { spreadScores, tierForScore } from "./engine"
import { getNflTeamFullName } from "@/lib/constants/teams"
import type { NflPlayerScore } from "./types"
import type { RankingTier } from "@/lib/rankings/types"

export interface NflTeamRankingRow {
  team: string
  team_full_name: string | null
  season: string
  ranking_version: string
  ranking_type: "power"
  rank: number
  power_score: number
  tier: RankingTier
  previous_rank: number | null
  rank_change: number | null
  offensive_score: number | null
  defensive_score: number | null
  depth_score: number | null
  star_power_score: number | null
  net_score: number | null
  projected_wins: number | null
  is_published: boolean
  published_at: string | null
  explanation: string | null
  why_ranked_here: string | null
  team_class: string | null
}

function mean(vals: number[]): number {
  if (vals.length === 0) return 0
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Build team power rankings from scored players.
 * @param scores       all scored players (from scoreAll)
 * @param season       NFL season year
 * @param version      ranking version
 * @param priorRanks   team → prior rank, for rank_change
 */
export function buildTeamRankings(
  scores: NflPlayerScore[],
  season: string,
  version: string,
  priorRanks: Map<string, number>
): NflTeamRankingRow[] {
  const byTeam = new Map<string, NflPlayerScore[]>()
  for (const s of scores) {
    if (!s.team) continue
    if (!byTeam.has(s.team)) byTeam.set(s.team, [])
    byTeam.get(s.team)!.push(s)
  }

  type Raw = {
    team: string
    offense: number
    defense: number
    depth: number
    star: number
    power: number
  }

  const raws: Raw[] = []
  for (const [team, players] of byTeam) {
    // Only rank real NFL teams (skip stray/empty abbrs).
    if (!team || team === "TBD") continue

    const offensePlayers = players
      .filter((p) => p.position !== "DEF")
      .sort((a, b) => b.offense_score - a.offense_score)
    const defensePlayers = players
      .filter((p) => p.position === "DEF")
      .sort((a, b) => b.defense_score - a.defense_score)

    const offense = round2(mean(offensePlayers.slice(0, 6).map((p) => p.offense_score)))
    const defense = round2(mean(defensePlayers.slice(0, 6).map((p) => p.defense_score)))
    // Star power: the two best players by overall on the team.
    const star = round2(
      mean(
        [...players].sort((a, b) => b.overall_score - a.overall_score).slice(0, 2).map((p) => p.overall_score)
      )
    )
    // Depth: how many players clear a "contributor" bar.
    const contributors = players.filter((p) => p.overall_score >= 55).length
    const depth = round2(Math.min(100, (contributors / 12) * 100))

    const power = round2(star * 0.4 + offense * 0.25 + defense * 0.2 + depth * 0.15)
    raws.push({ team, offense, defense, depth, star, power })
  }

  if (raws.length === 0) return []

  raws.sort((a, b) => b.power - a.power)
  const spread = spreadScores(raws.map((r) => r.power), 45, 99)
  const now = new Date().toISOString()

  return raws.map((r, idx) => {
    const rank = idx + 1
    const prev = priorRanks.get(r.team) ?? null
    const powerScore = spread[idx]
    return {
      team: r.team,
      team_full_name: getNflTeamFullName(r.team),
      season,
      ranking_version: version,
      ranking_type: "power" as const,
      rank,
      power_score: powerScore,
      tier: tierForScore(powerScore),
      previous_rank: prev,
      rank_change: prev !== null ? prev - rank : null,
      offensive_score: r.offense,
      defensive_score: r.defense,
      depth_score: r.depth,
      star_power_score: r.star,
      net_score: round2(r.offense - r.defense),
      projected_wins: null,
      is_published: true,
      published_at: now,
      explanation: `${getNflTeamFullName(r.team)} — star power ${r.star.toFixed(0)}, offense ${r.offense.toFixed(0)}, defense ${r.defense.toFixed(0)}.`,
      why_ranked_here: null,
      team_class: null,
    }
  })
}
