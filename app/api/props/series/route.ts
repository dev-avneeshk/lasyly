import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

/** Expand a team abbreviation to the full name stored in nba_games. Falls back to input. */
function expandTeam(abbr: string): string {
  return ABBR_TO_TEAM_NAME[abbr.toUpperCase()] ?? abbr
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const team = searchParams.get("team")
  const opponent = searchParams.get("opponent")

  if (!team || !opponent) {
    return NextResponse.json({ error: "team and opponent are required" }, { status: 400 })
  }

  // Expand abbreviations to full names as stored in nba_games
  const teamFull = expandTeam(team)
  const opponentFull = expandTeam(opponent)

  try {
    const supabase = createAdminClient()

    // First check: recent games (last 14 days) to detect playoff series
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const recentDateStr = fourteenDaysAgo.toISOString().split("T")[0]

    const { data: recentGames } = await supabase
      .from("nba_games")
      .select("home_team, away_team, home_score, away_score, game_date")
      .or(`and(home_team.eq.${teamFull},away_team.eq.${opponentFull}),and(home_team.eq.${opponentFull},away_team.eq.${teamFull})`)
      .gte("game_date", recentDateStr)
      .eq("status", "completed")
      .order("game_date", { ascending: true })

    const recentCount = recentGames?.length ?? 0

    // If 2+ games in last 14 days → playoff series
    if (recentCount >= 2) {
      let teamWins = 0
      let opponentWins = 0

      for (const game of recentGames!) {
        const homeWon = game.home_score > game.away_score
        const winner = homeWon ? game.home_team : game.away_team
        if (winner === teamFull) teamWins++
        else if (winner === opponentFull) opponentWins++
      }

      return NextResponse.json({
        type: "playoff",
        teamWins,
        opponentWins,
        gamesPlayed: recentCount,
      })
    }

    // Otherwise: full season series
    // Get all games between these teams this season (since October)
    const seasonStart = new Date()
    seasonStart.setMonth(9, 1) // October 1
    if (seasonStart > new Date()) {
      seasonStart.setFullYear(seasonStart.getFullYear() - 1)
    }
    const seasonDateStr = seasonStart.toISOString().split("T")[0]

    const { data: seasonGames } = await supabase
      .from("nba_games")
      .select("home_team, away_team, home_score, away_score, game_date")
      .or(`and(home_team.eq.${teamFull},away_team.eq.${opponentFull}),and(home_team.eq.${opponentFull},away_team.eq.${teamFull})`)
      .gte("game_date", seasonDateStr)
      .eq("status", "completed")
      .order("game_date", { ascending: true })

    let teamWins = 0
    let opponentWins = 0

    for (const game of seasonGames ?? []) {
      const homeWon = game.home_score > game.away_score
      const winner = homeWon ? game.home_team : game.away_team
      if (winner === teamFull) teamWins++
      else if (winner === opponentFull) opponentWins++
    }

    return NextResponse.json({
      type: "season",
      teamWins,
      opponentWins,
      gamesPlayed: seasonGames?.length ?? 0,
    })
  } catch {
    return NextResponse.json({ type: "season", teamWins: 0, opponentWins: 0, gamesPlayed: 0 })
  }
}
