/**
 * GET /api/rankings/teams
 * Returns team power rankings for a given season.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import type { TeamRankingListResponse } from "@/lib/rankings/types"

const CACHE_TTL_MS = 300_000

export async function GET(request: NextRequest): Promise<NextResponse> {
  const season = request.nextUrl.searchParams.get("season") ?? "2026-27"
  const mode = (request.nextUrl.searchParams.get("mode") ?? "projected") as "historical" | "projected"
  const publishedOnly = request.nextUrl.searchParams.get("published") !== "false"

  const cacheKey = `rankings:teams:${season}:${mode}:${publishedOnly}`

  const result = await cached<TeamRankingListResponse>(
    cacheKey,
    async () => {
      const supabase = createAdminClient()

      // Get active ranking version
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
            ranking_version: "none",
            total: 0,
            rankings: [],
          }
        }
        rankingVersion = (draftVersionRow as any).ranking_version
      }

      let query = supabase
        .from("nba_team_rankings")
        .select("rank, team, team_full_name, season, power_score, tier, previous_rank, rank_change, offensive_score, defensive_score, depth_score, star_power_score, net_score, returning_core_pct, projected_wins, is_published, explanation, why_ranked_here, team_class")
        .eq("season", season)
        .eq("ranking_mode", mode)
        .eq("ranking_type", "power")
        .order("rank", { ascending: true })

      if (rankingVersion) query = query.eq("ranking_version", rankingVersion)
      if (publishedOnly) query = query.eq("is_published", true)

      const { data: rows, error } = await query

      if (error) throw new Error(error.message)

      return {
        season,
        ranking_version: rankingVersion ?? "draft",
        total: rows?.length ?? 0,
        rankings: (rows ?? []).map((row: any) => ({
          rank: row.rank,
          team: row.team,
          team_full_name: row.team_full_name,
          power_score: Number(row.power_score),
          tier: row.tier,
          offensive_score: row.offensive_score ? Number(row.offensive_score) : null,
          defensive_score: row.defensive_score ? Number(row.defensive_score) : null,
          depth_score: row.depth_score ? Number(row.depth_score) : null,
          star_power_score: row.star_power_score ? Number(row.star_power_score) : null,
          previous_rank: row.previous_rank,
          rank_change: row.rank_change,
          projected_wins: row.projected_wins,
          key_additions: row.key_additions,
          key_losses: row.key_losses,
          explanation: row.explanation,
          why_ranked_here: row.why_ranked_here,
          team_class: row.team_class,
        })),
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
