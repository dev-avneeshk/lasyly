/**
 * GET /api/rankings/teams/[team]
 * Returns team detail with full roster breakdown for a given season.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"

const CACHE_TTL_MS = 300_000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ team: string }> }
): Promise<NextResponse> {
  const { team } = await params
  const season = request.nextUrl.searchParams.get("season") ?? "2026-27"

  const cacheKey = `rankings:team:${team}:${season}`

  const result = await cached(
    cacheKey,
    async () => {
      const supabase = createAdminClient()

      // Load team ranking row
      const { data: teamRow, error } = await supabase
        .from("nba_team_rankings")
        .select("*")
        .eq("team", team.toUpperCase())
        .eq("season", season)
        .eq("ranking_type", "power")
        .order("rank", { ascending: true })
        .limit(1)
        .single()

      if (error || !teamRow) return null

      // Load roster for this team in this season
      const { data: rosterRows } = await supabase
        .from("nba_player_team_history")
        .select("player_name")
        .eq("team", team.toUpperCase())
        .eq("season", season)
        .eq("is_primary", true)

      const playerNames = (rosterRows ?? []).map((r: any) => r.player_name)

      // Load player rankings for roster
      let playerRankings: any[] = []
      if (playerNames.length > 0) {
        const { data: playerRows } = await supabase
          .from("nba_player_rankings")
          .select("player_name, rank, score, tier, position, offense_score, defense_score")
          .eq("season", season)
          .eq("ranking_type", "overall")
          .in("player_name", playerNames)
          .order("rank", { ascending: true })

        playerRankings = (playerRows ?? []).map((r: any) => ({
          player_name: r.player_name,
          rank: r.rank,
          score: Number(r.score),
          tier: r.tier,
          position: r.position,
          offense_score: r.offense_score ? Number(r.offense_score) : null,
          defense_score: r.defense_score ? Number(r.defense_score) : null,
        }))
      }

      // Load historical ranking for this team
      const { data: historyRows } = await supabase
        .from("nba_ranking_history")
        .select("season, rank, score, rank_change")
        .eq("entity_name", team.toUpperCase())
        .eq("entity_type", "team")
        .eq("ranking_type", "power")
        .order("season", { ascending: true })

      return {
        team: teamRow.team,
        team_full_name: teamRow.team_full_name,
        season: teamRow.season,
        rank: teamRow.rank,
        power_score: Number(teamRow.power_score),
        tier: teamRow.tier,
        offensive_score: teamRow.offensive_score ? Number(teamRow.offensive_score) : null,
        defensive_score: teamRow.defensive_score ? Number(teamRow.defensive_score) : null,
        depth_score: teamRow.depth_score ? Number(teamRow.depth_score) : null,
        star_power_score: teamRow.star_power_score ? Number(teamRow.star_power_score) : null,
        net_score: teamRow.net_score ? Number(teamRow.net_score) : null,
        previous_rank: teamRow.previous_rank,
        rank_change: teamRow.rank_change,
        projected_wins: teamRow.projected_wins,
        projected_win_pct: teamRow.projected_win_pct ? Number(teamRow.projected_win_pct) : null,
        returning_core_pct: teamRow.returning_core_pct ? Number(teamRow.returning_core_pct) : null,
        key_additions: teamRow.key_additions ?? [],
        key_losses: teamRow.key_losses ?? [],
        explanation: teamRow.explanation,
        why_ranked_here: teamRow.why_ranked_here,
        roster: playerRankings,
        ranking_history: historyRows ?? [],
      }
    },
    CACHE_TTL_MS
  )

  if (!result) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 })
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  })
}
