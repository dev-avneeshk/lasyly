import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * GET /api/props/series?team=OKC&opponent=SAS
 *
 * Returns the series record between two teams.
 *
 * Logic:
 * - If there are 2+ games between the teams in the last 14 days, treat it as a
 *   playoff series and return the W-L record from those recent games only.
 * - Otherwise, return the full season series (all games this season between them).
 */

/** Maps 3-letter abbreviations to full team names (as stored in nba_games) */
const ABBR_TO_TEAM_NAME: Record<string, string> = {
  ATL: "Atlanta Hawks", BOS: "Boston Celtics", BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets", CHI: "Chicago Bulls", CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks", DEN: "Denver Nuggets", DET: "Detroit Pistons",
  GSW: "Golden State Warriors", HOU: "Houston Rockets", IND: "Indiana Pacers",
  LAC: "LA Clippers", LAL: "LA Lakers", MEM: "Memphis Grizzlies",
  MIA: "Miami Heat", MIL: "Milwaukee Bucks", MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans", NYK: "New York Knicks", OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic", PHI: "Philadelphia 76ers", PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers", SAC: "Sacramento Kings", SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors", UTA: "Utah Jazz", WAS: "Washington Wizards",
}

const TEAM_NAMES = new Set(Object.values(ABBR_TO_TEAM_NAME))

/** Abbreviation or full name → the full name stored in nba_games; null if unknown. */
function expandTeam(input: string): string | null {
  const full = ABBR_TO_TEAM_NAME[input.toUpperCase()] ?? input
  return TEAM_NAMES.has(full) ? full : null
}

type Game = { home_team: string; away_team: string; home_score: number; away_score: number; game_date: string }

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const team = searchParams.get("team")
  const opponent = searchParams.get("opponent")

  if (!team || !opponent) {
    return NextResponse.json({ error: "team and opponent are required" }, { status: 400 })
  }

  // Allowlisted: the names are interpolated into a PostgREST `.or()` filter,
  // so raw input could rewrite it. Unknown teams have no games anyway.
  const teamFull = expandTeam(team)
  const opponentFull = expandTeam(opponent)
  if (!teamFull || !opponentFull) {
    return NextResponse.json({ type: "season", teamWins: 0, opponentWins: 0, gamesPlayed: 0 })
  }

  // This season (since October 1); the last 14 days of it decide "playoff".
  const seasonStart = new Date()
  seasonStart.setMonth(9, 1)
  if (seasonStart > new Date()) seasonStart.setFullYear(seasonStart.getFullYear() - 1)
  const recentStart = new Date(Date.now() - 14 * 86_400_000)
  const day = (d: Date) => d.toISOString().split("T")[0]
  const since = day(recentStart < seasonStart ? recentStart : seasonStart)
  const recentDateStr = day(recentStart)

  try {
    // One query (was two), cached: the record only changes when a game ends.
    const games = await cached(`props-series:v1:${teamFull}:${opponentFull}:${since}`, async () => {
      const { data, error } = await createAdminClient()
        .from("nba_games")
        .select("home_team, away_team, home_score, away_score, game_date")
        .or(`and(home_team.eq.${teamFull},away_team.eq.${opponentFull}),and(home_team.eq.${opponentFull},away_team.eq.${teamFull})`)
        .gte("game_date", since)
        .eq("status", "completed")
        .order("game_date", { ascending: true })
      if (error) throw error
      return (data ?? []) as Game[]
    }, 600_000)

    const recent = games.filter((g) => g.game_date >= recentDateStr)
    const playoff = recent.length >= 2
    const counted = playoff ? recent : games.filter((g) => g.game_date >= day(seasonStart))
    let teamWins = 0
    let opponentWins = 0
    for (const game of counted) {
      const winner = game.home_score > game.away_score ? game.home_team : game.away_team
      if (winner === teamFull) teamWins++
      else if (winner === opponentFull) opponentWins++
    }
    return NextResponse.json({ type: playoff ? "playoff" : "season", teamWins, opponentWins, gamesPlayed: counted.length })
  } catch {
    return NextResponse.json({ type: "season", teamWins: 0, opponentWins: 0, gamesPlayed: 0 })
  }
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })
