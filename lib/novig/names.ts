/**
 * Player-name normalization and matching between Novig (ParlayAPI) names and
 * Betroom's player names (nba_player_stats.player_name / nba_players.player_name).
 *
 * The existing normalizers (lib/players/headshotResolver.ts,
 * lib/rankings/playerProfiles.ts) turn "P.J." into "p j"; ParlayAPI writes
 * "PJ" for some books and "P.J." for others, so this one DELETES periods and
 * apostrophes instead ("P.J." -> "pj", "De'Aaron" -> "deaaron").
 */

/** Generational suffixes dropped from names ("Jaren Jackson Jr." -> "jaren jackson"). */
const SUFFIX_TOKENS = new Set(["jr", "sr", "ii", "iii", "iv", "v"])

/**
 * Accent-, case-, punctuation- and suffix-insensitive name key.
 * Also drops a trailing parenthetical team tag ("Jayson Tatum (BOS)").
 */
export function normalizePersonName(name: string | null | undefined): string {
  if (!name) return ""
  const tokens = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/[.'\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
  // Keep the first token even if it looks like a suffix ("V" is not a surname here).
  return tokens.filter((t, i) => i === 0 || !SUFFIX_TOKENS.has(t)).join(" ")
}

/**
 * Known spelling differences, normalized Novig name -> normalized Betroom name.
 * Betroom's nba_players row is "Ron Holland"; Novig lists "Ronald Holland".
 */
export const NAME_ALIASES: Readonly<Record<string, string>> = {
  "ronald holland": "ron holland",
}

export type MatchMethod = "exact" | "alias" | "fuzzy" | "unmatched"

export interface LeaguePlayer {
  id: string
  name: string
}

export interface PlayerPools {
  /** Distinct recent nba_player_stats names for the game's two teams. */
  teamPool: string[]
  /** Active nba_players rows (carry the id). */
  leaguePool: LeaguePlayer[]
}

export interface PlayerMatch {
  playerId: string | null
  playerName: string | null
  method: MatchMethod
}

const UNMATCHED: PlayerMatch = { playerId: null, playerName: null, method: "unmatched" }

/** Distinct team-pool names grouped by normalized key (first spelling wins). */
function indexTeamPool(teamPool: string[]): Map<string, string> {
  const byKey = new Map<string, string>()
  for (const name of teamPool) {
    const key = normalizePersonName(name)
    if (key && !byKey.has(key)) byKey.set(key, name)
  }
  return byKey
}

/** The single league player with this key, using the team pool to break duplicates. */
function resolveLeague(
  key: string,
  leaguePool: LeaguePlayer[],
  teamName: string | undefined,
): LeaguePlayer | null | "ambiguous" {
  const hits = leaguePool.filter((p) => normalizePersonName(p.name) === key)
  if (hits.length === 0) return null
  if (hits.length === 1) return hits[0]
  if (teamName) {
    const exact = hits.filter((p) => p.name.trim().toLowerCase() === teamName.trim().toLowerCase())
    if (exact.length === 1) return exact[0]
  }
  return "ambiguous"
}

/** Same surname, and first names prefix-compatible (>= 2 chars) or same initial. */
function fuzzyCompatible(a: string, b: string): boolean {
  const ta = a.split(" ")
  const tb = b.split(" ")
  if (ta.length < 2 || tb.length < 2) return false
  if (ta[ta.length - 1] !== tb[tb.length - 1]) return false
  const fa = ta[0]
  const fb = tb[0]
  const [short, long] = fa.length <= fb.length ? [fa, fb] : [fb, fa]
  if (short.length >= 2 && long.startsWith(short)) return true
  return fa[0] === fb[0]
}

/**
 * Matches a Novig player name to a Betroom identity.
 *   1. exact normalized match (after NAME_ALIASES) -> "exact" | "alias"
 *   2. fuzzy against the TEAM pool only, accepted only when unique -> "fuzzy"
 *   3. otherwise "unmatched" (the line is still stored under the Novig name)
 */
export function matchPlayer(novigName: string, pools: PlayerPools): PlayerMatch {
  const normalized = normalizePersonName(novigName)
  if (!normalized) return UNMATCHED
  const aliased = NAME_ALIASES[normalized]
  const key = aliased ?? normalized
  const exactMethod: MatchMethod = aliased ? "alias" : "exact"
  const team = indexTeamPool(pools.teamPool)

  // 1. Exact.
  const teamName = team.get(key)
  const league = resolveLeague(key, pools.leaguePool, teamName)
  if (league && league !== "ambiguous") {
    return { playerId: league.id, playerName: league.name, method: exactMethod }
  }
  if (teamName) {
    return { playerId: null, playerName: teamName, method: exactMethod }
  }
  if (league === "ambiguous") return UNMATCHED

  // 2. Fuzzy, team pool only, unique.
  const candidates = [...team.keys()].filter((k) => fuzzyCompatible(key, k))
  if (candidates.length !== 1) return UNMATCHED
  const fuzzyKey = candidates[0]
  const fuzzyName = team.get(fuzzyKey) as string
  const fuzzyLeague = resolveLeague(fuzzyKey, pools.leaguePool, fuzzyName)
  return {
    playerId: fuzzyLeague && fuzzyLeague !== "ambiguous" ? fuzzyLeague.id : null,
    playerName: fuzzyLeague && fuzzyLeague !== "ambiguous" ? fuzzyLeague.name : fuzzyName,
    method: "fuzzy",
  }
}
