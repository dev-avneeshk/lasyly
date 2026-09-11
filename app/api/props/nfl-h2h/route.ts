/**
 * NFL Head-to-Head Game History + Player Splits
 *
 * Two payloads in one endpoint (driven by ?view=):
 *
 *  view=h2h  (default): "POSITION vs OPPONENT" game log — every game players at
 *            the given position played against the opponent, with W/L, home/away,
 *            the player's stat line, and over/under vs a reference line. Mirrors
 *            the PropFinder "RB vs SF" table.
 *
 *  view=splits: the focus player's per-game (or total) splits, grouped
 *            Passing / Rushing / Receiving / Fumbles, for a given year.
 *
 * Query params:
 *   player    (required for splits; optional focus for h2h)
 *   team      (player's team abbr — used to resolve W/L & home/away)
 *   opponent  (required for h2h) — opponent abbr
 *   position  (h2h) — QB | RB | WR | TE
 *   stat      (h2h) — UI stat key (YDS/TD/REC/CAR/INT) for the over/under column
 *   line      (h2h) — reference prop line for over/under coloring
 *   season    (splits) — year, default latest
 *   perGame   (splits) — "true" | "false"
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Resolve a UI stat key to a value from a player-stat row, role-aware. */
function statValue(statKey: string, row: any): number {
  switch (statKey) {
    case "YDS": {
      const p = num(row.pass_yds), r = num(row.rush_yds), rec = num(row.rec_yds)
      return Math.max(p, r, rec) // dominant lane for that game
    }
    case "TD":
      return num(row.pass_td) + num(row.rush_td) + num(row.rec_td)
    case "REC":
      return num(row.rec)
    case "CAR":
      return num(row.rush_att)
    case "INT":
      return num(row.pass_int)
    default:
      return 0
  }
}

const POS_BUCKET: Record<string, string[]> = {
  QB: ["QB"],
  RB: ["RB", "FB"],
  WR: ["WR"],
  TE: ["TE"],
}

// ─── H2H view ──────────────────────────────────────────────────────────────────

async function computeH2H(
  supabase: any,
  opponent: string,
  position: string,
  statKey: string,
  line: number,
  focusPlayer: string
) {
  // Players at `position` who faced `opponent` (opponent column == the defense).
  const buckets = POS_BUCKET[position] ?? [position]
  const { data: rows } = await supabase
    .from("nfl_player_stats")
    .select(
      "player_name, team, opponent, position, game_id, game_date, " +
      "pass_yds, rush_yds, rec_yds, pass_td, rush_td, rec_td, rec, rush_att, pass_int, targets, rec_long, rush_long"
    )
    .eq("opponent", opponent)
    .in("position", buckets)
    .order("game_date", { ascending: false })
    .limit(400)

  const list = (rows ?? []) as any[]
  if (list.length === 0) return { games: [], overCount: 0, total: 0 }

  // Resolve W/L + home/away from nfl_games for the involved games.
  const gameIds = [...new Set(list.map((r) => r.game_id).filter(Boolean))]
  const resultMap = new Map<string, { winner: string | null; home: string; away: string }>()
  if (gameIds.length > 0) {
    const { data: games } = await supabase
      .from("nfl_games")
      .select("id, home_abbr, away_abbr, home_score, away_score")
      .in("id", gameIds.slice(0, 300))
    for (const g of (games ?? []) as any[]) {
      const hs = g.home_score ?? 0, as_ = g.away_score ?? 0
      const winner = hs === as_ ? null : hs > as_ ? g.home_abbr : g.away_abbr
      resultMap.set(g.id, { winner, home: g.home_abbr, away: g.away_abbr })
    }
  }

  const games = list.map((r) => {
    const meta = resultMap.get(r.game_id)
    const isHome = meta ? meta.home === r.team : false
    const won = meta?.winner ? meta.winner === r.team : null
    const value = statValue(statKey, r)
    return {
      date: r.game_date,
      player: r.player_name,
      team: r.team,
      position: r.position,
      homeAway: isHome ? "H" : "A",
      result: won === null ? "" : won ? "W" : "L",
      value,
      overLine: line > 0 ? value >= line : null,
      // full stat line for expandable detail
      stats: {
        YDS: Math.max(num(r.pass_yds), num(r.rush_yds), num(r.rec_yds)),
        pass_yds: num(r.pass_yds), rush_yds: num(r.rush_yds), rec_yds: num(r.rec_yds),
        TD: num(r.pass_td) + num(r.rush_td) + num(r.rec_td),
        REC: num(r.rec), CAR: num(r.rush_att), TGTS: num(r.targets), INT: num(r.pass_int),
      },
      isFocus: focusPlayer ? r.player_name.toLowerCase() === focusPlayer.toLowerCase() : false,
    }
  })

  const graded = games.filter((g) => g.overLine !== null)
  const overCount = graded.filter((g) => g.overLine).length
  return { games, overCount, total: graded.length }
}

