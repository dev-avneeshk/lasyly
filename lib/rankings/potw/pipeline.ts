/**
 * Player of the Week — data loader + pipeline.
 *
 * Loads every player's box scores over a rolling window (default: the 7 days
 * ending on the most recent game date in the DB), scores them with the POTW
 * engine, and upserts the winner into nba_player_of_week.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { scorePotwWindow, buildPotwResult, parseMinutes } from "./engine"
import { TRICODE_TO_FULL_NAME } from "./teams"
import { DEFAULT_POTW_CONFIG } from "./types"
import type { PotwConfig, PotwGameLine, PotwPlayerWindow, PotwResult } from "./types"

export interface PotwRunOptions {
  /** Inclusive end date (YYYY-MM-DD). Defaults to the latest game date in the DB. */
  windowEnd?: string
  season?: string
  config?: Partial<PotwConfig>
  dryRun?: boolean
}

export interface PotwRunResult {
  result: PotwResult | null
  players_considered: number
  window_start: string
  window_end: string
  season: string
  dry_run: boolean
  error?: string
}

/** Map full team names in nba_games to the tri-code stored on nba_player_stats. */
function isTeamWin(
  playerTeamTri: string,
  game: { home_team: string; away_team: string; home_score: number | null; away_score: number | null }
): boolean | null {
  if (game.home_score == null || game.away_score == null) return null
  const full = TRICODE_TO_FULL_NAME[playerTeamTri]
  if (!full) return null
  const isHome = game.home_team === full
  const isAway = game.away_team === full
  if (!isHome && !isAway) return null
  const winnerHome = game.home_score > game.away_score
  return isHome ? winnerHome : !winnerHome
}

