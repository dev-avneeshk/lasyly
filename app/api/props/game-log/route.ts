/**
 * GET /api/props/game-log?player=<name>
 *
 * NBA per-game box-score log for one player: every chart stat per game, plus
 * opponent, season and a regular-season/playoff flag. The analysis page loads
 * this once per player so stat tabs, combo stats and the vs-opponent /
 * season-type filters all switch client-side without another request.
 *
 * Public data, no auth. Redis cache-aside via `cached`.
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import {
  parseMinutes,
  regularSeasonEnd,
  type NbaGameLogEntry,
  type NbaGameLogResponse,
} from "@/lib/props/nbaGameLog"

/** 10 minutes — box scores only change when the scraper lands a new game. */
const GAME_LOG_CACHE_TTL = 600_000
const GAME_LOG_CACHE_VERSION = "v1"
const MAX_PLAYER_LENGTH = 100
/** Roughly two full seasons including playoffs. */
const MAX_GAMES = 180

interface PlayerStatRow {
  game_id: string
  player_name: string
  opponent: string | null
  minutes: string | number | null
  pts: number | null
  trb: number | null
  ast: number | null
  stl: number | null
  blk: number | null
  tp: number | null
  nba_games: { game_date: string; season: string | null } | null
}

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const player = searchParams.get("player")?.trim() ?? ""

  const injectionCheck = checkQueryParams({ player })
  if (injectionCheck) return injectionCheck

  if (!player || player.length > MAX_PLAYER_LENGTH) {
    return NextResponse.json(
      { error: "Invalid player parameter.", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  const cacheKey = `nba-game-log:${GAME_LOG_CACHE_VERSION}:${player.toLowerCase()}`
  const result = await cached(cacheKey, () => fetchGameLog(player), GAME_LOG_CACHE_TTL)

  if (!result) {
    return NextResponse.json({ error: "Player not found", code: "NOT_FOUND" }, { status: 404 })
  }
  return NextResponse.json(result)
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })

async function fetchGameLog(player: string): Promise<NbaGameLogResponse | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("nba_player_stats")
    .select(`
      game_id,
      player_name,
      opponent,
      minutes,
      pts,
      trb,
      ast,
      stl,
      blk,
      tp,
      nba_games!inner(game_date, season)
    `)
    .ilike("player_name", player)
    .order("nba_games(game_date)", { ascending: false })
    .limit(MAX_GAMES)

  if (error) {
    console.error("[game-log] player stats query failed:", error.message)
    throw new Error("Database query failed")
  }
  const rows = (data ?? []) as unknown as PlayerStatRow[]
  if (rows.length === 0) return null

  // Regular-season cut-off per season, from late-season game counts per day.
  const seasons = [...new Set(rows.map((r) => r.nba_games?.season).filter((s): s is string => !!s))]
  const seasonEnds = new Map<string, string | null>()
  await Promise.all(
    seasons.map(async (season) => {
      const endYear = Number(season.slice(0, 4)) + 1
      if (!Number.isFinite(endYear)) return
      const { data: dates, error: datesError } = await supabase
        .from("nba_games")
        .select("game_date")
        .eq("season", season)
        .gte("game_date", `${endYear}-03-15`)
        .limit(1000)
      if (datesError) {
        console.error("[game-log] season dates query failed:", datesError.message)
        return
      }
      seasonEnds.set(season, regularSeasonEnd((dates ?? []).map((d) => d.game_date as string)))
    })
  )

  const games: NbaGameLogEntry[] = rows
    .filter((r) => r.nba_games?.game_date)
    .map((r) => {
      const season = r.nba_games?.season ?? ""
      const date = r.nba_games!.game_date
      const end = seasonEnds.get(season) ?? null
      return {
        gameId: r.game_id,
        date,
        opponent: (r.opponent ?? "").toUpperCase(),
        minutes: parseMinutes(r.minutes),
        season,
        isPlayoff: end !== null && date > end,
        pts: r.pts ?? 0,
        reb: r.trb ?? 0,
        ast: r.ast ?? 0,
        stl: r.stl ?? 0,
        blk: r.blk ?? 0,
        tpm: r.tp ?? 0,
      }
    })
    // DNP rows (0 minutes) would plot as fake zeros.
    .filter((g) => g.minutes > 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  return { player: rows[0].player_name, games }
}
