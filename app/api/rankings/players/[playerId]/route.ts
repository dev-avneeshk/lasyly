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
  const sport = (request.nextUrl.searchParams.get("sport") ?? "NBA").toUpperCase()

  // ─── NFL branch ─────────────────────────────────────────────────────────────
  if (sport === "NFL") {
    const nflSeason = request.nextUrl.searchParams.get("season") ?? String(new Date().getUTCFullYear())
    const nflResult = await cached(
      `rankings:nfl:player:${decodedId}:${nflSeason}`,
      () => getNflPlayerDetail(decodedId, nflSeason),
      CACHE_TTL_MS
    )
    if (!nflResult) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }
    return NextResponse.json(nflResult, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    })
  }

  const season = request.nextUrl.searchParams.get("season") ?? "2026-27"

  const cacheKey = `rankings:player:v2:${decodedId}:${season}`

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

      // Load bio and a persisted headshot from the stable player identity row.
      // Prefer the UUID relation; retain canonical-name lookup for legacy rows.
      const bioQuery = supabase
        .from("nba_players")
        .select("height, weight, birth_date, headshot_url")
      const { data: bioRow } = overallRow.player_id
        ? await bioQuery.eq("id", overallRow.player_id).maybeSingle()
        : await bioQuery.eq("player_name", overallRow.player_name).maybeSingle()

      return {
        player_name: overallRow.player_name,
        player_id: overallRow.player_id,
        position: overallRow.position,
        age: overallRow.age,
        // Bio (from nba_players identity table)
        height: bioRow?.height ?? null,
        weight: bioRow?.weight ?? null,
        birth_date: bioRow?.birth_date ?? null,
        headshot_url: bioRow?.headshot_url ?? null,
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
        signature: overallRow.signature,
        player_class: overallRow.player_class,
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

// ─── NFL player detail ────────────────────────────────────────────────────────

/**
 * Build the player-detail payload for NFL from nfl_player_rankings. Mirrors the
 * NBA shape so the shared detail page renders both. Box-score stats + game log
 * are loaded client-side from the NFL stats-reference endpoint.
 */
async function getNflPlayerDetail(decodedId: string, season: string) {
  const supabase = createAdminClient()

  // decodedId is either an ESPN athlete_id (stored in athlete_id) or a name.
  const looksNumeric = /^\d+$/.test(decodedId)

  const base = supabase
    .from("nfl_player_rankings")
    .select("*")
    .eq("season", season)
    .order("rank", { ascending: true })

  const { data: rows, error } = looksNumeric
    ? await base.eq("athlete_id", decodedId)
    : await base.eq("player_name", decodedId)

  if (error) throw new Error(error.message)
  if (!rows || rows.length === 0) return null

  const rankingsByType: Record<string, any> = {}
  for (const row of rows as any[]) {
    rankingsByType[row.ranking_type] = {
      rank: row.rank,
      score: Number(row.score),
      tier: row.tier,
      previous_rank: row.previous_rank,
      rank_change: row.rank_change,
    }
  }

  const overall = (rows as any[]).find((r) => r.ranking_type === "overall") ?? rows[0]

  // Resolve a headshot the same way the props engine does: look up espn_players
  // by name, preferring the stored URL and falling back to the ESPN id pattern.
  // The page also refreshes this live via the by-name headshot endpoint.
  let headshotUrl: string | null = null
  {
    const { data: espnRow } = await supabase
      .from("espn_players")
      .select("espn_id, headshot_url")
      .eq("name", overall.player_name)
      .maybeSingle()
    const row = espnRow as any
    if (row) {
      headshotUrl =
        row.headshot_url ||
        (row.espn_id ? `https://a.espncdn.com/i/headshots/nfl/players/full/${row.espn_id}.png` : null)
    } else if (overall.athlete_id) {
      headshotUrl = `https://a.espncdn.com/i/headshots/nfl/players/full/${overall.athlete_id}.png`
    }
  }

  return {
    sport: "NFL",
    player_name: overall.player_name,
    player_id: overall.athlete_id ?? null,
    position: overall.position,
    age: null,
    height: null,
    weight: null,
    birth_date: null,
    headshot_url: headshotUrl,
    season,
    team: overall.team,
    historical_team: null,
    projected_team: overall.team,
    overall_rank: rankingsByType["overall"]?.rank ?? null,
    overall_score: rankingsByType["overall"]?.score ?? null,
    tier: rankingsByType["overall"]?.tier ?? overall.tier,
    previous_rank: overall.previous_rank,
    rank_change: overall.rank_change,
    is_new: overall.is_new,
    low_confidence: overall.low_confidence,
    confidence: overall.confidence != null ? Number(overall.confidence) * 100 : null,
    games_played: overall.games_played,
    minutes_per_game: null,
    offense_score: overall.offense_score != null ? Number(overall.offense_score) : null,
    defense_score: overall.defense_score != null ? Number(overall.defense_score) : null,
    scoring_score: overall.scoring_score != null ? Number(overall.scoring_score) : null,
    playmaking_score: overall.playmaking_score != null ? Number(overall.playmaking_score) : null,
    // NFL has no rebounding; surface efficiency in the shooting slot (matches
    // the list-board mapping so the radar is consistent).
    rebounding_score: null,
    shooting_score: overall.efficiency_score != null ? Number(overall.efficiency_score) : null,
    two_way_score: overall.two_way_score != null ? Number(overall.two_way_score) : null,
    availability_score: overall.availability_score != null ? Number(overall.availability_score) : null,
    rankings_by_type: rankingsByType,
    explanation: overall.explanation,
    strengths: overall.strengths,
    weaknesses: overall.weaknesses,
    outlook: null,
    signature: overall.signature,
    player_class: null,
    ranking_history: [],
    team_history: [],
  }
}
