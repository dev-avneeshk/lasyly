/**
 * Bind ESPN boxscore entries (team stats, player groups) to the match's home
 * and away sides.
 *
 * ESPN's summary endpoint lists `boxscore.teams` / `boxscore.players`
 * away-first, while the match modal header renders home on the left. Array
 * position is therefore not a safe way to pick a side. Resolution order:
 *   (a) the `homeAway` flag carried by `mapESPNSummary`
 *   (b) team name matched against the match's home/away team names
 *   (c) ESPN's away-first convention (legacy stored summaries with neither)
 */

type Side = "home" | "away"

interface TeamEntry {
  team?: string
  teamId?: string
  abbreviation?: string
  homeAway?: Side
}

interface MatchTeams {
  homeTeam: string
  awayTeam: string
}

export function normalizeTeamName(s: string | undefined | null): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** With exactly two entries, one known side determines the other. */
function complete<T>(entries: T[], home: T | null, away: T | null): { home: T | null; away: T | null } {
  if (entries.length === 2) {
    if (home && !away) away = entries.find((e) => e !== home) ?? null
    else if (away && !home) home = entries.find((e) => e !== away) ?? null
  }
  return { home, away }
}

export function alignHomeAway<T extends TeamEntry>(
  entries: T[],
  match: MatchTeams
): { home: T | null; away: T | null } {
  // (a) explicit side flags
  const byFlag = complete(
    entries,
    entries.find((e) => e.homeAway === "home") ?? null,
    entries.find((e) => e.homeAway === "away") ?? null
  )
  if (byFlag.home && byFlag.away && byFlag.home !== byFlag.away) return byFlag

  // (b) team names
  const homeName = normalizeTeamName(match.homeTeam)
  const awayName = normalizeTeamName(match.awayTeam)
  const nameHome = homeName ? entries.find((e) => normalizeTeamName(e.team) === homeName) ?? null : null
  const nameAway = awayName
    ? entries.find((e) => e !== nameHome && normalizeTeamName(e.team) === awayName) ?? null
    : null
  const byName = complete(entries, nameHome, nameAway)
  if (byName.home && byName.away && byName.home !== byName.away) return byName

  // (c) ESPN convention: away first, home second
  if (entries.length >= 2) return { home: entries[1], away: entries[0] }

  // Fewer than two entries: return whatever (a) or (b) could resolve.
  return {
    home: byFlag.home ?? byName.home,
    away: byFlag.away ?? byName.away,
  }
}

/** Entries ordered `[home, away, ...rest]`, so index 0 is the header's left team. */
export function orderHomeFirst<T extends TeamEntry>(entries: T[], match: MatchTeams): T[] {
  const { home, away } = alignHomeAway(entries, match)
  const rest = entries.filter((e) => e !== home && e !== away)
  return [home, away, ...rest].filter((e): e is T => e != null)
}
