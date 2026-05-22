/**
 * Engine V2 — Matchup-scoped, batch-optimized NBA props analytics.
 *
 * This module replaces the global sequential-fetch model with a pipeline
 * scoped to today's games, using parallel batch queries and a multi-factor
 * probability model (40% recent form + 35% defensive matchup + 25% pace).
 *
 * Created alongside engine.ts (V1) to allow rollback if issues arise.
 */

import { PropCardData } from "@/lib/props/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { parsePosition, Position } from "./position"
import {
  computeProbability,
  computePropLine,
  computeL5Average,
  computeL10Average,
  computeRecentForm,
} from "./probability"
import {
  computeProjection,
  computeL3Average,
  computeSeasonAverage,
  computeRestDays,
  ProjectionOutput,
  ProjectionMultipliers,
  BaseComponents,
} from "./projection"

// ─── Public Interfaces ──────────────────────────────────────────────────────

/**
 * Represents a single NBA game scheduled for today.
 */
export interface TodayGame {
  /** Home team 3-letter abbreviation */
  homeTeam: string
  /** Away team 3-letter abbreviation */
  awayTeam: string
  /** Game start time in ISO 8601 format */
  gameTime: string
  /** Current game status */
  status: "scheduled" | "live" | "final"
}

/**
 * A single data point for the per-prop mini graph.
 * Represents one game's stat value relative to the prop line.
 */
export interface GraphDataPoint {
  /** The stat value achieved in this game */
  value: number
  /** Game date in YYYY-MM-DD format */
  date: string
  /** Opponent team 3-letter abbreviation */
  opponent: string
  /** Whether the value met or exceeded the prop line */
  overLine: boolean
  /** Minutes played in this game */
  minutes: number
}

/**
 * Defensive matchup context for a prop, showing how the opposing team
 * defends against the player's position for the relevant stat category.
 */
export interface DefensiveMatchupInfo {
  /** Opposing team 3-letter abbreviation */
  opponentTeam: string
  /** Stat allowed per game to the player's position */
  statAllowedPerGame: number
  /** League average for this position-stat combination */
  leagueAverage: number
  /** Letter grade based on quintile ranking (A = easiest matchup, F = hardest) */
  grade: "A" | "B" | "C" | "D" | "F"
  /** Pace classification relative to league average */
  paceRating: "fast" | "average" | "slow"
}

/**
 * Enhanced prop card data scoped to today's matchups.
 * Extends the base PropCardData with probability model output,
 * mini graph data, position info, and defensive matchup context.
 */
export interface MatchupScopedProp extends PropCardData {
  /** Player's primary position (PG, SG, SF, PF, C) */
  position: string
  /** Probability of hitting the prop (best side, 0 to 1) */
  probability: number
  /** Direction for this prop (over/under) — whichever side has higher probability */
  direction: "over" | "under"
  /** Last 6 games data for the mini graph (chronological, oldest first) */
  graphData: GraphDataPoint[]
  /** Defensive matchup info (null if defensive stats unavailable) */
  defensiveMatchup: DefensiveMatchupInfo | null
  /** Projection output from the 3-layer formula */
  projection: ProjectionOutput | null
}

// ─── Internal Helper Types ──────────────────────────────────────────────────

/**
 * Raw player game row from the batch player stats query.
 */
export interface BatchPlayerGameRow {
  playerName: string
  team: string
  opponent: string
  gameDate: string
  homeTeam: string
  awayTeam: string
  statValue: number
  minutes: number
  position: string | null
}

/**
 * Result of the batch correlations query.
 * Maps player-stat identifier to their correlated props.
 */
export interface BatchCorrelationResult {
  propId: string
  player: string
  statCategory: string
  coefficient: number
}

/**
 * Result of the batch line movement query.
 * Maps player-stat identifier to line movement data.
 */
export interface BatchLineMovementRow {
  playerName: string
  statCategory: string
  lineValue: number
  recordedAt: string
}

/**
 * Defensive stats row from the nba_team_defense_stats table.
 */
export interface DefensiveStatsRow {
  team: string
  position: string
  statCategory: string
  valuePerGame: number
  pace: number | null
  gamesPlayed: number
}

/**
 * Options for the main computeMatchupScopedProps function.
 */
export interface MatchupScopedOptions {
  /** Direction for prop evaluation */
  direction: "over" | "under"
  /** Optional matchup filter (e.g., "LAL-GSW") */
  matchup?: string
  /** Override today's date (ISO date string, defaults to UTC today) */
  todayDate?: string
}

