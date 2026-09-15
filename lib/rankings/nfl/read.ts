/**
 * NFL rankings read layer for GET /api/rankings?sport=NFL.
 *
 * Returns the shared RankingListResponse shape so the existing rankings UI can
 * render NFL players without a bespoke card. NFL-specific subscores are mapped
 * onto the shared fields (offense/defense/scoring/playmaking/two_way); fields
 * NBA has but NFL doesn't (age, historical_team, player_class, potential,
 * ceiling) are returned as null.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import type {
  RankingListItem,
  RankingListResponse,
  RankingTier,
  RankingType,
} from "@/lib/rankings/types"

export const NFL_RANKING_TYPES = [
  "overall",
  "offense",
  "defense",
  "scoring",
  "playmaking",
] as const

export type NflRankingType = (typeof NFL_RANKING_TYPES)[number]

export function isNflRankingType(type: string): type is NflRankingType {
  return (NFL_RANKING_TYPES as readonly string[]).includes(type)
}

/** Resolve the current NFL season (year). */
export function currentNflSeason(): string {
  return String(new Date().getUTCFullYear())
}

export async function getNflRankings(params: {
  season: string
  type: NflRankingType
  limit: number
  offset: number
}): Promise<RankingListResponse> {
  const { season, type, limit, offset } = params
  const supabase = createAdminClient()

  // Latest published version for this season.
  const { data: versionRow } = await supabase
    .from("nfl_ranking_versions")
    .select("ranking_version")
    .eq("season", season)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const rankingVersion = (versionRow as any)?.ranking_version as string | undefined

  if (!rankingVersion) {
    return {
      season,
      ranking_type: type as RankingType,
      ranking_version: "none",
      total: 0,
      rankings: [],
    }
  }

  const { data: rows, error } = await supabase
    .from("nfl_player_rankings")
    .select(
      "rank, player_name, athlete_id, team, position, score, tier, previous_rank, rank_change, is_new, is_published, confidence, low_confidence, offense_score, defense_score, scoring_score, playmaking_score, efficiency_score, two_way_score, explanation, strengths, weaknesses, signature, status, games_played"
    )
    .eq("season", season)
    .eq("ranking_type", type)
    .eq("ranking_version", rankingVersion)
    .order("rank", { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error("[rankings:nfl] DB error:", error.message)
    throw new Error(error.message)
  }

  const { count } = await supabase
    .from("nfl_player_rankings")
    .select("rank", { count: "exact", head: true })
    .eq("season", season)
    .eq("ranking_type", type)
    .eq("ranking_version", rankingVersion)

  const rankings: RankingListItem[] = (rows ?? []).map((row: any) => ({
    rank: row.rank,
    player_name: row.player_name,
    // athlete_id is the ESPN id; expose it as player_id so the UI can build a
    // detail link / headshot key just like NBA player_id.
    player_id: row.athlete_id ?? null,
    team: row.team,
    historical_team: null,
    position: row.position,
    age: null,
    score: Number(row.score),
    tier: row.tier as RankingTier,
    previous_rank: row.previous_rank,
    rank_change: row.rank_change,
    is_new: row.is_new,
    is_published: row.is_published,
    confidence: row.confidence != null ? Number(row.confidence) * 100 : null,
    low_confidence: row.low_confidence,
    offense_score: row.offense_score != null ? Number(row.offense_score) : null,
    defense_score: row.defense_score != null ? Number(row.defense_score) : null,
    scoring_score: row.scoring_score != null ? Number(row.scoring_score) : null,
    playmaking_score: row.playmaking_score != null ? Number(row.playmaking_score) : null,
    // NFL has no rebounding/shooting; surface efficiency in the two_way slot.
    rebounding_score: null,
    shooting_score: row.efficiency_score != null ? Number(row.efficiency_score) : null,
    two_way_score: row.two_way_score != null ? Number(row.two_way_score) : null,
    explanation: row.explanation,
    strengths: row.strengths,
    weaknesses: row.weaknesses,
    signature: row.signature,
    player_class: null,
    potential: null,
    ceiling: null,
    status: row.status,
  }))

  return {
    season,
    ranking_type: type as RankingType,
    ranking_version: rankingVersion,
    total: count ?? rankings.length,
    rankings,
  }
}

// ─── NFL team rankings read ────────────────────────────────────────────────

import type { TeamRankingListItem, TeamRankingListResponse } from "@/lib/rankings/types"

export async function getNflTeamRankings(season: string): Promise<TeamRankingListResponse> {
  const supabase = createAdminClient()

  const { data: versionRow } = await supabase
    .from("nfl_ranking_versions")
    .select("ranking_version")
    .eq("season", season)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const rankingVersion = (versionRow as any)?.ranking_version as string | undefined

  if (!rankingVersion) {
    return { season, ranking_version: "none", total: 0, rankings: [] }
  }

  const { data: rows, error } = await supabase
    .from("nfl_team_rankings")
    .select(
      "rank, team, team_full_name, power_score, tier, previous_rank, rank_change, offensive_score, defensive_score, depth_score, star_power_score, projected_wins, explanation, why_ranked_here, team_class"
    )
    .eq("season", season)
    .eq("ranking_type", "power")
    .eq("ranking_version", rankingVersion)
    .order("rank", { ascending: true })

  if (error) {
    console.error("[rankings:nfl-teams] DB error:", error.message)
    throw new Error(error.message)
  }

  const rankings: TeamRankingListItem[] = (rows ?? []).map((row: any) => ({
    rank: row.rank,
    team: row.team,
    team_full_name: row.team_full_name,
    power_score: Number(row.power_score),
    tier: row.tier,
    offensive_score: row.offensive_score != null ? Number(row.offensive_score) : null,
    defensive_score: row.defensive_score != null ? Number(row.defensive_score) : null,
    depth_score: row.depth_score != null ? Number(row.depth_score) : null,
    star_power_score: row.star_power_score != null ? Number(row.star_power_score) : null,
    previous_rank: row.previous_rank,
    rank_change: row.rank_change,
    projected_wins: row.projected_wins != null ? Number(row.projected_wins) : null,
    key_additions: null,
    key_losses: null,
    explanation: row.explanation,
    team_class: row.team_class,
  }))

  return { season, ranking_version: rankingVersion, total: rankings.length, rankings }
}
