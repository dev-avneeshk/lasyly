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

/**
 * Books whose prop lines are stored, in the order a line is preferred when
 * several books price the same player/stat (sharpest first).
 *
 * Only real two-way markets: DFS apps (PrizePicks, Underdog, Sleeper, Pick6)
 * pay flat multipliers, so their "prices" are not probabilities and they are
 * excluded. Bovada is excluded too: its main-line pick disagreed with
 * Pinnacle by more than a point on 77 of 133 shared props (2026-10-20 sample),
 * which reads as alt-ladder noise rather than a consensus line.
 *
 * Measured on 2026-10-20 (BOS@DET, PHI@NYK, OKC@SAS): Novig alone gave 138
 * usable main lines; these books together gave 176 (+38, mostly stl/blk/pts).
 */
export const BOOKMAKERS = [
  "pinnacle",
  "novig",
  "prophetx",
  "draftkings",
  "fanduel",
  "betmgm",
  "caesars",
  "espnbet",
  "fanatics",
  "betrivers",
  "fliff",
] as const

export type Bookmaker = (typeof BOOKMAKERS)[number]

const BOOK_RANK: ReadonlyMap<string, number> = new Map(BOOKMAKERS.map((b, i) => [b, i]))

/** True for a bookmaker key we store. */
export function isStoredBook(book: string | null | undefined): book is Bookmaker {
  return !!book && BOOK_RANK.has(book)
}

/** Preference rank of a book (lower wins); unknown books sort last. */
export function bookRank(book: string): number {
  return BOOK_RANK.get(book) ?? BOOKMAKERS.length
}

/** Display names for the card label ("Pinnacle line"). */
export const BOOK_LABELS: Readonly<Record<string, string>> = {
  pinnacle: "Pinnacle",
  novig: "Novig",
  prophetx: "ProphetX",
  draftkings: "DraftKings",
  fanduel: "FanDuel",
  betmgm: "BetMGM",
  caesars: "Caesars",
  espnbet: "ESPN BET",
  fanatics: "Fanatics",
  betrivers: "BetRivers",
  fliff: "Fliff",
}

/** Maps a market_key (canonical or alias) to an engine stat, or null when unmapped. */
export function mapMarketKey(key: string | null | undefined): NovigStat | null {
  if (!key) return null
  const k = key.trim().toLowerCase()
  const canonical = MARKET_ALIASES[k] ?? k
  return Object.prototype.hasOwnProperty.call(NOVIG_MARKET_TO_STAT, canonical)
    ? NOVIG_MARKET_TO_STAT[canonical]
    : null
}