/**
 * Return type of the main computeMatchupScopedProps function.
 */
export interface MatchupScopedResult {
  /** Array of matchup-scoped prop cards sorted by probability descending */
  props: MatchupScopedProp[]
  /** Today's NBA games */
  todayGames: TodayGame[]
  /** Wall-clock milliseconds spent computing the result */
  computeTimeMs: number
  /** True when no games are scheduled today and we're showing all recent player data */
  fallbackMode?: boolean
}

// ─── Stat Category Mapping (reused from engine.ts) ──────────────────────────

/** Maps user-facing stat categories to NBA database column names */
const NBA_STAT_COLUMNS: Record<string, string> = {
  pts: "pts",
  points: "pts",
  reb: "trb",
  rebounds: "trb",
  trb: "trb",
  ast: "ast",
  assists: "ast",
  stl: "stl",
  steals: "stl",
  blk: "blk",
  blocks: "blk",
  "3pm": "tp",
  threes: "tp",
  tp: "tp",
  tov: "tov",
  turnovers: "tov",
  fg: "fg",
  fga: "fga",
  ft: "ft",
  fta: "fta",
}

// ─── Batch Data Fetching Functions ──────────────────────────────────────────

/** Maps full team names to 3-letter abbreviations (nba_games stores full names, nba_player_stats uses abbreviations) */
const TEAM_NAME_TO_ABBR: Record<string, string> = {
  "Atlanta Hawks": "ATL",
  "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",
  "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",
  "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",
  "Indiana Pacers": "IND",
  "Los Angeles Clippers": "LAC",
  "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",
}

/** Converts a team name to its abbreviation. If already an abbreviation, returns as-is. */
function toTeamAbbr(name: string): string {
  // If it's already a 3-letter abbreviation, return it
  if (name.length <= 3 && name === name.toUpperCase()) return name
  return TEAM_NAME_TO_ABBR[name] ?? name
}

/** Parses minutes from "MM:SS" text format or plain number to a numeric minute value. */
function parseMinutes(raw: any): number {
  if (raw == null) return 0
  const str = String(raw).trim()
  if (str.includes(":")) {
    const [mm, ss] = str.split(":")
    return Math.round(Number(mm) + Number(ss || 0) / 60)
  }
  return Math.round(Number(str)) || 0
}

/**
 * Fetches today's NBA games for a given date.
 * Returns games where game_date = date AND status IN ('scheduled', 'in_progress').
 */
export async function fetchTodayGames(date: string): Promise<TodayGame[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("nba_games")
    .select("home_team, away_team, game_date, status")
    .eq("game_date", date)
    .in("status", ["scheduled", "in_progress"])

  if (error || !data) {
    console.error("[engine-v2] Failed to fetch today's games:", error?.message)
    return []
  }

  return data.map((row: any) => ({
    homeTeam: toTeamAbbr(row.home_team),
    awayTeam: toTeamAbbr(row.away_team),
    gameTime: row.game_date,
    status: row.status === "in_progress" ? "live" : "scheduled",
  }))
}

/**
 * Fallback: Fetches all distinct teams that have player stats in the database.
 * Used when no games are scheduled today so we can still show props.
 * Returns up to 30 teams (all NBA teams).
 */
async function fetchRecentActiveTeams(): Promise<string[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("nba_player_stats")
    .select("team")
    .limit(1000)

  if (error || !data) {
    console.error("[engine-v2] Failed to fetch active teams:", error?.message)
    return []
  }

  // Extract unique teams
  const teams = [...new Set(data.map((row: any) => row.team as string).filter(Boolean))]
  return teams.slice(0, 30)
}

/**
 * Fetches player stats for all players on the given teams for a specific stat.
 * Single batch query with `.in('team', teams)` filter.
 * Only includes players with at least 3 games of data.
 */
