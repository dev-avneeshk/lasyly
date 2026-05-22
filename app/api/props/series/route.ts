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
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const team = searchParams.get("team")
  const opponent = searchParams.get("opponent")

  if (!team || !opponent) {
    return NextResponse.json({ error: "team and opponent are required" }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // First check: recent games (last 14 days) to detect playoff series
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const recentDateStr = fourteenDaysAgo.toISOString().split("T")[0]

    const { data: recentGames } = await supabase
      .from("nba_games")
      .select("home_team, away_team, home_score, away_score, game_date")
      .or(`and(home_team.eq.${team},away_team.eq.${opponent}),and(home_team.eq.${opponent},away_team.eq.${team})`)
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
        if (winner === team) teamWins++
        else if (winner === opponent) opponentWins++
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
      .or(`and(home_team.eq.${team},away_team.eq.${opponent}),and(home_team.eq.${opponent},away_team.eq.${team})`)
      .gte("game_date", seasonDateStr)
      .eq("status", "completed")
      .order("game_date", { ascending: true })

    let teamWins = 0
    let opponentWins = 0

    for (const game of seasonGames ?? []) {
      const homeWon = game.home_score > game.away_score
      const winner = homeWon ? game.home_team : game.away_team
      if (winner === team) teamWins++
      else if (winner === opponent) opponentWins++
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