// ─── Splits view ────────────────────────────────────────────────────────────────

async function computeSplits(supabase: any, player: string, season: number | null, perGame: boolean) {
  let q = supabase
    .from("nfl_player_stats")
    .select(
      "player_name, position, game_date, " +
      "pass_c, pass_att, pass_yds, pass_td, pass_int, " +
      "rush_att, rush_yds, rush_td, rush_long, " +
      "rec, rec_yds, rec_td, rec_long, targets, fumbles, fumbles_lost"
    )
    .ilike("player_name", `%${player}%`)
    .order("game_date", { ascending: false })
    .limit(60)

  const { data } = await q
  let rows = (data ?? []) as any[]
  if (rows.length === 0) return null

  if (season) {
    // Season spans two calendar years; filter by the game's year window.
    rows = rows.filter((r) => {
      const y = Number((r.game_date ?? "").slice(0, 4))
      return y === season || y === season + 1
    })
    if (rows.length === 0) rows = (data ?? []) as any[] // fall back to all if empty
  }

  const n = rows.length
  const sum = (col: string) => rows.reduce((s, r) => s + num(r[col]), 0)
  const maxc = (col: string) => rows.reduce((m, r) => Math.max(m, num(r[col])), 0)
  const div = (v: number) => (perGame && n > 0 ? Math.round((v / n) * 100) / 100 : Math.round(v * 100) / 100)

  const passing = {
    "Completions": div(sum("pass_c")),
    "Attempts": div(sum("pass_att")),
    "Pass Yards": div(sum("pass_yds")),
    "Pass TD": div(sum("pass_td")),
    "Interceptions": div(sum("pass_int")),
    "Comp %": sum("pass_att") > 0 ? Math.round((sum("pass_c") / sum("pass_att")) * 1000) / 10 : 0,
  }
  const rushing = {
    "Rush Attempts": div(sum("rush_att")),
    "Rush Yards": div(sum("rush_yds")),
    "Rush Avg": sum("rush_att") > 0 ? Math.round((sum("rush_yds") / sum("rush_att")) * 100) / 100 : 0,
    "Rush TD": div(sum("rush_td")),
    "Rush Longest": maxc("rush_long"),
  }
  const receiving = {
    "Targets": div(sum("targets")),
    "Receptions": div(sum("rec")),
    "Rec Yards": div(sum("rec_yds")),
    "Rec Avg": sum("rec") > 0 ? Math.round((sum("rec_yds") / sum("rec")) * 100) / 100 : 0,
    "Rec TD": div(sum("rec_td")),
    "Rec Longest": maxc("rec_long"),
  }
  const fumbles = {
    "Fumbles": div(sum("fumbles")),
    "Fumbles Lost": div(sum("fumbles_lost")),
  }

  return {
    player: rows[0].player_name,
    position: rows[0].position,
    games: n,
    perGame,
    season: season ?? "all",
    splits: { passing, rushing, receiving, fumbles },
  }
}

// ─── Route ──────────────────────────────────────────────────────────────────────

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const view = searchParams.get("view") ?? "h2h"
  const player = searchParams.get("player") ?? ""
  const opponent = (searchParams.get("opponent") ?? "").toUpperCase()
  const position = (searchParams.get("position") ?? "RB").toUpperCase()
  const statKey = searchParams.get("stat") ?? "YDS"
  const line = Number(searchParams.get("line") ?? "0") || 0
  const seasonRaw = searchParams.get("season")
  const perGame = searchParams.get("perGame") !== "false"

  const injectionCheck = checkQueryParams({
    view, player, opponent, position, stat: statKey, season: seasonRaw,
  })
  if (injectionCheck) return injectionCheck

  const supabase = createAdminClient()

  if (view === "splits") {
    if (!player || player.length < 2) {
      return NextResponse.json({ error: "player required for splits" }, { status: 400 })
    }
    const season = seasonRaw && seasonRaw !== "all" ? Number(seasonRaw) : null
    const key = `nfl-splits:${player.toLowerCase().slice(0, 30)}:${season ?? "all"}:${perGame}`
    const result = await cached(key, () => computeSplits(supabase, player, season, perGame), 120_000)
    if (!result) return NextResponse.json({ error: "No data", player }, { status: 404 })
    return NextResponse.json(result)
  }

  // h2h
  if (!opponent) {
    return NextResponse.json({ error: "opponent required for h2h" }, { status: 400 })
  }
  const key = `nfl-h2h:${position}:${opponent}:${statKey}:${line}:${player.toLowerCase().slice(0, 24)}`
  const result = await cached(
    key,
    () => computeH2H(supabase, opponent, position, statKey, line, player),
    120_000
  )
  return NextResponse.json({
    ...result,
    meta: { view: "h2h", opponent, position, stat: statKey, line, timestamp: new Date().toISOString() },
  })
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })
