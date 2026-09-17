/**
 * Player Profile Data Layer
 *
 * The prop engines return performance data (lines, game logs, hit rates) but no
 * *context*: who the player is, which team they play for, when the next game is
 * and where. All of that already lives in the database — it just had no route
 * exposing it:
 *
 *   - bio (position, jersey, height, weight, age)  → espn_players / nba_players
 *   - team name, crest, brand colours, home venue  → espn_teams
 *   - team W-L record and streak                   → espn_standings
 *   - next kickoff (date, time, venue, home/away)  → nfl_games / espn_games
 *
 * This module joins those together for the player detail page. Every field is
 * independently nullable: coverage varies a lot by sport, and the UI is expected
 * to omit whatever is missing rather than invent it.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import {
  getNflTeamFullName,
  getNbaTeamFullName,
  getTeamLogoUrl,
} from "@/lib/constants/teams"

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProfileSport = "NBA" | "NFL" | "NHL" | "Soccer" | "Tennis"

export interface PlayerBio {
  position: string | null
  jerseyNumber: string | null
  /** As stored, e.g. `6-3` or `6' 3"`. */
  height: string | null
  /** As stored, usually pounds. */
  weight: string | null
  age: number | null
}

export interface TeamRecord {
  wins: number
  losses: number
  /** Draws (soccer) or overtime losses (NHL). Null when the sport has neither. */
  ties: number | null
  /** e.g. "W2" — as provided by the standings feed. */
  streak: string | null
}

export interface TeamMeta {
  abbr: string
  name: string | null
  logoUrl: string | null
  /** Primary brand colour as a 6-digit hex string WITHOUT a leading `#`. */
  color: string | null
  altColor: string | null
  record: TeamRecord | null
}

export interface NextGame {
  /** Local game date, `YYYY-MM-DD`. */
  gameDate: string
  /** ISO timestamp of kickoff/tip, when the feed has one. */
  startTime: string | null
  venue: string | null
  /** True when the player's team is at home. Null when undetermined. */
  isHome: boolean | null
  /** NFL week number, when applicable. */
  week: number | null
  status: string | null
}

export interface PlayerProfile {
  player: string
  sport: ProfileSport
  bio: PlayerBio | null
  team: TeamMeta
  opponent: TeamMeta | null
  nextGame: NextGame | null
}

/** 6 hours — bios, crests and schedules change on the order of days. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

const SPORT_TO_ESPN_LEAGUE: Partial<Record<ProfileSport, string>> = {
  NFL: "nfl",
  NHL: "nhl",
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Strips a leading `#` and validates a hex colour, returning null if unusable. */
function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null
  const hex = value.replace(/^#/, "").trim()
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function ageFromBirthDate(birthDate: unknown): number | null {
  if (typeof birthDate !== "string" || !birthDate) return null
  const born = new Date(birthDate)
  if (isNaN(born.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - born.getFullYear()
  const monthDelta = now.getMonth() - born.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) age--
  return age >= 0 && age < 120 ? age : null
}

/** Local `YYYY-MM-DD` for today, used as the schedule cutoff. */
function todayDateString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`
}

function fullNameFor(sport: ProfileSport, abbr: string): string | null {
  if (sport === "NFL") return getNflTeamFullName(abbr)
  if (sport === "NBA") return getNbaTeamFullName(abbr)
  return null
}

function logoFor(sport: ProfileSport, abbr: string): string | null {
  return getTeamLogoUrl(abbr, sport)
}

// ─── espn_teams / espn_standings lookups ────────────────────────────────────

interface EspnTeamRow {
  id: string
  name: string | null
  abbreviation: string | null
  logo_url: string | null
  color: string | null
  alternate_color: string | null
  venue_name: string | null
}

/**
 * Loads every team row for a league in one query and indexes it by
 * abbreviation. Doing it league-wide (32 rows for the NFL) means resolving the
 * player's team and their opponent costs a single round trip instead of two.
 */
async function loadEspnTeams(
  supabase: ReturnType<typeof createAdminClient>,
  league: string
): Promise<Map<string, EspnTeamRow>> {
  const byAbbr = new Map<string, EspnTeamRow>()
  const { data } = await supabase
    .from("espn_teams")
    .select("id, name, abbreviation, logo_url, color, alternate_color, venue_name")
    .eq("league", league)

  for (const row of (data ?? []) as EspnTeamRow[]) {
    if (row.abbreviation) byAbbr.set(row.abbreviation.toUpperCase(), row)
  }
  return byAbbr
}

/**
 * The standings feed stores streak as a signed number ("1.0", "-3.0") rather
 * than the "W1"/"L3" form people read. Convert it, and pass through anything
 * that already looks like a label.
 */
function normalizeStreak(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const raw = value.trim()
  const asNumber = Number(raw)
  if (!Number.isFinite(asNumber) || asNumber === 0) {
    return /^[WLTD]\d+$/i.test(raw) ? raw.toUpperCase() : null
  }
  const magnitude = Math.abs(Math.round(asNumber))
  if (magnitude === 0) return null
  return `${asNumber > 0 ? "W" : "L"}${magnitude}`
}

/** Latest-season standings row per team id. */
async function loadEspnStandings(
  supabase: ReturnType<typeof createAdminClient>,
  league: string
): Promise<Map<string, TeamRecord>> {
  const byTeamId = new Map<string, TeamRecord>()
  const { data } = await supabase
    .from("espn_standings")
    .select("team_id, season, wins, losses, draws, overtime_losses, streak")
    .eq("league", league)
    .order("season", { ascending: false })

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const teamId = row.team_id as string | null
    // Rows are newest-season-first, so the first entry per team wins.
    if (!teamId || byTeamId.has(teamId)) continue
    const draws = toNumberOrNull(row.draws)
    const otl = toNumberOrNull(row.overtime_losses)
    byTeamId.set(teamId, {
      wins: toNumberOrNull(row.wins) ?? 0,
      losses: toNumberOrNull(row.losses) ?? 0,
      ties: draws || otl || null,
      streak: normalizeStreak(row.streak),
    })
  }
  return byTeamId
}

function buildTeamMeta(
  sport: ProfileSport,
  abbr: string,
  teamRow: EspnTeamRow | undefined,
  records: Map<string, TeamRecord>
): TeamMeta {
  return {
    abbr: abbr.toUpperCase(),
    name: teamRow?.name ?? fullNameFor(sport, abbr),
    logoUrl: teamRow?.logo_url ?? logoFor(sport, abbr),
    color: normalizeHexColor(teamRow?.color),
    altColor: normalizeHexColor(teamRow?.alternate_color),
    record: teamRow?.id ? records.get(teamRow.id) ?? null : null,
  }
}

// ─── Bio lookups ────────────────────────────────────────────────────────────

async function loadEspnBio(
  supabase: ReturnType<typeof createAdminClient>,
  league: string,
  playerName: string
): Promise<PlayerBio | null> {
  const { data } = await supabase
    .from("espn_players")
    .select("name, jersey_number, position, height, weight, age")
    .eq("league", league)
    .ilike("name", playerName)
    .limit(1)

  const row = (data ?? [])[0] as Record<string, unknown> | undefined
  if (!row) return null
  return {
    position: (row.position as string | null) || null,
    jerseyNumber: (row.jersey_number as string | null) || null,
    height: (row.height as string | null) || null,
    weight: (row.weight as string | null) || null,
    age: toNumberOrNull(row.age),
  }
}

async function loadNbaBio(
  supabase: ReturnType<typeof createAdminClient>,
  playerName: string
): Promise<PlayerBio | null> {
  const { data } = await supabase
    .from("nba_players")
    .select("player_name, position, height, weight, birth_date")
    .ilike("player_name", playerName)
    .limit(1)

  const row = (data ?? [])[0] as Record<string, unknown> | undefined
  if (!row) return null
  return {
    position: (row.position as string | null) || null,
    // Basketball Reference data has no jersey number in this table.
    jerseyNumber: null,
    height: (row.height as string | null) || null,
    weight: (row.weight as string | null) || null,
    age: ageFromBirthDate(row.birth_date),
  }
}

// ─── Next game lookups ──────────────────────────────────────────────────────

interface NextGameLookup {
  game: NextGame
  opponentAbbr: string
}

/**
 * Next scheduled NFL game for a team. `nfl_games` stores both abbreviations and
 * full names, and which one is populated varies by row, so both are matched.
 */
async function loadNextNflGame(
  supabase: ReturnType<typeof createAdminClient>,
  teamAbbr: string
): Promise<NextGameLookup | null> {
  const abbr = teamAbbr.toUpperCase()
  // The abbreviation is interpolated into a PostgREST `or` filter below, so it
  // is re-validated here rather than trusting the caller to have done it.
  if (!/^[A-Z]{2,4}$/.test(abbr)) return null
  const fullName = getNflTeamFullName(abbr)
  const today = todayDateString()

  const orClauses = [`home_abbr.eq.${abbr}`, `away_abbr.eq.${abbr}`]
  if (fullName && fullName !== abbr) {
    orClauses.push(`home_team.eq.${fullName}`, `away_team.eq.${fullName}`)
  }

  const { data } = await supabase
    .from("nfl_games")
    .select("game_date, start_time, home_team, away_team, home_abbr, away_abbr, venue, week, status")
    .gte("game_date", today)
    .neq("status", "completed")
    .or(orClauses.join(","))
    .order("game_date", { ascending: true })
    .limit(1)

  const row = (data ?? [])[0] as Record<string, unknown> | undefined
  if (!row) return null

  const homeAbbr = ((row.home_abbr as string | null) ?? "").toUpperCase()
  const awayAbbr = ((row.away_abbr as string | null) ?? "").toUpperCase()
  const homeName = (row.home_team as string | null) ?? ""

  let isHome: boolean | null = null
  if (homeAbbr && awayAbbr) isHome = homeAbbr === abbr
  else if (homeName && fullName) isHome = homeName === fullName

  const opponentAbbr =
    isHome === true ? awayAbbr : isHome === false ? homeAbbr : awayAbbr || homeAbbr

  return {
    game: {
      gameDate: row.game_date as string,
      startTime: (row.start_time as string | null) || null,
      venue: (row.venue as string | null) || null,
      isHome,
      week: toNumberOrNull(row.week),
      status: (row.status as string | null) || null,
    },
    opponentAbbr,
  }
}

/**
 * Next scheduled game from `espn_games` (NHL / Soccer). That table stores team
 * *names*, so the abbreviation is resolved through the team index first.
 */
async function loadNextEspnGame(
  supabase: ReturnType<typeof createAdminClient>,
  league: string,
  teamName: string,
  teamsByAbbr: Map<string, EspnTeamRow>
): Promise<NextGameLookup | null> {
  const today = todayDateString()
  // Team names come from espn_teams, but a name containing a comma or paren
  // would break the `or` filter's grammar, so those rows are skipped.
  if (/[,()]/.test(teamName)) return null
  const { data } = await supabase
    .from("espn_games")
    .select("match_date, start_time, home_team, away_team, venue, week, status")
    .eq("league", league)
    .gte("match_date", today)
    .or(`home_team.eq.${teamName},away_team.eq.${teamName}`)
    .order("match_date", { ascending: true })
    .limit(1)

  const row = (data ?? [])[0] as Record<string, unknown> | undefined
  if (!row) return null

  const homeName = (row.home_team as string | null) ?? ""
  const awayName = (row.away_team as string | null) ?? ""
  const isHome = homeName ? homeName === teamName : null
  const opponentName = isHome === true ? awayName : homeName

  // Reverse-resolve the opponent's abbreviation from the team index.
  let opponentAbbr = ""
  for (const [abbr, team] of teamsByAbbr) {
    if (team.name === opponentName) {
      opponentAbbr = abbr
      break
    }
  }

  return {
    game: {
      gameDate: row.match_date as string,
      startTime: (row.start_time as string | null) || null,
      venue: (row.venue as string | null) || null,
      isHome,
      week: toNumberOrNull(row.week),
      status: (row.status as string | null) || null,
    },
    opponentAbbr: opponentAbbr || opponentName,
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Builds the contextual profile for a player.
 *
 * @param playerName Exact player name as returned by the prop engines.
 * @param teamAbbr   The player's team abbreviation.
 * @param sport      Sport key used across the props subsystem.
 * @param fallbackOpponentAbbr Opponent taken from the prop's matchup key, used
 *   when the schedule tables have no upcoming row (e.g. mid-week gaps).
 */
export async function getPlayerProfile(
  playerName: string,
  teamAbbr: string,
  sport: ProfileSport,
  fallbackOpponentAbbr?: string
): Promise<PlayerProfile> {
  const key = `player-profile:${sport}:${teamAbbr.toLowerCase()}:${playerName.toLowerCase()}:${
    fallbackOpponentAbbr?.toLowerCase() ?? ""
  }`

  return cached(
    key,
    () => computePlayerProfile(playerName, teamAbbr, sport, fallbackOpponentAbbr),
    CACHE_TTL_MS
  )
}

async function computePlayerProfile(
  playerName: string,
  teamAbbr: string,
  sport: ProfileSport,
  fallbackOpponentAbbr?: string
): Promise<PlayerProfile> {
  const supabase = createAdminClient()
  const league = SPORT_TO_ESPN_LEAGUE[sport]

  // NBA and Tennis aren't in the espn_* tables, so they get bio-only treatment.
  if (!league) {
    const bio = sport === "NBA" ? await loadNbaBio(supabase, playerName) : null
    const emptyRecords = new Map<string, TeamRecord>()
    return {
      player: playerName,
      sport,
      bio,
      team: buildTeamMeta(sport, teamAbbr, undefined, emptyRecords),
      opponent: fallbackOpponentAbbr
        ? buildTeamMeta(sport, fallbackOpponentAbbr, undefined, emptyRecords)
        : null,
      nextGame: null,
    }
  }

  const [teamsByAbbr, records, bio] = await Promise.all([
    loadEspnTeams(supabase, league),
    loadEspnStandings(supabase, league),
    loadEspnBio(supabase, league, playerName),
  ])

  const teamRow = teamsByAbbr.get(teamAbbr.toUpperCase())

  let lookup: NextGameLookup | null = null
  try {
    lookup =
      sport === "NFL"
        ? await loadNextNflGame(supabase, teamAbbr)
        : teamRow?.name
          ? await loadNextEspnGame(supabase, league, teamRow.name, teamsByAbbr)
          : null
  } catch {
    // A missing/failed schedule lookup must not sink the whole profile.
    lookup = null
  }

  const opponentAbbr = lookup?.opponentAbbr || fallbackOpponentAbbr || ""
  const team = buildTeamMeta(sport, teamAbbr, teamRow, records)
  const opponent = opponentAbbr
    ? buildTeamMeta(sport, opponentAbbr, teamsByAbbr.get(opponentAbbr.toUpperCase()), records)
    : null

  // The home team's venue is a reasonable stand-in when the schedule row has none.
  let nextGame = lookup?.game ?? null
  if (nextGame && !nextGame.venue) {
    const homeRow = nextGame.isHome === true ? teamRow : teamsByAbbr.get(opponentAbbr.toUpperCase())
    nextGame = { ...nextGame, venue: homeRow?.venue_name ?? null }
  }

  return { player: playerName, sport, bio, team, opponent, nextGame }
}