export async function runPlayerOfWeek(options: PotwRunOptions = {}): Promise<PotwRunResult> {
  const supabase = createAdminClient()
  const config: PotwConfig = { ...DEFAULT_POTW_CONFIG, ...options.config }

  // ── Resolve the window end (default: latest completed game date) ──────────
  let windowEnd = options.windowEnd
  let season = options.season
  if (!windowEnd || !season) {
    const { data: latest } = await supabase
      .from("nba_games")
      .select("game_date, season")
      .order("game_date", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!latest) {
      return emptyResult("", "", season ?? "", options.dryRun, "No games found")
    }
    windowEnd = windowEnd ?? latest.game_date
    season = season ?? latest.season
  }

  // Narrow to definite strings for the rest of the function.
  if (!windowEnd || !season) {
    return emptyResult(windowEnd ?? "", windowEnd ?? "", season ?? "", options.dryRun, "Could not resolve window/season")
  }
  const resolvedEnd: string = windowEnd
  const resolvedSeason: string = season

  const end = new Date(resolvedEnd + "T00:00:00Z")
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (config.window_days - 1))
  const windowStart = start.toISOString().slice(0, 10)

  // ── Load games in the window ──────────────────────────────────────────────
  const { data: games, error: gamesErr } = await supabase
    .from("nba_games")
    .select("id, game_date, home_team, away_team, home_score, away_score, season, status")
    .eq("season", resolvedSeason)
    .gte("game_date", windowStart)
    .lte("game_date", resolvedEnd)
  if (gamesErr) return emptyResult(windowStart, resolvedEnd, resolvedSeason, options.dryRun, gamesErr.message)

  const gameMap = new Map<string, (typeof games)[number]>()
  for (const g of games ?? []) gameMap.set(g.id, g)
  const gameIds = Array.from(gameMap.keys())
  if (gameIds.length === 0) {
    return emptyResult(windowStart, resolvedEnd, resolvedSeason, options.dryRun, "No games in window")
  }

  // ── Load box scores for those games ───────────────────────────────────────
  const { data: statRows, error: statErr } = await supabase
    .from("nba_player_stats")
    .select("player_name, team, opponent, game_id, minutes, pts, trb, ast, stl, blk, tov, fga, fta, position")
    .in("game_id", gameIds)
  if (statErr) return emptyResult(windowStart, resolvedEnd, resolvedSeason, options.dryRun, statErr.message)

  // ── Group into per-player windows ─────────────────────────────────────────
  const byPlayer = new Map<string, PotwPlayerWindow>()
  for (const row of (statRows ?? []) as any[]) {
    const game = gameMap.get(row.game_id)
    if (!game) continue
    const won = isTeamWin(row.team, game as any)
    const line: PotwGameLine = {
      game_id: row.game_id,
      game_date: game.game_date,
      team: row.team,
      opponent: row.opponent ?? null,
      minutes: parseMinutes(row.minutes),
      pts: Number(row.pts) || 0,
      trb: Number(row.trb) || 0,
      ast: Number(row.ast) || 0,
      stl: Number(row.stl) || 0,
      blk: Number(row.blk) || 0,
      tov: Number(row.tov) || 0,
      fga: Number(row.fga) || 0,
      fta: Number(row.fta) || 0,
      won: won ?? false,
    }
    let w = byPlayer.get(row.player_name)
    if (!w) {
      w = { player_name: row.player_name, player_id: null, team: row.team, position: row.position ?? null, games: [] }
      byPlayer.set(row.player_name, w)
    }
    w.games.push(line)
    w.team = row.team // most recent team in window
  }

  const players = Array.from(byPlayer.values())

  // ── Resolve player IDs ────────────────────────────────────────────────────
  const { data: idRows } = await supabase.from("nba_players").select("id, player_name")
  const idMap = new Map<string, string>()
  for (const r of (idRows ?? []) as any[]) idMap.set(r.player_name, r.id)
  for (const p of players) p.player_id = idMap.get(p.player_name) ?? null

  // ── Score + build result ──────────────────────────────────────────────────
  const scored = scorePotwWindow(players, config)
  const result = buildPotwResult(scored, windowStart, resolvedEnd, resolvedSeason, "ALL")

  if (!result) {
    return emptyResult(windowStart, resolvedEnd, resolvedSeason, options.dryRun, "No eligible players in window", players.length)
  }

  // ── Write (unless dry run) ────────────────────────────────────────────────
  if (!options.dryRun) {
    const w = result.winner
    const { error: upsertErr } = await supabase
      .from("nba_player_of_week")
      .upsert(
        {
          window_start: result.window_start,
          window_end: result.window_end,
          season: result.season,
          conference: result.conference,
          player_id: w.player_id,
          player_name: w.player_name,
          team: w.team,
          position: w.position,
          potw_score: w.potw_score,
          production_score: w.production_score,
          efficiency_score: w.efficiency_score,
          availability_score: w.availability_score,
          team_success_score: w.team_success_score,
          games_in_window: w.games_in_window,
          team_wins_in_window: w.team_wins_in_window,
          pts_per_g: w.pts_per_g,
          trb_per_g: w.trb_per_g,
          ast_per_g: w.ast_per_g,
          stl_per_g: w.stl_per_g,
          blk_per_g: w.blk_per_g,
          ts_pct: w.ts_pct,
          runners_up: result.runners_up,
          headline: result.headline,
        },
        { onConflict: "window_start,window_end,conference" }
      )
    if (upsertErr) {
      return { result, players_considered: players.length, window_start: windowStart, window_end: resolvedEnd, season: resolvedSeason, dry_run: false, error: upsertErr.message }
    }
  }

  return { result, players_considered: players.length, window_start: windowStart, window_end: resolvedEnd, season: resolvedSeason, dry_run: !!options.dryRun }
}

function emptyResult(
  window_start: string,
  window_end: string,
  season: string,
  dryRun: boolean | undefined,
  error: string,
  players_considered = 0
): PotwRunResult {
  return { result: null, players_considered, window_start, window_end, season, dry_run: !!dryRun, error }
}
