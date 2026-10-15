import { NextResponse } from "next/server"
import { cached, CACHE_TTL } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { shapeNbaBoxscore, type NbaGameRow, type NbaPlayerStatRow } from "@/lib/scores/nbaBoxscore"

/**
 * GET /api/nba/boxscore/[gameId]
 *
 * Returns a game's full boxscore from OUR OWN Supabase data
 * (`nba_games` + `nba_player_stats`), keyed by the game's UUID. ESPN is not
 * consulted — this works for every game we have stored, including old ones.
 *
 * Next 16 dynamic route handler: the second arg carries `params` as a Promise
 * (see app/api/parlays/[id] and app/api/scores/[eventId]/summary). Wrapped with
 * `withSecurity` for body-size/error handling and a public Cache-Control header.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handleGET(
  _request: Request,
  context?: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await context!.params

  if (!UUID_RE.test(gameId ?? "")) {
    return NextResponse.json(
      { error: "Invalid game ID", success: false },
      { status: 400 }
    )
  }

  try {
    // A finished game's boxscore is immutable, so cache-aside with a long TTL.
    const data = await cached(
      `nba-boxscore:${gameId}`,
      async () => {
        const supabase = createAdminClient()

        const { data: game, error: gameError } = await supabase
          .from("nba_games")
          .select("home_team, away_team, home_score, away_score, game_date, status")
          .eq("id", gameId)
          .maybeSingle()

        if (gameError) throw new Error(gameError.message)
        if (!game) return null

        const { data: rows, error: statsError } = await supabase
          .from("nba_player_stats")
          .select("player_name, team, position, minutes, pts, trb, ast, tp, stl, blk, tov, fg, fga, ft, fta")
          .eq("game_id", gameId)

        if (statsError) throw new Error(statsError.message)

        return shapeNbaBoxscore(game as NbaGameRow, (rows ?? []) as NbaPlayerStatRow[])
      },
      CACHE_TTL.leaderboard
    )

    if (!data) {
      return NextResponse.json(
        { error: "Game not found", success: false },
        { status: 404 }
      )
    }

    return NextResponse.json({ data, success: true }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch boxscore"
    console.error("NBA boxscore API error:", message)
    return NextResponse.json(
      { error: "Failed to fetch boxscore", success: false },
      { status: 502 }
    )
  }
}

export const GET = withSecurity(handleGET, {
  cacheControl: CACHE_CONTROL.PUBLIC_LONG,
})
