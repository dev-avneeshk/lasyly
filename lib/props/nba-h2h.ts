/**
 * Head-to-head history for the props table: each player's recent games vs the
 * opponent he faces tonight, in the prop's stat.
 *
 * One batched query per slate (players x tonight's opponents), cached in Redis
 * by date + the player/opponent set, then sliced per prop in memory.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { getTodayET } from "@/lib/props/dates"

export interface H2HGame {
  date: string
  value: number
}

/** Last N meetings kept per player/opponent. */
export const H2H_GAMES = 10
const H2H_CACHE_TTL = 30 * 60_000
const PAGE = 1000
const MAX_PAGES = 4

/** nba_player_stats columns per prop stat category; combos are summed. */
const STAT_PARTS: Record<string, string[]> = {
  pts: ["pts"],
  trb: ["trb"],
  reb: ["trb"],
  ast: ["ast"],
  tp: ["tp"],
  stl: ["stl"],
  blk: ["blk"],
  tov: ["tov"],
  fg: ["fg"],
  fga: ["fga"],
  ft: ["ft"],
  fta: ["fta"],
  pra: ["pts", "trb", "ast"],
  pr: ["pts", "trb"],
  pa: ["pts", "ast"],
  ra: ["trb", "ast"],
}
const COLUMNS = [...new Set(Object.values(STAT_PARTS).flat())]

type Row = Record<string, number | string | null> & {
  player_name: string
  opponent: string
  nba_games: { game_date: string } | null
}

function hashKey(parts: string[]): string {
  let h = 0
  for (const ch of parts.join("|")) h = (h * 31 + ch.charCodeAt(0)) | 0
  return (h >>> 0).toString(16)
}

/** Fetch every slate player's games vs any slate opponent, newest first. */
async function fetchRows(players: string[], opponents: string[]): Promise<Row[]> {
  const supabase = createAdminClient()
  const rows: Row[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("nba_player_stats")
      .select(`player_name, opponent, ${COLUMNS.join(", ")}, nba_games!inner(game_date)`)
      .in("player_name", players)
      .in("opponent", opponents)
      .order("nba_games(game_date)", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as unknown as Row[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

interface H2HProp {
  player: string
  matchup?: string | null
  statCategory: string
  sport?: string
}

/**
 * Returns copies of the props with `h2h` (oldest first) attached. Non-NBA
 * props and failures pass through untouched: H2H is enrichment only.
 */
export async function attachNbaH2H<T extends H2HProp>(props: T[]): Promise<(T & { h2h?: H2HGame[] })[]> {
  const nba = props.filter((p) => (p.sport ?? "NBA") === "NBA" && p.matchup && STAT_PARTS[p.statCategory])
  if (nba.length === 0) return props

  const players = [...new Set(nba.map((p) => p.player))].sort()
  const opponents = [...new Set(nba.map((p) => (p.matchup ?? "").toUpperCase()))].sort()
  const key = `nba-h2h:v1:${getTodayET()}:${hashKey([...players, "@", ...opponents])}`

  let rows: Row[]
  try {
    rows = await cached(key, () => fetchRows(players, opponents), H2H_CACHE_TTL)
  } catch (err) {
    console.error("[nba-h2h] query failed:", err instanceof Error ? err.message : err)
    return props
  }

  const byPair = new Map<string, Row[]>()
  for (const r of rows) {
    const k = `${r.player_name.toLowerCase()}|${String(r.opponent).toUpperCase()}`
    const list = byPair.get(k)
    if (list) list.push(r)
    else byPair.set(k, [r])
  }

  return props.map((p) => {
    const parts = STAT_PARTS[p.statCategory]
    if (!parts || !p.matchup) return p
    const list = byPair.get(`${p.player.toLowerCase()}|${p.matchup.toUpperCase()}`) ?? []
    const h2h = list
      .slice(0, H2H_GAMES)
      .map((r) => ({
        date: r.nba_games?.game_date ?? "",
        value: parts.reduce((s, c) => s + (Number(r[c]) || 0), 0),
      }))
      .reverse()
    return { ...p, h2h }
  })
}
