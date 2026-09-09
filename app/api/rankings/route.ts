/**
 * GET /api/rankings
 * Returns ranked player list for a given season + ranking type.
 *
 * Query params:
 *   season       — '2026-27' (default: latest published)
 *   type         — 'overall' | 'offense' | 'defense' | etc. (default: 'overall')
 *   limit        — max rows to return (default: 100, max: 200)
 *   offset       — pagination offset (default: 0)
 *   published    — 'true' | 'false' (default: 'true')
 *
 * Cached at 300s TTL (rankings change only on recalculation runs).
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached, CACHE_TTL } from "@/lib/cache"
import type { RankingListResponse, RankingListItem, RankingType } from "@/lib/rankings/types"

const VALID_RANKING_TYPES: RankingType[] = [
  "overall", "offense", "defense", "scoring",
  "playmaking", "rebounding", "shooting", "two_way", "young", "breakout",
]

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 100
const CACHE_TTL_MS = 300_000  // 5 minutes

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const season = searchParams.get("season") ?? "2026-27"
  const mode = (searchParams.get("mode") ?? "projected") as "historical" | "projected"
  const type = (searchParams.get("type") ?? "overall") as RankingType
  const limit = Math.min(parseInt(searchParams.get("limit") ?? `${DEFAULT_LIMIT}`), MAX_LIMIT)
  const offset = parseInt(searchParams.get("offset") ?? "0")
  const publishedOnly = searchParams.get("published") !== "false"

  // Validate ranking type
  if (!VALID_RANKING_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid ranking type. Valid types: ${VALID_RANKING_TYPES.join(", ")}` },
      { status: 400 }
    )
  }

  const cacheKey = `rankings:${season}:${mode}:${type}:${limit}:${offset}:${publishedOnly}`

  const result = await cached<RankingListResponse>(
    cacheKey,
    async () => {
      const supabase = createAdminClient()

      // Get the active ranking version for this season
      const { data: versionRow } = await supabase
        .from("nba_ranking_versions")
        .select("ranking_version")
        .eq("season", season)
        .eq("ranking_mode", mode)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .single()

      let rankingVersion = (versionRow as any)?.ranking_version

      if (!rankingVersion) {
        // Fall back to draft if no published version exists (useful during dev)
        const { data: draftVersionRow } = await supabase
          .from("nba_ranking_versions")
          .select("ranking_version")
          .eq("season", season)
          .eq("ranking_mode", mode)
          .order("generated_at", { ascending: false })
          .limit(1)
          .single()

        if (!draftVersionRow) {
          return {
            season,
            ranking_type: type,
            ranking_version: "none",
            total: 0,
            rankings: [],
          }
        }
        rankingVersion = (draftVersionRow as any).ranking_version
      }

      // Build query
      let query = supabase
        .from("nba_player_rankings")
        .select("rank, player_name, player_id, team, historical_team, position, age, score, tier, previous_rank, rank_change, is_new, is_published, confidence, low_confidence, offense_score, defense_score, scoring_score, playmaking_score, rebounding_score, shooting_score, two_way_score, explanation, strengths, weaknesses, signature, player_class, potential, ceiling, status")
        .eq("season", season)
        .eq("ranking_mode", mode)
        .eq("ranking_type", type)
        .order("rank", { ascending: true })
        .range(offset, offset + limit - 1)

      if (rankingVersion) {
        query = query.eq("ranking_version", rankingVersion)
      }

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

      if (rankingVersion) countQuery = countQuery.eq("ranking_version", rankingVersion)
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
        ranking_version: rankingVersion ?? "draft",
        total: count ?? rankings.length,
        rankings,
      }
    },
    CACHE_TTL_MS
  )

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  })
}
