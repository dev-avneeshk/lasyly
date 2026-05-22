import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, CACHE_CONTROL, checkQueryParams } from "@/lib/security/routeHelpers"

/**
 * GET /api/scores/history?sport=<sport>&league=<league>&page=<page>&page_size=<size>
 * Get completed/historical matches from the database.
 * Returns matches ordered by date (most recent first).
 */
async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get("sport")
  const league = searchParams.get("league")
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(parseInt(searchParams.get("page_size") ?? "30", 10), 100)

  // Validate params
  const injectionCheck = checkQueryParams({ sport, league })
  if (injectionCheck) return injectionCheck

  try {
    const supabase = createAdminClient()
    const offset = (page - 1) * pageSize

    let query = supabase
      .from("matches")
      .select("*", { count: "exact" })
      .eq("status", "Finished")
      .order("match_date", { ascending: false })
      .order("updated_at", { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (sport && sport !== "All") {
      query = query.eq("sport", sport)
    }

    if (league && league !== "All") {
      query = query.eq("league", league)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("History error:", error.message)
      return NextResponse.json(
        { error: "Failed to fetch history", success: false },
        { status: 500 }
      )
    }

    const matches = (data ?? []).map(mapRowToMatch)
    const total = count ?? 0
    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json(
      {
        data: matches,
        success: true,
        pagination: { page, pageSize, total, totalPages },
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch history"
    console.error("History API error:", message)
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
