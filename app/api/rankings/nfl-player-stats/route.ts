/**
 * GET /api/rankings/nfl-player-stats?player=<name>
 *
 * Box-score reference for the NFL player detail page: per-game log + season
 * aggregates from nfl_player_stats. Intentionally lightweight — it returns only
 * what the shared detail page consumes for NFL (seasonStats, gameBreakdown,
 * statsSeason), shaped to parallel the NBA stats-reference response.
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const CACHE_TTL_MS = 300_000
const MAX_PLAYER_LENGTH = 100
const HISTORY_DAYS = 400

interface NflGameRow {
  date: string | null
  opponent: string
  position: string | null
  passYds: number
  passTd: number
  passInt: number
  passAtt: number
  passComp: number
  rushYds: number
  rushTd: number
  rushAtt: number
  rec: number
  recYds: number
  recTd: number
  targets: number
  tackles: number
  sacks: number
  defInt: number
}

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const player = searchParams.get("player")

  const injection = checkQueryParams({ player })
  if (injection) return injection

  if (!player || player.trim().length === 0 || player.length > MAX_PLAYER_LENGTH) {
    return NextResponse.json({ error: "Invalid player parameter." }, { status: 400 })
  }

  const cacheKey = `nfl-player-stats:${player.toLowerCase()}`
  const result = await cached(cacheKey, () => fetchNflPlayerStats(player), CACHE_TTL_MS)

  if (result === null) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 })
  }
  return NextResponse.json(result)
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })

async function fetchNflPlayerStats(player: string) {
  const supabase = createAdminClient()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - HISTORY_DAYS)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("nfl_player_stats")
    .select(
      "player_name, team, opponent, position, game_date, pass_yds, pass_td, pass_int, pass_att, pass_c, rush_att, rush_yds, rush_td, rec, rec_yds, rec_td, targets, tackles_total, sacks, def_int"
    )
    .ilike("player_name", player)
    .gte("game_date", cutoffStr)
    .order("game_date", { ascending: false })
    .limit(40)

  if (error) {
    console.error("[nfl-player-stats] query failed:", error.message)
    throw new Error("Database query failed")
  }
  if (!data || data.length === 0) return null

  const rows = data as any[]
  const n = rows.length
  const sum = (get: (r: any) => number) => rows.reduce((s, r) => s + (Number(get(r)) || 0), 0)
  const avg = (get: (r: any) => number) => Math.round((sum(get) / n) * 10) / 10

  const position = (rows[0].position as string) || null
  const team = (rows[0].team as string) || ""
  const statsSeason = String(new Date(rows[0].game_date).getUTCFullYear())

  const passAtt = sum((r) => r.pass_att)
  const passComp = sum((r) => r.pass_c)
  const rushAtt = sum((r) => r.rush_att)
  const rushYds = sum((r) => r.rush_yds)
  const rec = sum((r) => r.rec)
  const targets = sum((r) => r.targets)
  const recYds = sum((r) => r.rec_yds)

  // Season aggregate (totals + rates), NFL-appropriate.
  const seasonStats = {
    games: n,
    // Passing
    passYds: sum((r) => r.pass_yds),
    passTd: sum((r) => r.pass_td),
    passInt: sum((r) => r.pass_int),
    passYdsPerG: avg((r) => r.pass_yds),
    completionPct: passAtt > 0 ? Math.round((passComp / passAtt) * 1000) / 10 : null,
    // Rushing
    rushYds,
    rushTd: sum((r) => r.rush_td),
    rushAtt,
    rushYdsPerG: avg((r) => r.rush_yds),
    yardsPerCarry: rushAtt > 0 ? Math.round((rushYds / rushAtt) * 10) / 10 : null,
    // Receiving
    rec,
    recYds,
    recTd: sum((r) => r.rec_td),
    targets,
    recYdsPerG: avg((r) => r.rec_yds),
    catchPct: targets > 0 ? Math.round((rec / targets) * 1000) / 10 : null,
    yardsPerRec: rec > 0 ? Math.round((recYds / rec) * 10) / 10 : null,
    // Defense
    tackles: sum((r) => r.tackles_total),
    sacks: sum((r) => r.sacks),
    defInt: sum((r) => r.def_int),
    tacklesPerG: avg((r) => r.tackles_total),
  }

  // Per-game log, oldest → newest for chart display.
  const gameBreakdown: NflGameRow[] = rows
    .slice()
    .reverse()
    .map((r) => ({
      date: r.game_date ?? null,
      opponent: r.opponent ?? "—",
      position: r.position ?? null,
      passYds: Number(r.pass_yds) || 0,
      passTd: Number(r.pass_td) || 0,
      passInt: Number(r.pass_int) || 0,
      passAtt: Number(r.pass_att) || 0,
      passComp: Number(r.pass_c) || 0,
      rushYds: Number(r.rush_yds) || 0,
      rushTd: Number(r.rush_td) || 0,
      rushAtt: Number(r.rush_att) || 0,
      rec: Number(r.rec) || 0,
      recYds: Number(r.rec_yds) || 0,
      recTd: Number(r.rec_td) || 0,
      targets: Number(r.targets) || 0,
      tackles: Number(r.tackles_total) || 0,
      sacks: Number(r.sacks) || 0,
      defInt: Number(r.def_int) || 0,
    }))

  return {
    player: rows[0].player_name,
    team,
    position,
    statsSeason,
    seasonStats,
    gameBreakdown,
  }
}
