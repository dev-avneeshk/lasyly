/**
 * NBA rankings read layer.
 *
 * Extracted from the inline logic that used to live in `app/api/rankings/route.ts`
 * so it can be shared between the API handler and server components that want to
 * prefetch rankings during render (e.g. the /rankings page shell). Keeping a
 * single implementation means the cache key, query shape, and mapping stay in
 * lockstep across both callers.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import type { RankingListResponse, RankingListItem, RankingType } from "@/lib/rankings/types"

export interface NbaRankingsParams {
  season: string
  mode: "historical" | "projected"
  type: RankingType
  limit: number
  offset: number
  publishedOnly: boolean
}

/**
 * The ranking version readers show for a season + mode: the latest published
 * one, else the latest generated draft (useful during dev); null if none.
 */
export async function activeNbaRankingVersion(
  supabase: ReturnType<typeof createAdminClient>,
  season: string,
  mode: NbaRankingsParams["mode"]
): Promise<string | null> {
  const latest = (published: boolean) => {
    let q = supabase
      .from("nba_ranking_versions")
      .select("ranking_version")
      .eq("season", season)
      .eq("ranking_mode", mode)
    if (published) q = q.eq("status", "published")
    return q.order(published ? "published_at" : "generated_at", { ascending: false }).limit(1).maybeSingle()
  }
  const { data: published } = await latest(true)
  if (published?.ranking_version) return published.ranking_version as string
  const { data: draft } = await latest(false)
  return (draft?.ranking_version as string | undefined) ?? null
}

/**
 * Read a page of NBA player rankings straight from the DB. This is the raw
 * fetcher; callers are expected to wrap it in the `cached()` helper (as both the
 * API route and the server page do) so results are served from Redis when warm.
 */
export async function getNbaRankings(
  params: NbaRankingsParams
): Promise<RankingListResponse> {
  const { season, mode, type, limit, offset, publishedOnly } = params
  const supabase = createAdminClient()

  const rankingVersion = await activeNbaRankingVersion(supabase, season, mode)
  if (!rankingVersion) {
    return {
      season,
      ranking_type: type,
      ranking_version: "none",
      total: 0,
      rankings: [],
    }
  }

  // Build query
  let query = supabase
    .from("nba_player_rankings")
    .select("rank, player_name, player_id, team, historical_team, position, age, score, tier, previous_rank, rank_change, is_new, is_published, confidence, low_confidence, offense_score, defense_score, scoring_score, playmaking_score, rebounding_score, shooting_score, two_way_score, explanation, strengths, weaknesses, signature, player_class, potential, ceiling, status")
    .eq("season", season)
    .eq("ranking_mode", mode)
    .eq("ranking_type", type)
    .eq("ranking_version", rankingVersion)
    .order("rank", { ascending: true })
    .range(offset, offset + limit - 1)

  if (publishedOnly) {
    query = query.eq("is_published", true)
  }

  const { data: rows, error } = await query

  if (error) {
    console.error("[rankings] DB error:", error.message)
    throw new Error(error.message)
  }

  // Get total count
  let countQuery = supabase
    .from("nba_player_rankings")
    .select("rank", { count: "exact", head: true })
    .eq("season", season)
    .eq("ranking_mode", mode)
    .eq("ranking_type", type)
    .eq("ranking_version", rankingVersion)
  if (publishedOnly) countQuery = countQuery.eq("is_published", true)

  const { count } = await countQuery

  const rankings: RankingListItem[] = (rows ?? []).map((row: any) => ({
    rank: row.rank,
    player_name: row.player_name,
    player_id: row.player_id,
    team: row.team,
    historical_team: row.historical_team,
    position: row.position,
    age: row.age,
    score: Number(row.score),
    tier: row.tier,
    previous_rank: row.previous_rank,
    rank_change: row.rank_change,
    is_new: row.is_new,
    is_published: row.is_published,
    confidence: row.confidence ? Number(row.confidence) : null,
    low_confidence: row.low_confidence,
    offense_score: row.offense_score ? Number(row.offense_score) : null,
    defense_score: row.defense_score ? Number(row.defense_score) : null,
    scoring_score: row.scoring_score ? Number(row.scoring_score) : null,
    playmaking_score: row.playmaking_score ? Number(row.playmaking_score) : null,
    rebounding_score: row.rebounding_score ? Number(row.rebounding_score) : null,
    shooting_score: row.shooting_score ? Number(row.shooting_score) : null,
    two_way_score: row.two_way_score ? Number(row.two_way_score) : null,
    explanation: row.explanation,
    strengths: row.strengths,
    weaknesses: row.weaknesses,
    signature: row.signature,
    player_class: row.player_class,
    potential: row.potential,
    ceiling: row.ceiling,
    status: row.status,
  }))

  return {
    season,
    ranking_type: type,
    ranking_version: rankingVersion,
    total: count ?? rankings.length,
    rankings,
  }
}
