/**
 * Canonical catalogue of sports and stat categories.
 *
 * This exists because the same allowlist was written out twice with different
 * contents. `/api/props` would happily serve an NBA "reb" or "3pm" prop, but
 * `/api/bets` only accepted a list that omitted both — so tapping Log on one of
 * those cards returned a 400 that surfaced as a generic error toast. Any sport
 * or stat the props API can emit must be loggable, and the only reliable way to
 * guarantee that is for both routes to read the same definitions.
 *
 * When adding a stat to a sport, add it here and both routes stay in sync.
 */

/** Sports the props API can serve. */
export const VALID_SPORTS = new Set(["NBA", "Tennis", "Soccer", "NFL", "NHL"])

/** Sports a pick can be logged against. Kept identical to VALID_SPORTS. */
export const LOGGABLE_SPORTS = ["NBA", "Tennis", "Soccer", "NFL", "NHL"] as const

export type LoggableSport = (typeof LOGGABLE_SPORTS)[number]

/** Valid NBA stat categories. */
export const VALID_NBA_STATS = new Set([
  "pts", "reb", "ast", "stl", "blk", "3pm", "tov", "fg", "fga", "ft", "fta",
  "trb", "tp", "pra",
])

/**
 * Valid Tennis stat categories.
 *
 * Note: "all" is a member here for historical reasons. Callers treat "all" as a
 * meta-stat before consulting this set, so its presence is harmless.
 */
export const VALID_TENNIS_STATS = new Set([
  "all",
  "aces", "double_faults", "first_serve_pct", "first_serve_win_pct",
  "second_serve_win_pct", "hold_pct", "win_pct",
  "sets_won", "sets_lost", "games_won", "games_lost",
])

/** Valid Soccer stat categories, including team props. */
export const VALID_SOCCER_STATS = new Set([
  "totalGoals", "goalAssists", "totalShots", "shotsOnTarget",
  "foulsCommitted", "foulsSuffered", "yellowCards", "redCards",
  "saves", "appearances",
  // Team props
  "team_totalGoals", "team_corners", "team_cards", "team_matchGoals",
])

/** Valid NFL stat categories. */
export const VALID_NFL_STATS = new Set([
  "YDS", "TD", "REC", "CAR", "INT", "SACKS", "C/ATT", "QBR", "RTG",
  "AVG", "LONG", "FUM", "TGTS",
])

/** Valid NHL stat categories. */
export const VALID_NHL_STATS = new Set([
  "G", "A", "SOG", "+/-", "HT", "BS", "TK", "PIM", "TOI", "FO%",
  "S", "SM", "SHFT", "GV", "PN", "FW", "FL",
])

/** Stat allowlist per sport. */
export const STATS_BY_SPORT: Record<string, Set<string>> = {
  NBA: VALID_NBA_STATS,
  Tennis: VALID_TENNIS_STATS,
  Soccer: VALID_SOCCER_STATS,
  NFL: VALID_NFL_STATS,
  NHL: VALID_NHL_STATS,
}

/**
 * Whether `stat` is a recognised category for `sport`.
 *
 * Matching is case-insensitive in the permissive direction only: NFL/NHL keys
 * are uppercase ("YDS") while NBA/Soccer keys are not, and callers pass through
 * whatever the client sent.
 */
export function isValidStatForSport(sport: string, stat: string): boolean {
  const stats = STATS_BY_SPORT[sport]
  if (!stats) return false
  return stats.has(stat) || stats.has(stat.toLowerCase()) || stats.has(stat.toUpperCase())
}