export async function fetchBatchPlayerStats(
  teams: string[],
  stat: string
): Promise<Map<string, BatchPlayerGameRow[]>> {
  const supabase = createAdminClient()
  const column = NBA_STAT_COLUMNS[stat.toLowerCase()] ?? stat.toLowerCase()

  // Only fetch games from the last 90 days to get enough history for L30 charts
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 90)
  const cutoff = cutoffDate.toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("nba_player_stats")
    .select(`
      player_name,
      team,
      opponent,
      position,
      minutes,
      ${column},
      nba_games!inner(game_date, home_team, away_team)
    `)
    .in("team", teams)
    .gte("nba_games.game_date", cutoff)
    .order("nba_games(game_date)", { ascending: false })
    .limit(5000)

  if (error || !data) {
    console.error("[engine-v2] Failed to fetch batch player stats:", error?.message)
    return new Map()
  }

  // Group by player
  const playerMap = new Map<string, BatchPlayerGameRow[]>()

  for (const row of data as any[]) {
    const game = row.nba_games
    const statValue = Number(row[column]) || 0
    const playerName = row.player_name as string

    const entry: BatchPlayerGameRow = {
      playerName,
      team: row.team,
      opponent: row.opponent,
      gameDate: game.game_date,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      statValue,
      minutes: parseMinutes(row.minutes),
      position: row.position ?? null,
    }

    if (!playerMap.has(playerName)) {
      playerMap.set(playerName, [])
    }
    // Only include games where the player actually played (has minutes)
    if (entry.minutes > 0 || entry.statValue > 0) {
      playerMap.get(playerName)!.push(entry)
    }
  }

  // Filter out players with fewer than 5 recent games
  // AND players whose most recent game is older than 14 days (inactive/injured)
  const now = new Date()
  const recencyCutoffMs = 14 * 24 * 60 * 60 * 1000 // 14 days

  for (const [playerName, games] of playerMap) {
    if (games.length < 5) {
      playerMap.delete(playerName)
      continue
    }
    // games[0] is the most recent (sorted desc from DB)
    const mostRecentDate = new Date(games[0].gameDate)
    if (now.getTime() - mostRecentDate.getTime() > recencyCutoffMs) {
      playerMap.delete(playerName)
    }
  }

  return playerMap
}

/**
 * Fetches correlations for a batch of player-stat identifiers.
 * Single query using `.in('prop_a', ids)` combined with `.or(...)` to match
 * either prop_a or prop_b.
 */
export async function fetchBatchCorrelations(
  playerStatIds: string[]
): Promise<BatchCorrelationResult[]> {
  if (playerStatIds.length === 0) return []

  const supabase = createAdminClient()

  // Build OR filter to match either prop_a or prop_b in the given IDs
  const propAFilter = playerStatIds.map((id) => `prop_a.eq.${id}`).join(",")
  const propBFilter = playerStatIds.map((id) => `prop_b.eq.${id}`).join(",")

  const { data, error } = await supabase
    .from("correlations_cache")
    .select("prop_a, prop_b, coefficient")
    .eq("sport", "NBA")
    .or(`${propAFilter},${propBFilter}`)
    .gt("coefficient", 0.5)
    .order("coefficient", { ascending: false })

  if (error || !data) {
    console.error("[engine-v2] Failed to fetch batch correlations:", error?.message)
    return []
  }

  return data.map((row: any) => {
    // Determine which side is the "other" prop
    const isA = playerStatIds.includes(row.prop_a)
    const otherProp = isA ? row.prop_b : row.prop_a
    const [player, ...statParts] = otherProp.split("-")

    return {
      propId: otherProp,
      player: player || otherProp,
      statCategory: statParts.join("-") || "",
      coefficient: Number(row.coefficient),
    }
  })
}

/**
 * Fetches line movement data for a batch of player-stat combinations.
 * Single batch query on prop_line_history using OR filter.
 */
export async function fetchBatchLineMovement(
  playerStats: { name: string; stat: string }[]
): Promise<BatchLineMovementRow[]> {
  if (playerStats.length === 0) return []

  const supabase = createAdminClient()

  // Build OR filter for all player-stat combinations
  const orFilters = playerStats
    .map((ps) => `and(player_name.eq.${ps.name},stat_category.eq.${ps.stat})`)
    .join(",")

  const { data, error } = await supabase
    .from("prop_line_history")
    .select("player_name, stat_category, line_value, recorded_at")
    .eq("sport", "NBA")
    .or(orFilters)
    .order("recorded_at", { ascending: false })

  if (error || !data) {
    console.error("[engine-v2] Failed to fetch batch line movement:", error?.message)
    return []
  }

  return data.map((row: any) => ({
    playerName: row.player_name,
    statCategory: row.stat_category,
    lineValue: Number(row.line_value),
    recordedAt: row.recorded_at,
  }))
}

/**
 * Fetches positional defensive stats for the given teams and stat category.
 * Single query on `nba_team_defense_stats` with `.in('team', teams)`.
 */
