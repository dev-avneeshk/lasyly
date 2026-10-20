/**
 * Novig (via ParlayAPI) market keys -> Betroom NBA engine stat columns.
 *
 * Only the markets the engine can display are mapped: the six default stats
 * plus single-stat turnovers. Combo (PRA, P+R, ...) and novelty (double-double,
 * first basket) markets return null and are never requested or stored.
 */

/** Engine stat columns a Novig line can replace (matches the migration CHECK). */
export type NovigStat = "pts" | "trb" | "ast" | "tp" | "stl" | "blk" | "tov"

/** Canonical Novig market_key -> engine stat column. */
export const NOVIG_MARKET_TO_STAT: Readonly<Record<string, NovigStat>> = {
  player_points: "pts",
  player_rebounds: "trb",
  player_assists: "ast",
  player_threes: "tp",
  player_steals: "stl",
  player_blocks: "blk",
  player_turnovers: "tov",
}

/** Alternate keys seen for other books in the ParlayAPI feed -> canonical key. */
export const MARKET_ALIASES: Readonly<Record<string, string>> = {
  player_threes_made: "player_threes",
  player_three_pointers: "player_threes",
  prophetx_player_total_steals: "player_steals",
  prophetx_player_total_blocks: "player_blocks",
}

/**
 * Markets sent as `markets=` on the one sport-wide props call. Adding markets
 * does not change the 3-credit cost, only the row count.
 */
export const REQUESTED_MARKETS = [
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes",
  "player_steals",
  "player_blocks",
  "player_turnovers",
] as const

/** Maps a market_key (canonical or alias) to an engine stat, or null when unmapped. */
export function mapMarketKey(key: string | null | undefined): NovigStat | null {
  if (!key) return null
  const k = key.trim().toLowerCase()
  const canonical = MARKET_ALIASES[k] ?? k
  return Object.prototype.hasOwnProperty.call(NOVIG_MARKET_TO_STAT, canonical)
    ? NOVIG_MARKET_TO_STAT[canonical]
    : null
}
