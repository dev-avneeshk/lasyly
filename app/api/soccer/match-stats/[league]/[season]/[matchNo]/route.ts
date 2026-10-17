import { NextResponse } from "next/server"
import { cached, CACHE_TTL } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateMatchParams } from "@/lib/soccer/big5"
import {
  shapeSoccerMatchStats,
  type SoccerMatchRow,
  type SoccerMatchStatRow,
  type SoccerTeamRow,
} from "@/lib/scores/soccerMatchStats"

/**
 * GET /api/soccer/match-stats/[league]/[season]/[matchNo]
 *
 * Returns a Big-5 match's per-period stats from OUR OWN Supabase data
 * (`soccer_matches` + `soccer_match_stats`, logos/colors from `espn_teams`).
 * ESPN is not consulted.
 *
 * Next 16 dynamic route handler: `params` is a Promise. The raw params are
 * validated with anchored regexes (no decodeURIComponent), so there's one
 * canonical URL, and one cache key, per match. Unauthenticated on purpose:
 * read-only public reference data, same exposure as the tables' public SELECT.
 */

async function handleGET(
  _request: Request,
  context?: { params: Promise<{ league: string; season: string; matchNo: string }> }
) {
  const p = await context?.params
  const key = validateMatchParams(p?.league, p?.season, p?.matchNo)

  if (!key) {
    return NextResponse.json(
      { error: "Invalid match", success: false },
      { status: 400 }
    )
  }

  const { league, season, matchNo } = key

  try {
    // A finished match's stats are immutable, so cache-aside with a long TTL.
    const data = await cached(
      `soccer-match-stats:v1:${league}:${season}:${matchNo}`,
      async () => {
        const supabase = createAdminClient()

        const { data: match, error: matchError } = await supabase
          .from("soccer_matches")
          .select("league, season, match_no, round, match_date, home_team, away_team, home_score, away_score, source, has_stats")
          .eq("league", league)
          .eq("season", season)
          .eq("match_no", matchNo)
          .maybeSingle()

        if (matchError) throw new Error(matchError.message)
        if (!match) return null
        const header = match as SoccerMatchRow

        let rows: SoccerMatchStatRow[] = []
        if (header.has_stats) {
          const { data: statRows, error: statsError } = await supabase
            .from("soccer_match_stats")
            .select("period, stat_group, stat_name, home_value, away_value, home_pct, away_pct, home_raw, away_raw")
            .eq("league", league)
            .eq("season", season)
            .eq("match_no", matchNo)

          if (statsError) throw new Error(statsError.message)
          rows = (statRows ?? []) as SoccerMatchStatRow[]
        }

        // Logos/colors are cosmetic: a failed read just leaves them out.
        let teams: SoccerTeamRow[] = []
        const { data: teamRows, error: teamsError } = await supabase
          .from("espn_teams")
          .select("name, logo_url, color")
          .eq("league", league)
          .in("name", [header.home_team, header.away_team])
        if (!teamsError) teams = (teamRows ?? []) as SoccerTeamRow[]

        return shapeSoccerMatchStats(header, rows, teams)
      },
      CACHE_TTL.leaderboard
    )

    if (!data) {
      return NextResponse.json(
        { error: "Match not found", success: false },
        { status: 404 }
      )
    }

    return NextResponse.json({ data, success: true }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch match stats"
    console.error("Soccer match stats API error:", message)
    return NextResponse.json(
      { error: "Failed to fetch match stats", success: false },
      { status: 502 }
    )
  }
}

export const GET = withSecurity(handleGET, {
  cacheControl: CACHE_CONTROL.PUBLIC_LONG,
})