export async function fetchPositionalDefense(
  teams: string[],
  stat: string
): Promise<DefensiveStatsRow[]> {
  if (teams.length === 0) return []

  const supabase = createAdminClient()

  // Map the user-facing stat to the defensive stat category
  // Defensive stats use category names like "pts", "trb", "ast", etc.
  const statCategory = NBA_STAT_COLUMNS[stat.toLowerCase()] ?? stat.toLowerCase()

  const { data, error } = await supabase
    .from("nba_team_defense_stats")
    .select("team, position, stat_category, value_per_game, pace, games_played")
    .in("team", teams)
    .eq("stat_category", statCategory)

  if (error || !data) {
    console.error("[engine-v2] Failed to fetch positional defense:", error?.message)
    return []
  }

  return data.map((row: any) => ({
    team: row.team,
    position: row.position,
    statCategory: row.stat_category,
    valuePerGame: Number(row.value_per_game) || 0,
    pace: row.pace != null ? Number(row.pace) : null,
    gamesPlayed: Number(row.games_played) || 0,
  }))
}

// ─── Graph Data & Defensive Matchup Helpers ─────────────────────────────────

/**
 * Builds the mini graph data array from a player's game history.
 *
 * Takes games in most-recent-first order (as returned from the database),
 * slices the last min(6, length) games, and reverses them to chronological
 * order (oldest to newest) for display.
 *
 * Each entry includes the stat value, game date, opponent, and whether
 * the value met or exceeded the prop line.
 */
export function buildGraphData(
  games: BatchPlayerGameRow[],
  propLine: number
): GraphDataPoint[] {
  if (games.length === 0) return []

  // Take all games (already in most-recent-first order)
  // Reverse to chronological order (oldest to newest)
  const chronological = games.slice().reverse()

  return chronological.map((game) => ({
    value: game.statValue,
    date: game.gameDate,
    opponent: game.opponent,
    overLine: game.statValue >= propLine,
    minutes: game.minutes,
  }))
}

/**
 * Computes a defensive grade (A/B/C/D/F) based on how much stat the opposing
 * team allows relative to the league average.
 *
 * Grading uses quintile-based thresholds around the league average:
 * - A: team allows >= 15% more than league average (easiest matchup, top 20%)
 * - B: team allows >= 5% more than league average (21-40%)
 * - C: team allows within ±5% of league average (41-60%)
 * - D: team allows >= 5% less than league average (61-80%)
 * - F: team allows >= 15% less than league average (hardest matchup, bottom 20%)
 *
 * Higher stat allowed = easier matchup for the player = better grade.
 */
export function computeDefensiveGrade(
  statAllowed: number,
  leagueAvg: number
): "A" | "B" | "C" | "D" | "F" {
  // Guard against division by zero
  if (leagueAvg === 0) return "C"

  const ratio = statAllowed / leagueAvg

  if (ratio >= 1.15) return "A"
  if (ratio >= 1.05) return "B"
  if (ratio >= 0.95) return "C"
  if (ratio >= 0.85) return "D"
  return "F"
}

/**
 * Computes a pace rating based on the opposing team's pace relative to
 * the league average pace.
 *
 * - "fast": pace > leagueAvgPace + 2
 * - "slow": pace < leagueAvgPace - 2
 * - "average": within ±2 of league average, or if pace is null
 */
export function computePaceRating(
  pace: number | null,
  leagueAvgPace: number
): "fast" | "average" | "slow" {
  if (pace === null) return "average"
  if (pace > leagueAvgPace + 2) return "fast"
  if (pace < leagueAvgPace - 2) return "slow"
  return "average"
}



// ─── Matchup Validation ─────────────────────────────────────────────────────

/**
 * Validates matchup parameter format: two 3-letter alphabetic abbreviations
 * separated by a hyphen (e.g., "LAL-GSW").
 */
export function isValidMatchupFormat(matchup: string): boolean {
  return /^[A-Z]{3}-[A-Z]{3}$/i.test(matchup)
}

// ─── Main Orchestrator Function ─────────────────────────────────────────────

/**
 * Computes matchup-scoped props for today's NBA games.
 *
 * This is the main entry point for the V2 engine. It:
 * 1. Determines today's date (UTC) or uses the provided todayDate
 * 2. Fetches today's games
 * 3. Extracts team abbreviations (or uses matchup filter)
 * 4. Runs parallel batch queries via Promise.allSettled
 * 5. Computes probability for each player
 * 6. Sorts by probability descending, then player name ascending for ties
 * 7. Returns { props, todayGames, computeTimeMs }
 */
