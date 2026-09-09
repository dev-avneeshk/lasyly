/**
 * GET /api/rankings/players/[playerId]
 * Returns full player ranking detail across all ranking types + historical movement.
 *
 * playerId can be:
 *   - UUID (player_id from nba_players)
 *   - URL-encoded player name (e.g., "LeBron%20James")
 *
 * Query params:
 *   season — '2026-27' (default: '2026-27')
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"

const CACHE_TTL_MS = 300_000

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
): Promise<NextResponse> {
  const { playerId } = await params
  const decodedId = decodeURIComponent(playerId)
  const season = request.nextUrl.searchParams.get("season") ?? "2026-27"

  const cacheKey = `rankings:player:${decodedId}:${season}`

  const result = await cached(
    cacheKey,
    async () => {
      const supabase = createAdminClient()

      // Try to find by player_id (UUID) or player_name
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedId)

      const query = supabase
        .from("nba_player_rankings")
        .select("*")
        .eq("season", season)
        .order("rank", { ascending: true })

      const { data: rows, error } = isUUID
        ? await query.eq("player_id", decodedId)
        : await query.eq("player_name", decodedId)

      if (error) throw new Error(error.message)
      if (!rows || rows.length === 0) return null

      // Group rankings by type
      const rankingsByType: Record<string, any> = {}
      for (const row of rows) {
        rankingsByType[row.ranking_type] = {
          rank: row.rank,
          score: Number(row.score),
          tier: row.tier,
          previous_rank: row.previous_rank,
          rank_change: row.rank_change,
        }
      }

      const overallRow = rows.find((r: any) => r.ranking_type === "overall") ?? rows[0]

      // Load historical ranking movement across seasons
      const { data: historyRows } = await supabase
        .from("nba_ranking_history")
        .select("season, ranking_type, rank, score, rank_change")
        .eq("entity_name", overallRow.player_name)
        .eq("ranking_type", "overall")
        .order("season", { ascending: true })

      // Load team history for this player
      const { data: teamHistoryRows } = await supabase
        .from("nba_player_team_history")
        .select("season, team, team_full_name, effective_from, effective_to")
        .eq("player_name", overallRow.player_name)
        .order("season", { ascending: true })

      return {
        player_name: overallRow.player_name,
        player_id: overallRow.player_id,
        position: overallRow.position,
        age: overallRow.age,
        season,
        team: overallRow.team,
        historical_team: overallRow.historical_team,
        projected_team: overallRow.projected_team,
        overall_rank: rankingsByType["overall"]?.rank ?? null,
        overall_score: rankingsByType["overall"]?.score ?? null,
        tier: rankingsByType["overall"]?.tier ?? overallRow.tier,
        previous_rank: overallRow.previous_rank,
        rank_change: overallRow.rank_change,
        is_new: overallRow.is_new,
        low_confidence: overallRow.low_confidence,
        confidence: overallRow.confidence ? Number(overallRow.confidence) : null,
        games_played: overallRow.games_played,
        minutes_per_game: overallRow.minutes_per_game ? Number(overallRow.minutes_per_game) : null,
        // Component scores
        offense_score: overallRow.offense_score ? Number(overallRow.offense_score) : null,
        defense_score: overallRow.defense_score ? Number(overallRow.defense_score) : null,
        scoring_score: overallRow.scoring_score ? Number(overallRow.scoring_score) : null,
        playmaking_score: overallRow.playmaking_score ? Number(overallRow.playmaking_score) : null,
        rebounding_score: overallRow.rebounding_score ? Number(overallRow.rebounding_score) : null,
        shooting_score: overallRow.shooting_score ? Number(overallRow.shooting_score) : null,
        two_way_score: overallRow.two_way_score ? Number(overallRow.two_way_score) : null,
        availability_score: overallRow.availability_score ? Number(overallRow.availability_score) : null,
        // All ranking types
        rankings_by_type: rankingsByType,
        // Narratives
        explanation: overallRow.explanation,
        strengths: overallRow.strengths,
        weaknesses: overallRow.weaknesses,
        outlook: overallRow.outlook,
        // History
        ranking_history: historyRows ?? [],
        team_history: teamHistoryRows ?? [],
      }
    },
    CACHE_TTL_MS
  )

  if (!result) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 })
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  })
}
