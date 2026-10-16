/**
 * Big-5 European leagues covered by `public.soccer_matches` /
 * `public.soccer_match_stats` (imported from the Big-5 detailed-stats CSV by
 * scripts/db/import-big5-match-stats.mjs).
 *
 * Pure and client-safe: no server imports. Shared by the props engine, the
 * match-stats route, the analysis page and (via a parity test) the importer.
 */

export const BIG5_LEAGUES = [
  { code: "eng.1", slug: "premier_league", name: "Premier League" },
  { code: "esp.1", slug: "la_liga", name: "La Liga" },
  { code: "ger.1", slug: "bundesliga", name: "Bundesliga" },
  { code: "ita.1", slug: "serie_a", name: "Serie A" },
  { code: "fra.1", slug: "ligue_1", name: "Ligue 1" },
] as const

export const BIG5_LEAGUE_CODES = ["eng.1", "esp.1", "ger.1", "ita.1", "fra.1"] as const

export type Big5LeagueCode = (typeof BIG5_LEAGUE_CODES)[number]

/** Period codes stored in `soccer_match_stats.period`, with display labels. */
export const PERIOD_LABELS = { FT: "Full time", "1H": "1st half", "2H": "2nd half" } as const

export type SoccerPeriod = keyof typeof PERIOD_LABELS

/** Display order of periods. */
export const PERIOD_ORDER: readonly SoccerPeriod[] = ["FT", "1H", "2H"]

/**
 * Display order of stat groups. Physical performance goes last (the CSV has it
 * fourth); unknown groups sort after these, alphabetically.
 */
export const STAT_GROUP_ORDER = [
  "Top stats", "Shots", "Expected goals (xG)", "Passes", "Defence", "Duels", "Discipline", "Physical performance",
] as const

/** Order of stats within each group (the CSV's first-seen order). */
export const STAT_ORDER: Record<string, readonly string[]> = {
  "Top stats": ["Ball possession", "Expected goals (xG)", "Total shots", "Shots on target", "Touches in opposition box", "Big chances", "Big chances missed", "Accurate passes", "Yellow cards", "Corners"],
  "Shots": ["Total shots", "Shots off target", "Shots on target", "Blocked shots", "Hit woodwork", "Shots inside box", "Shots outside box"],
  "Expected goals (xG)": ["Expected goals (xG)", "xG open play", "xG set play", "xG non-penalty", "xG on target (xGOT)"],
  "Passes": ["Passes", "Accurate passes", "Own half", "Opposition half", "Accurate long balls", "Accurate crosses", "Throws", "Touches in opposition box", "Offsides"],
  "Defence": ["Tackles", "Interceptions", "Blocks", "Clearances", "Keeper saves"],
  "Duels": ["Duels won", "Ground duels won", "Aerial duels won", "Successful dribbles"],
  "Discipline": ["Yellow cards", "Red cards", "Fouls committed"],
  "Physical performance": ["Distance covered", "Running distance", "Sprinting distance", "Number of sprints"],
}

/**
 * FT stat rows each DB-sourced team prop reads. A team's value is the sum over
 * `names` (cards = yellow + red), from exactly one canonical group.
 */
export const DB_STAT_SOURCES = {
  team_corners:       { group: "Top stats",  names: ["Corners"] },
  team_cards:         { group: "Discipline", names: ["Yellow cards", "Red cards"] },
  team_shots:         { group: "Shots",      names: ["Total shots"] },
  team_shotsOnTarget: { group: "Shots",      names: ["Shots on target"] },
  team_fouls:         { group: "Discipline", names: ["Fouls committed"] },
} as const

export const LEAGUE_RE = /^(eng|esp|ger|ita|fra)\.1$/
export const SEASON_RE = /^\d{4}-\d{2}$/
export const MATCH_NO_RE = /^[1-9]\d{0,3}$/

/** `YYYY-YY` with consecutive years, e.g. "2025-26" (not "2026-28"). */
export function isValidSeason(season: string): boolean {
  if (!SEASON_RE.test(season)) return false
  const start = Number(season.slice(0, 4))
  const end = Number(season.slice(5))
  return end === (start + 1) % 100
}

/** `{league}/{season}/{matchNo}`, e.g. "eng.1/2026-27/45". */
export function buildMatchKey(league: string, season: string, matchNo: number | string): string {
  return `${league}/${season}/${matchNo}`
}

/**
 * Validate route params (or match-key parts). Regexes run on the raw strings
 * before `Number()`, so "045", "4.5" and "1e3" are rejected. A missing param
 * returns null.
 */
export function validateMatchParams(
  league?: string,
  season?: string,
  matchNo?: string,
): { league: Big5LeagueCode; season: string; matchNo: number } | null {
  if (league === undefined || season === undefined || matchNo === undefined) return null
  if (!LEAGUE_RE.test(league) || !isValidSeason(season) || !MATCH_NO_RE.test(matchNo)) return null
  return { league: league as Big5LeagueCode, season, matchNo: Number(matchNo) }
}

/** Inverse of `buildMatchKey`; null unless exactly 3 valid parts. */
export function parseMatchKey(
  key: string,
): { league: Big5LeagueCode; season: string; matchNo: number } | null {
  if (typeof key !== "string") return null
  const parts = key.split("/")
  if (parts.length !== 3) return null
  return validateMatchParams(parts[0], parts[1], parts[2])
}