export async function computeMatchupScopedProps(
  sport: "NBA" | "Tennis",
  stat: string,
  options: MatchupScopedOptions
): Promise<MatchupScopedResult> {
  const { direction, matchup, todayDate } = options

  // Determine today's date in UTC
  const today = todayDate ?? new Date().toISOString().split("T")[0]

  // Cache key includes date to avoid serving stale yesterday's data
  // Direction is NOT included — engine returns both over and under, filtering happens at API layer
  const cacheKey = `matchup-props:${sport}:${stat}:${today}`

  return cached(
    cacheKey,
    () => computeMatchupScopedPropsUncached(sport, stat, direction, matchup, today),
    60_000
  )
}

/**
 * Internal uncached implementation of the orchestrator.
 */
async function computeMatchupScopedPropsUncached(
  sport: "NBA" | "Tennis",
  stat: string,
  direction: "over" | "under",
  matchup: string | undefined,
  today: string
): Promise<MatchupScopedResult> {
  const startTime = Date.now()

  // Validate matchup format if provided
  if (matchup && !isValidMatchupFormat(matchup)) {
    return {
      props: [],
      todayGames: [],
      computeTimeMs: Date.now() - startTime,
    }
  }

  // Step 1: Fetch today's games
  const todayGames = await fetchTodayGames(today)

  // Step 2: Determine which teams to query
  let teams: string[]
  let isFallbackMode = false
  if (matchup) {
    // Use the matchup filter teams
    const [teamA, teamB] = matchup.toUpperCase().split("-")
    teams = [teamA, teamB]
  } else {
    // Extract all teams from today's games
    teams = todayGames.flatMap((g) => [g.homeTeam, g.awayTeam])
  }

  // Deduplicate teams
  teams = [...new Set(teams)]

  // If no teams from today's games, fallback to all teams with recent data
  if (teams.length === 0) {
    isFallbackMode = true
    teams = await fetchRecentActiveTeams()
    if (teams.length === 0) {
      return {
        props: [],
        todayGames,
        computeTimeMs: Date.now() - startTime,
      }
    }
  }

  // Step 3: Fetch player stats directly (simplified from Promise.allSettled)
  const statColumn = NBA_STAT_COLUMNS[stat.toLowerCase()] ?? stat.toLowerCase()

  const playerStatsMap = await fetchBatchPlayerStats(teams, stat)

  // If player stats query failed, we can't compute any props
  if (playerStatsMap.size === 0) {
    return {
      props: [],
      todayGames,
      computeTimeMs: Date.now() - startTime,
    }
  }

  // Collect all opponent teams from today's games and player game history for defensive stats lookup
  const opponentTeams = new Set<string>()
  // Add opponents from today's scheduled games first
  for (const game of todayGames) {
    opponentTeams.add(game.homeTeam)
    opponentTeams.add(game.awayTeam)
  }
  // Also add historical opponents as fallback for defensive stats
  for (const [, games] of playerStatsMap) {
    if (games.length > 0) {
      const latestGame = games[0]
      const playerTeam = latestGame.team
      const homeAbbr = toTeamAbbr(latestGame.homeTeam)
      const awayAbbr = toTeamAbbr(latestGame.awayTeam)
      const opp = homeAbbr === playerTeam ? awayAbbr : homeAbbr
      opponentTeams.add(opp)
    }
  }

  // Fetch defensive stats for opponent teams (not just today's teams)
  const defenseTeams = [...new Set([...teams, ...opponentTeams])]
  const defensiveStats = await fetchPositionalDefense(defenseTeams, stat).catch(() => null)

  // Now run correlations and line movement with actual player data
  const playerStatIds = Array.from(playerStatsMap.keys()).map(
    (name) => `${name}-${statColumn}`
  )
  const playerStatPairs = Array.from(playerStatsMap.keys()).map((name) => ({
    name,
    stat: statColumn,
  }))

  const [correlationsResult2, lineMovementResult2] = await Promise.allSettled([
    fetchBatchCorrelations(playerStatIds),
    fetchBatchLineMovement(playerStatPairs),
  ])

  const correlations =
    correlationsResult2.status === "fulfilled" ? correlationsResult2.value : null
  const lineMovement =
    lineMovementResult2.status === "fulfilled" ? lineMovementResult2.value : null

  // Step 4: Build defensive stats lookup maps
  // Map: team -> position -> DefensiveStatsRow
  const defenseByTeamPosition = new Map<string, Map<string, DefensiveStatsRow>>()
  // Collect all league defensive values and pace values for normalization
  const leagueDefensiveValues: number[] = []
  const leaguePaceValues: number[] = []

  if (defensiveStats) {
    for (const row of defensiveStats) {
      if (!defenseByTeamPosition.has(row.team)) {
        defenseByTeamPosition.set(row.team, new Map())
      }
      defenseByTeamPosition.get(row.team)!.set(row.position, row)

      // Collect values for normalization (exclude TEAM-level pace entries from defensive values)
      if (row.position !== "TEAM") {
        leagueDefensiveValues.push(row.valuePerGame)
      }
      if (row.pace !== null) {
        leaguePaceValues.push(row.pace)
      }
    }
  }

  // Compute league average for defensive stats (mean of all positional values)
  const leagueAvgDefense =
    leagueDefensiveValues.length > 0
      ? leagueDefensiveValues.reduce((s, v) => s + v, 0) / leagueDefensiveValues.length
      : 0

  // Compute league average pace
  const leagueAvgPace =
    leaguePaceValues.length > 0
      ? leaguePaceValues.reduce((s, v) => s + v, 0) / leaguePaceValues.length
      : 100 // default pace

  // Step 5: Build line movement lookup
  const lineMovementByPlayer = new Map<string, BatchLineMovementRow[]>()
  if (lineMovement) {
    for (const row of lineMovement) {
      if (!lineMovementByPlayer.has(row.playerName)) {
        lineMovementByPlayer.set(row.playerName, [])
      }
      lineMovementByPlayer.get(row.playerName)!.push(row)
    }
  }

  // Step 6: Compute props for each player

  // Build a lookup map from todayGames: team abbreviation → upcoming opponent abbreviation
  const todayMatchupMap = new Map<string, string>()
  for (const game of todayGames) {
    todayMatchupMap.set(game.homeTeam, game.awayTeam)
    todayMatchupMap.set(game.awayTeam, game.homeTeam)
  }

  const props: MatchupScopedProp[] = []

  for (const [playerName, games] of playerStatsMap) {
    // games are sorted most recent first
    const statValues = games.map((g) => g.statValue)

    // Compute prop line
    const propLine = computePropLine(statValues)
    if (propLine <= 0) continue

    // Compute averages
    const l5Avg = computeL5Average(statValues)
    const l10Avg = computeL10Average(statValues)

    // Determine player's position
    const rawPosition = games[0]?.position ?? null
    const position = parsePosition(rawPosition)

    // Determine opponent team from today's schedule (preferred) or fallback to last game
    const playerTeam = games[0]?.team
    const latestGame = games[0]
    // Convert full team names from nba_games to abbreviations for comparison
    const homeTeamAbbr = toTeamAbbr(latestGame.homeTeam)
    const awayTeamAbbr = toTeamAbbr(latestGame.awayTeam)
    // Use today's scheduled matchup if available, otherwise fall back to last game's opponent
    const opponentTeam = todayMatchupMap.get(playerTeam)
      ?? (homeTeamAbbr === playerTeam ? awayTeamAbbr : homeTeamAbbr)

    // Get defensive stat for this player's position against the opponent
    let defensiveStatAllowed: number | null = null
    let opponentPace: number | null = null

    if (defensiveStats && defenseByTeamPosition.has(opponentTeam)) {
      const teamDefense = defenseByTeamPosition.get(opponentTeam)!

      if (position && teamDefense.has(position)) {
        // Use positional defense
        defensiveStatAllowed = teamDefense.get(position)!.valuePerGame
      } else {
        // Fallback: mean of all 5 positions for this team
        const positionalValues: number[] = []
        for (const pos of ["PG", "SG", "SF", "PF", "C"]) {
          const row = teamDefense.get(pos)
          if (row) positionalValues.push(row.valuePerGame)
        }
        if (positionalValues.length > 0) {
          defensiveStatAllowed =
            positionalValues.reduce((s, v) => s + v, 0) / positionalValues.length
        }
      }

      // Get pace from TEAM-level entry
      const teamPaceRow = teamDefense.get("TEAM")
      if (teamPaceRow && teamPaceRow.pace !== null) {
        opponentPace = teamPaceRow.pace
      }
    }

    // Compute probability (legacy — kept for fallback/reference)
    const probabilityResult = computeProbability({
      recentGames: statValues,
      propLine,
      defensiveStatAllowed,
      leagueDefensiveValues,
      opponentPace,
      leaguePaceValues,
    })

    // Build graph data
    const graphData = buildGraphData(games, propLine)

    // Build defensive matchup info
    let defensiveMatchup: DefensiveMatchupInfo | null = null
    if (defensiveStatAllowed !== null) {
      defensiveMatchup = {
        opponentTeam,
        statAllowedPerGame: Math.round(defensiveStatAllowed * 10) / 10,
        leagueAverage: Math.round(leagueAvgDefense * 10) / 10,
        grade: computeDefensiveGrade(defensiveStatAllowed, leagueAvgDefense),
        paceRating: computePaceRating(opponentPace, leagueAvgPace),
      }
    }

    // Compute hit rate
    const recentForm = computeRecentForm(statValues, propLine)
    const overCount = statValues.slice(0, Math.min(10, statValues.length)).filter(
      (v) => v >= propLine
    ).length
    const totalGames = Math.min(10, statValues.length)

    // Compute trend
    const trend = computeTrend(statValues)
    const trendPct = computeTrendPct(statValues)

    // ─── Projection (3-Layer Formula) — PRIMARY SIGNAL ────────────────────

    // Determine venue for upcoming game
    let upcomingVenue: "home" | "away" | null = null
    const todayGame = todayGames.find(
      (g) => g.homeTeam === playerTeam || g.awayTeam === playerTeam
    )
    if (todayGame) {
      upcomingVenue = todayGame.homeTeam === playerTeam ? "home" : "away"
    }

    // Compute rest days from game dates (days between most recent game and today)
    let restDays: number | null = null
    if (games.length >= 1) {
      const mostRecentGameDate = games[0].gameDate
      restDays = computeRestDays(today, mostRecentGameDate)
    }

    // Compute minutes projection from recent average (L5 minutes)
    let minutesProjection: number | null = null
    const recentMinutes = games.slice(0, 5).map((g) => g.minutes).filter((m) => m > 0)
    if (recentMinutes.length > 0) {
      minutesProjection = Math.round(
        recentMinutes.reduce((s, m) => s + m, 0) / recentMinutes.length
      )
    }

    // Compute opponent defensive rank (1-30) for this stat category
    // Rank 1 = allows the most (worst defense = best for player)
    let oppDefRank: number | null = null
    if (defensiveStatAllowed !== null && leagueDefensiveValues.length >= 5) {
      // Sort all team defensive values descending (most allowed first)
      const sortedDefValues = [...new Set(leagueDefensiveValues)].sort((a, b) => b - a)
      // Find where this opponent's value ranks
      const rank = sortedDefValues.findIndex((v) => defensiveStatAllowed! >= v) + 1
      // Scale to 1-30 range
      oppDefRank = Math.max(1, Math.min(30, Math.round(
        (rank / sortedDefValues.length) * 30
      )))
    }

    // Compute opponent pace rank (1-30, 1 = fastest)
    let oppPaceRank: number | null = null
    if (opponentPace !== null && leaguePaceValues.length >= 5) {
      const sortedPaceValues = [...new Set(leaguePaceValues)].sort((a, b) => b - a)
      const rank = sortedPaceValues.findIndex((v) => opponentPace! >= v) + 1
      oppPaceRank = Math.max(1, Math.min(30, Math.round(
        (rank / sortedPaceValues.length) * 30
      )))
    }

    // Season average
    const seasonAvg = computeSeasonAverage(statValues)

    // Compute projection using the 3-layer formula
    const projectionResult = computeProjection({
      recentGames: statValues,
      seasonAvg,
      oppDefRank,
      oppPaceRank,
      venue: upcomingVenue,
      restDays,
      minutesProjection,
      bookLine: null, // We don't have book lines — stop after Step 2
    })

    // ─── Direction & Quality from Projection + Hit Rate (PRIMARY) ────────
    // The projection tells us the predicted value.
    // The hit rate validates whether the direction is historically supported.
    // Both must agree for a prop to be shown.

    const projectedValue = projectionResult.projection

    // Compute hit rates for both directions
    const overHitRate = totalGames > 0 ? overCount / totalGames : 0
    const underHitRate = totalGames > 0 ? (totalGames - overCount) / totalGames : 0

    // Determine direction: use hit rate as the primary signal
    // Over = hit rate >= 60% (6/10 or better)
    // Under = under hit rate >= 60% (i.e., over hit rate <= 40%)
    // Skip = neither direction has a strong enough hit rate (40-60% = coin flip)
    let bestDirection: "over" | "under"
    let hitRateForDirection: number

    if (overHitRate >= 0.6) {
      bestDirection = "over"
      hitRateForDirection = overHitRate
    } else if (underHitRate >= 0.6) {
      bestDirection = "under"
      hitRateForDirection = underHitRate
    } else {
      // Neither direction is strong enough — skip this prop
      continue
    }

    // Validate: projection must agree with the hit-rate direction
    // If hit rate says "over" but projection is below the line, skip (conflicting signals)
    // If hit rate says "under" but projection is above the line, skip (conflicting signals)
    const projectionAgreesWithDirection =
      (bestDirection === "over" && projectedValue >= propLine) ||
      (bestDirection === "under" && projectedValue <= propLine)

    // If projection disagrees, we still show it but with lower confidence
    // (hit rate is the truth, projection is the model's estimate)

    // Probability: based on hit rate strength, boosted if projection agrees
    let bestProbability: number
    if (projectionAgreesWithDirection) {
      // Both signals agree — high confidence
      bestProbability = Math.min(0.99, hitRateForDirection + 0.05)
    } else {
      // Hit rate is strong but projection disagrees — moderate confidence
      // Still show it because hit rate is empirical data
      bestProbability = Math.max(0.50, hitRateForDirection - 0.10)
    }

    // Build the prop card
    const prop: MatchupScopedProp = {
      id: `${playerName.toLowerCase().replace(/\s+/g, "-")}-${stat}`,
      player: playerName,
      team: playerTeam,
      statCategory: stat,
      propLine,
      l5Avg,
      l10Avg,
      lastGames: graphData.map((gd) => ({
        value: gd.value,
        overLine: gd.overLine,
        date: gd.date,
        opponent: gd.opponent,
        minutes: gd.minutes,
      })),
      hitRate: {
        over: overCount,
        total: totalGames,
        label: `${overCount}/${totalGames}`,
      },
      trend,
      trendPct,
      matchup: opponentTeam,
      sport: "NBA",
      position: position ?? "N/A",
      probability: bestProbability,
      direction: bestDirection,
      graphData,
      defensiveMatchup,
      projection: projectionResult,
    }

    props.push(prop)
  }

  // Step 7: Show both over and under props — sort by projection strength (strongest signal first)
  // Direction filtering is handled at the API/UI layer, not here
  let filteredProps = props

  // Sort by projection deviation from prop line (strongest signal first)
  filteredProps.sort((a, b) => {
    const aDeviation = a.projection
      ? Math.abs(a.projection.projection - a.propLine) / (a.propLine || 1)
      : 0
    const bDeviation = b.projection
      ? Math.abs(b.projection.projection - b.propLine) / (b.propLine || 1)
      : 0
    if (bDeviation !== aDeviation) {
      return bDeviation - aDeviation
    }
    // Secondary: higher projection value
    const aProj = a.projection?.projection ?? 0
    const bProj = b.projection?.projection ?? 0
    if (bProj !== aProj) {
      return bProj - aProj
    }
    return a.player.localeCompare(b.player)
  })

  const computeTimeMs = Date.now() - startTime

  return {
    props: filteredProps,
    todayGames,
    computeTimeMs,
    fallbackMode: isFallbackMode,
  }
}

// ─── Trend Helpers ──────────────────────────────────────────────────────────

/**
 * Computes trend direction based on L5 vs L10 comparison.
 */
function computeTrend(statValues: number[]): "up" | "down" | "neutral" {
  if (statValues.length < 5) return "neutral"

  const l5 = computeL5Average(statValues)
  const l10 = computeL10Average(statValues)

  if (l5 > l10 * 1.05) return "up"
  if (l5 < l10 * 0.95) return "down"
  return "neutral"
}

/**
 * Computes trend percentage as the absolute difference between L5 and L10
 * relative to L10, capped at 100.
 */
function computeTrendPct(statValues: number[]): number {
  if (statValues.length < 5) return 0

  const l5 = computeL5Average(statValues)
  const l10 = computeL10Average(statValues)

  if (l10 === 0) return 0

  const pct = Math.round(Math.abs((l5 - l10) / l10) * 100)
  return Math.min(pct, 100)
}
