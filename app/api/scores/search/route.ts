import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, CACHE_CONTROL, checkQueryParams } from "@/lib/security/routeHelpers"

/**
 * GET /api/scores/search?q=<query>&sport=<sport>&limit=<limit>
 * Search matches by team name or player name.
 * Searches the `matches` table in Supabase.
 */
async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  const sport = searchParams.get("sport")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 100)

  // Validate params
  const injectionCheck = checkQueryParams({ q: query, sport })
  if (injectionCheck) return injectionCheck

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters", success: false },
      { status: 400 }
    )
  }

  try {
    const supabase = createAdminClient()

    let dbQuery = supabase
      .from("matches")
      .select("*")
      .or(`home_team.ilike.%${query}%,away_team.ilike.%${query}%`)
      .order("match_date", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit)

    if (sport && sport !== "All") {
      dbQuery = dbQuery.eq("sport", sport)
    }

    const { data, error } = await dbQuery

    if (error) {
      console.error("Search error:", error.message)
      return NextResponse.json(
        { error: "Search failed", success: false },
        { status: 500 }
      )
    }

    const matches = (data ?? []).map(mapRowToMatch)

    return NextResponse.json(
      { data: matches, success: true, meta: { query, count: matches.length } },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    console.error("Search API error:", message)
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToMatch(row: any) {
  return {
    id: row.id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeScore: row.home_score ?? 0,
    awayScore: row.away_score ?? 0,
    clock: row.clock ?? undefined,
    status: row.status ?? "Finished",
    league: row.league,
    sport: row.sport,
    homeLogo: row.home_logo ?? undefined,
    awayLogo: row.away_logo ?? undefined,
    homeColor: row.home_color ?? undefined,
    awayColor: row.away_color ?? undefined,
    venue: row.venue ?? undefined,
    eventId: row.event_id ?? undefined,
    matchDate: row.match_date ?? undefined,
  }
}

export const GET = withSecurity(handleGET, {
  cacheControl: CACHE_CONTROL.PUBLIC_SHORT,
})
