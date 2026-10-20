/**
 * Shared types and pure helpers for the NBA player game log
 * (`/api/props/game-log`), which powers the analysis page's performance chart.
 *
 * Every stat is returned per game so the page can switch stat tabs, combos and
 * filters client-side without refetching.
 */

export interface NbaGameLogEntry {
  /** nba_games UUID — opens the DB-backed boxscore. */
  gameId: string
  /** ISO date, YYYY-MM-DD. */
  date: string
  /** Opponent abbreviation, e.g. "DET". */
  opponent: string
  /** Minutes played, rounded down. */
  minutes: number
  /** Season label, e.g. "2025-26". */
  season: string
  /** True for play-in and playoff games. */
  isPlayoff: boolean
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tpm: number
}

export interface NbaGameLogResponse {
  player: string
  /** Oldest first. */
  games: NbaGameLogEntry[]
}

export type SeasonTypeFilter = "all" | "regular" | "playoffs"

/** Stat-tab keys used on the analysis page mapped to per-game values. */
export function nbaStatValue(game: NbaGameLogEntry, statKey: string): number | null {
  switch (statKey.toUpperCase()) {
    case "PTS": return game.pts
    case "REB": return game.reb
    case "AST": return game.ast
    case "STL": return game.stl
    case "BLK": return game.blk
    case "3PM":
    case "TP": return game.tpm
    case "PTS+AST": return game.pts + game.ast
    case "PTS+REB": return game.pts + game.reb
    case "AST+REB": return game.ast + game.reb
    case "PTS+AST+REB":
    case "PRA": return game.pts + game.reb + game.ast
    default: return null
  }
}

/**
 * Parses box-score minutes ("36:29", "36", or a number) to whole minutes.
 */
export function parseMinutes(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.floor(raw) : 0
  if (typeof raw !== "string") return 0
  const mins = parseInt(raw.split(":")[0] ?? "", 10)
  return Number.isFinite(mins) ? mins : 0
}

/**
 * Last regular-season date for a season, derived from game counts per day.
 *
 * nba_games has no game-type column. The final regular-season day has every
 * team playing (15 games) and play-in/playoff days never exceed 4 games, so the
 * last date with at least {@link REGULAR_SEASON_MIN_GAMES_PER_DAY} games marks
 * the end of the regular season. Returns null when no such date exists (e.g.
 * the season is still in progress before March, in which case nothing is a
 * playoff game yet).
 */
export const REGULAR_SEASON_MIN_GAMES_PER_DAY = 6

export function regularSeasonEnd(gameDates: string[]): string | null {
  const counts = new Map<string, number>()
  for (const d of gameDates) counts.set(d, (counts.get(d) ?? 0) + 1)
  let end: string | null = null
  for (const [date, count] of counts) {
    if (count >= REGULAR_SEASON_MIN_GAMES_PER_DAY && (end === null || date > end)) end = date
  }
  return end
}

/** Round a sample average to the nearest half — used when a stat has no prop line. */
export function derivedLine(values: number[]): number {
  if (values.length === 0) return 0.5
  const avg = values.reduce((s, v) => s + v, 0) / values.length
  // Lines sit on the half so a game can never push.
  return Math.max(0.5, Math.round(avg - 0.5) + 0.5)
}
