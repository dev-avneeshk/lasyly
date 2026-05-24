/**
 * Enhanced Props Aggregator Engine
 *
 * Orchestrates hit rate computation, matchup grading, confidence scoring,
 * correlations lookup, and line movement for all props in a given sport/stat.
 *
 * Uses the project's existing `cached()` pattern with 60s TTL.
 */

import { cached, CACHE_TTL } from "@/lib/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { computeHitRates, HitRateWindow } from "./hit-rates"
import { computeMatchupGrade, MatchupGrade } from "./matchup-grades"
import { computeConfidenceScore, ConfidenceBreakdown } from "./confidence-score"
import {
  EnhancedPropCardData,
  AdvancedFilterState,
  CorrelatedProp,
  LineMovementData,
} from "./types"

// ─── Constants ──────────────────────────────────────────────────────────────

/** Minimum games required to include a player in results */
const MIN_GAMES = 3

/** Number of recent games used to compute the prop line (median) */
const PROP_LINE_WINDOW = 10

/** Cache TTL for enhanced props (60 seconds) */
const ENHANCED_PROPS_TTL = 60_000

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Creates a URL-safe slug from a player name.
 * Removes apostrophes, replaces spaces with hyphens, lowercases.
 * e.g., "De'Aaron Fox" → "deaaron-fox"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "")       // remove apostrophes/quotes
    .replace(/[^a-z0-9\s-]/g, "") // remove other special chars
    .replace(/\s+/g, "-")         // spaces to hyphens
    .replace(/-+/g, "-")          // collapse multiple hyphens
    .trim()
}

// ─── Stat Category Mapping ──────────────────────────────────────────────────

/** Maps user-facing stat categories to NBA database column names */
const NBA_STAT_COLUMNS: Record<string, string> = {
  pts: "pts",
  points: "pts",
  reb: "trb",
  rebounds: "trb",
  ast: "ast",
  assists: "ast",
  stl: "stl",
  steals: "stl",
  blk: "blk",
  blocks: "blk",
  "3pm": "tp",
  threes: "tp",
  tov: "tov",
  turnovers: "tov",
  fg: "fg",
  fga: "fga",
  ft: "ft",
  fta: "fta",
}

/** Maps user-facing stat categories to Tennis database column names */
const TENNIS_STAT_COLUMNS: Record<string, string> = {
  aces: "aces_per_match",
  "double_faults": "dfs_per_match",
  "first_serve_pct": "first_serve_pct",
  "first_serve_win_pct": "first_serve_win_pct",
  "second_serve_win_pct": "second_serve_win_pct",
  "hold_pct": "hold_pct",
  "win_pct": "win_pct",
  "sets_won": "sets_won",
  "sets_lost": "sets_lost",
  "games_won": "games_won",
  "games_lost": "games_lost",
}

/** Tennis stats that live in tennis_raw_stats instead of tennis_serve_stats */
const TENNIS_RAW_STAT_KEYS = new Set(["win_pct", "sets_won", "sets_lost", "games_won", "games_lost"])

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Rounds a value to the nearest 0.5.
 */
function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2
}

/**
 * Computes the median of a numeric array.
 * Returns 0 for empty arrays.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

// ─── NBA Data Fetching ──────────────────────────────────────────────────────

interface NBAPlayerGameRow {
  player_name: string
  team: string
  opponent: string
  game_date: string
  home_team: string
  away_team: string
  stat_value: number
}

/**
 * Fetches NBA player game data for a given stat category.
 * Joins nba_player_stats with nba_games to get game dates and venue info.
 */
async function fetchNBAPlayerData(
  stat: string
): Promise<Map<string, NBAPlayerGameRow[]>> {
  const supabase = createAdminClient()
  const column = NBA_STAT_COLUMNS[stat.toLowerCase()] ?? stat.toLowerCase()

  // Fetch player stats joined with game info, ordered by game date descending
  const { data, error } = await supabase
    .from("nba_player_stats")
    .select(`
      player_name,
      team,
      opponent,
      ${column},
      nba_games!inner(game_date, home_team, away_team)
    `)
    .order("nba_games(game_date)", { ascending: false })

  if (error || !data) {
    console.error("[engine] Failed to fetch NBA player data:", error?.message)
    return new Map()
  }

  // Group by player
  const playerMap = new Map<string, NBAPlayerGameRow[]>()

  for (const row of data as any[]) {
    const game = row.nba_games
    const statValue = Number(row[column]) || 0
    const playerName = row.player_name as string

    const entry: NBAPlayerGameRow = {
      player_name: playerName,
      team: row.team,
      opponent: row.opponent,
      game_date: game.game_date,
      home_team: game.home_team,
      away_team: game.away_team,
      stat_value: statValue,
    }

    if (!playerMap.has(playerName)) {
      playerMap.set(playerName, [])
    }
    playerMap.get(playerName)!.push(entry)
  }

  return playerMap
}

// ─── Tennis Data Fetching ───────────────────────────────────────────────────

interface TennisPlayerRow {
  player_name: string
  stat_value: number
  matches_played: number
  surface: string
  upcoming_opponent?: string | null
}

/**
 * Fetches Tennis player aggregate stats for a given stat category.
 * Tennis data is aggregated per surface/year, not per-match.
 * win_pct / sets / games live in tennis_raw_stats; all others in tennis_serve_stats.
 * Also joins tennis_matches to find each player's next upcoming opponent.
 */
async function fetchTennisPlayerData(
  stat: string
): Promise<TennisPlayerRow[]> {
  const supabase = createAdminClient()
  const column = TENNIS_STAT_COLUMNS[stat.toLowerCase()] ?? stat.toLowerCase()
  const table = TENNIS_RAW_STAT_KEYS.has(stat.toLowerCase()) ? "tennis_raw_stats" : "tennis_serve_stats"

  // Fetch stats and upcoming matches in parallel
  const [statsResult, matchesResult] = await Promise.all([
    supabase
      .from(table)
      .select(`player_name, ${column}, matches_played, surface`)
      .not(column, "is", null)
      .order("matches_played", { ascending: false }),
    supabase
      .from("tennis_matches")
      .select("player1_name, player2_name")
      .eq("status", "upcoming"),
  ])

  if (statsResult.error || !statsResult.data) {
    console.error("[engine] Failed to fetch Tennis player data:", statsResult.error?.message)
    return []
  }

  // Build opponent lookup: player_name -> opponent_name
  const opponentMap = new Map<string, string>()
  for (const match of (matchesResult.data ?? [])) {
    if (match.player1_name && match.player2_name) {
      opponentMap.set(match.player1_name, match.player2_name)
      opponentMap.set(match.player2_name, match.player1_name)
    }
  }

  return (statsResult.data as any[]).map((row) => ({
    player_name: row.player_name,
    stat_value: Number(row[column]) || 0,
    matches_played: row.matches_played || 0,
    surface: row.surface,
    upcoming_opponent: opponentMap.get(row.player_name) ?? null,
  }))
}

// ─── Matchup Data ───────────────────────────────────────────────────────────

/**
 * Fetches defensive stats for all NBA teams for a given stat category.
 * Returns a map of team -> average stat allowed per game (last 10 games).
 */
async function fetchNBADefensiveStats(
  stat: string
): Promise<Map<string, { avgAllowed: number; gamesPlayed: number }>> {
  const supabase = createAdminClient()
  const column = NBA_STAT_COLUMNS[stat.toLowerCase()] ?? stat.toLowerCase()

  // Get all player stats grouped by opponent (which is the defensive team)
  const { data, error } = await supabase
    .from("nba_player_stats")
    .select(`opponent, ${column}, nba_games!inner(game_date)`)
    .order("nba_games(game_date)", { ascending: false })

  if (error || !data) {
    console.error("[engine] Failed to fetch defensive stats:", error?.message)
    return new Map()
  }

  // Aggregate: sum stat values allowed per team per game
  const teamGameStats = new Map<string, Map<string, number>>()

  for (const row of data as any[]) {
    const team = row.opponent as string
    const gameDate = row.nba_games.game_date as string
    const value = Number(row[column]) || 0

    if (!teamGameStats.has(team)) {
      teamGameStats.set(team, new Map())
    }
    const gameMap = teamGameStats.get(team)!
    gameMap.set(gameDate, (gameMap.get(gameDate) || 0) + value)
  }

  // Compute average allowed per game (last 10 games)
  const result = new Map<string, { avgAllowed: number; gamesPlayed: number }>()

  for (const [team, gameMap] of teamGameStats) {
    const gameTotals = [...gameMap.values()]
    const recent = gameTotals.slice(0, 10) // already sorted by date desc
    const gamesPlayed = recent.length
    const avgAllowed = gamesPlayed > 0
      ? recent.reduce((sum, v) => sum + v, 0) / gamesPlayed
      : 0

    result.set(team, { avgAllowed, gamesPlayed })
  }

  return result
}

// ─── Correlations Lookup ────────────────────────────────────────────────────

/**
 * Fetches pre-computed correlations for a given player-stat from the cache table.
 */
async function fetchCorrelations(
  sport: "NBA" | "Tennis",
  playerStat: string
): Promise<CorrelatedProp[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("correlations_cache")
    .select("prop_a, prop_b, coefficient")
    .eq("sport", sport)
    .or(`prop_a.eq.${playerStat},prop_b.eq.${playerStat}`)
    .gt("coefficient", 0.5)
    .order("coefficient", { ascending: false })
    .limit(3)

  if (error || !data) {
    return []
  }

  return data.map((row: any) => {
    const otherProp = row.prop_a === playerStat ? row.prop_b : row.prop_a
    const [player, ...statParts] = otherProp.split("-")
    return {
      propId: otherProp,
      player: player || otherProp,
      statCategory: statParts.join("-") || "",
      coefficient: Number(row.coefficient),
    }
  })
}

// ─── Line Movement Lookup ───────────────────────────────────────────────────

/**
 * Fetches line movement data for a player-stat combination.
 */
async function fetchLineMovement(
  playerName: string,
  sport: string,
  statCategory: string
): Promise<LineMovementData | null> {
  const supabase = createAdminClient()

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("prop_line_history")
    .select("line_value, recorded_at")
    .eq("player_name", playerName)
    .eq("sport", sport)
    .eq("stat_category", statCategory)
    .order("recorded_at", { ascending: false })
    .limit(100)

  if (error || !data || data.length < 2) {
    return null
  }

  const currentLine = Number(data[0].line_value)
  const history = data.map((row: any) => ({
    timestamp: row.recorded_at,
    value: Number(row.line_value),
  }))

  // Find the line value from ~24h ago
  const olderEntries = data.filter(
    (row: any) => new Date(row.recorded_at).getTime() <= new Date(twentyFourHoursAgo).getTime()
  )
  const previousLine = olderEntries.length > 0
    ? Number(olderEntries[0].line_value)
    : Number(data[data.length - 1].line_value)

  if (currentLine === previousLine) {
    return null
  }

  const change = Math.abs(currentLine - previousLine)
  const direction: "up" | "down" = currentLine > previousLine ? "up" : "down"

  // Significant move: >= 10% from earliest in 24h window
  const recentEntries = data.filter(
    (row: any) => new Date(row.recorded_at).getTime() > new Date(twentyFourHoursAgo).getTime()
  )
  const earliest24h = recentEntries.length > 0
    ? Number(recentEntries[recentEntries.length - 1].line_value)
    : previousLine
  const hasSignificantMove = earliest24h > 0
    ? Math.abs(currentLine - earliest24h) / earliest24h >= 0.10
    : false

  return {
    currentLine,
    previousLine,
    change: Math.round(change * 10) / 10,
    direction,
    hasSignificantMove,
    history,
  }
}

// ─── Main Engine Function ───────────────────────────────────────────────────

/**
 * Computes enhanced prop card data for a given sport and stat category.
 *
 * Orchestrates:
 * - Fetching player game data from Supabase
 * - Computing prop lines (median of last 10 games, rounded to nearest 0.5)
 * - Computing multi-window hit rates
 * - Computing matchup grades
 * - Computing confidence scores
 * - Looking up correlations from correlations_cache
 * - Looking up line movement from prop_line_history
 *
 * Results are cached in-memory with 60s TTL using the project's `cached()` utility.
 *
 * @param sport - "NBA" or "Tennis"
 * @param stat - The stat category (e.g., "pts", "aces")
 * @param filters - Optional advanced filters to narrow results
 * @returns Array of EnhancedPropCardData sorted by L10 hit rate descending
 */
export async function computeEnhancedProps(
  sport: "NBA" | "Tennis",
  stat: string,
  filters?: Partial<AdvancedFilterState>
): Promise<EnhancedPropCardData[]> {
  const cacheKey = `enhanced-props:${sport}:${stat}:${JSON.stringify(filters ?? {})}`

  return cached(cacheKey, async () => {
    if (sport === "NBA") {
      return computeNBAEnhancedProps(stat, filters)
    } else {
      return computeTennisEnhancedProps(stat, filters)
    }
  }, ENHANCED_PROPS_TTL)
}

// ─── NBA Enhanced Props ─────────────────────────────────────────────────────

async function computeNBAEnhancedProps(
  stat: string,
  filters?: Partial<AdvancedFilterState>
): Promise<EnhancedPropCardData[]> {
  // Fetch data in parallel
  const [playerDataMap, defensiveStats] = await Promise.all([
    fetchNBAPlayerData(stat),
    fetchNBADefensiveStats(stat),
  ])

  const allDefensiveValues = [...defensiveStats.values()].map((d) => d.avgAllowed)
  const results: EnhancedPropCardData[] = []

  for (const [playerName, games] of playerDataMap) {
    // Skip players with insufficient data
    if (games.length < MIN_GAMES) continue

    const gameValues = games.map((g) => g.stat_value)
    const team = games[0].team
    const upcomingOpponent = games[0].opponent // Most recent opponent as proxy

    // Compute prop line: median of last 10 games, rounded to nearest 0.5
    const recentGames = gameValues.slice(0, PROP_LINE_WINDOW)
    const propLine = roundToHalf(median(recentGames))

    // Skip if prop line is 0 (no meaningful prop)
    if (propLine <= 0) continue

    // Compute multi-window hit rates
    // For vsOpp, filter games against the upcoming opponent
    const vsOppGames = games
      .filter((g) => g.opponent === upcomingOpponent)
      .map((g) => g.stat_value)
    const hitRateWindows = computeHitRates(gameValues, propLine, vsOppGames)

    // Compute matchup grade
    const opponentDef = defensiveStats.get(upcomingOpponent)
    let matchupGrade: MatchupGrade | null = null
    if (opponentDef && allDefensiveValues.length >= 5) {
      matchupGrade = computeMatchupGrade(
        opponentDef.avgAllowed,
        allDefensiveValues,
        opponentDef.gamesPlayed
      )
    }

    // Compute confidence score
    const l5Window = hitRateWindows.find((w) => w.window === "L5")
    const l10Window = hitRateWindows.find((w) => w.window === "L10")
    const l5HitRate = l5Window?.available ? l5Window.hitRate : 0
    const l10HitRate = l10Window?.available ? l10Window.hitRate : 0

    const confidence: ConfidenceBreakdown | null = computeConfidenceScore(
      l5HitRate,
      l10HitRate,
      matchupGrade,
      games.length
    )

    // Look up correlations
    const propIdentifier = `${playerName}-${stat}`
    const propSlug = `${slugify(playerName)}-${stat}`
    const correlations = await fetchCorrelations("NBA", propIdentifier)

    // Look up line movement
    const lineMovement = await fetchLineMovement(playerName, "NBA", stat)

    // Determine venue from most recent game
    const latestGame = games[0]
    const venue: "home" | "away" | null = latestGame
      ? latestGame.home_team === team
        ? "home"
        : "away"
      : null

    // Compute trend
    const l5Avg = recentGames.slice(0, 5).reduce((s, v) => s + v, 0) / Math.min(5, recentGames.length)
    const l10Avg = recentGames.reduce((s, v) => s + v, 0) / recentGames.length
    const trendPct = l10Avg > 0 ? Math.round(((l5Avg - l10Avg) / l10Avg) * 100) : 0
    const trend: "up" | "down" | "neutral" =
      trendPct > 5 ? "up" : trendPct < -5 ? "down" : "neutral"

    // Build last games array (full season for vs-opponent lookups)
    const lastGames = games.map((g) => ({
      value: g.stat_value,
      overLine: g.stat_value >= propLine,
      date: g.game_date,
      opponent: g.opponent,
    }))

    const enhancedProp: EnhancedPropCardData = {
      // Base PropCardData fields
      id: propSlug,
      player: playerName,
      team,
      statCategory: stat,
      propLine,
      l5Avg: Math.round(l5Avg * 10) / 10,
      l10Avg: Math.round(l10Avg * 10) / 10,
      lastGames,
      hitRate: {
        over: l10Window?.available ? l10Window.over : 0,
        total: l10Window?.available ? l10Window.total : 0,
        label: l10Window?.available ? `${l10Window.over}/${l10Window.total}` : "N/A",
      },
      trend,
      trendPct: Math.abs(trendPct),
      matchup: upcomingOpponent,
      sport: "NBA",

      // Enhanced fields
      hitRateWindows,
      matchupGrade,
      confidence,
      correlations,
      lineMovement,
      sentiment: null, // Loaded separately per-request
      direction: (filters?.direction === "all" ? "over" : filters?.direction) ?? "over",
      venue,
      upcomingOpponent,
      withoutPlayerApplied: false,
    }

    results.push(enhancedProp)
  }

  // Sort by L10 hit rate descending
  results.sort((a, b) => {
    const aRate = a.hitRateWindows.find((w) => w.window === "L10")
    const bRate = b.hitRateWindows.find((w) => w.window === "L10")
    const aHit = aRate?.available ? aRate.hitRate : 0
    const bHit = bRate?.available ? bRate.hitRate : 0
    return bHit - aHit
  })

  return results
}

// ─── Tennis Enhanced Props ───────────────────────────────────────────────────

async function computeTennisEnhancedProps(
  stat: string,
  filters?: Partial<AdvancedFilterState>
): Promise<EnhancedPropCardData[]> {
  const playerData = await fetchTennisPlayerData(stat)

  if (playerData.length === 0) return []

  // For tennis, data is aggregated (not per-match), so we use the stat value
  // as a single data point per surface/year combination.
  // Group by player and use their aggregate stats.
  const playerMap = new Map<string, TennisPlayerRow[]>()
  for (const row of playerData) {
    if (!playerMap.has(row.player_name)) {
      playerMap.set(row.player_name, [])
    }
    playerMap.get(row.player_name)!.push(row)
  }

  // Compute defensive stats for matchup grading (all player stat values)
  const allStatValues = playerData.map((p) => p.stat_value)

  const results: EnhancedPropCardData[] = []

  for (const [playerName, rows] of playerMap) {
    // Use the most recent/relevant row (highest matches played)
    const primaryRow = rows.sort((a, b) => b.matches_played - a.matches_played)[0]

    if (primaryRow.matches_played < MIN_GAMES) continue

    const statValue = primaryRow.stat_value
    // For tennis aggregated stats, the prop line is the stat value itself rounded to 0.5
    const propLine = roundToHalf(statValue)
    if (propLine <= 0) continue

    // Tennis doesn't have per-game data, so hit rates are limited
    // We create a synthetic game values array from the stat value
    // (repeated for matches_played count) for hit rate computation
    const syntheticValues = Array(Math.min(primaryRow.matches_played, 20)).fill(statValue)
    const hitRateWindows = computeHitRates(syntheticValues, propLine)

    // Matchup grade: use opponent's stat value relative to all players
    // For tennis, we don't have a specific upcoming opponent from this data
    const matchupGrade: MatchupGrade | null = null

    // Confidence score
    const l5Window = hitRateWindows.find((w) => w.window === "L5")
    const l10Window = hitRateWindows.find((w) => w.window === "L10")
    const l5HitRate = l5Window?.available ? l5Window.hitRate : 0
    const l10HitRate = l10Window?.available ? l10Window.hitRate : 0

    const confidence = computeConfidenceScore(
      l5HitRate,
      l10HitRate,
      matchupGrade,
      primaryRow.matches_played
    )

    // Correlations
    const propIdentifier = `${playerName}-${stat}`
    const propSlug = `${slugify(playerName)}-${stat}`
    const correlations = await fetchCorrelations("Tennis", propIdentifier)

    // Line movement
    const lineMovement = await fetchLineMovement(playerName, "Tennis", stat)

    const enhancedProp: EnhancedPropCardData = {
      id: propSlug,
      player: playerName,
      team: primaryRow.surface, // Use surface as "team" for tennis
      statCategory: stat,
      propLine,
      l5Avg: statValue,
      l10Avg: statValue,
      lastGames: [],
      hitRate: {
        over: l10Window?.available ? l10Window.over : 0,
        total: l10Window?.available ? l10Window.total : 0,
        label: l10Window?.available ? `${l10Window.over}/${l10Window.total}` : "N/A",
      },
      trend: "neutral",
      trendPct: 0,
      matchup: primaryRow.upcoming_opponent ? `vs ${primaryRow.upcoming_opponent}` : `${primaryRow.surface} Court`,
      sport: "Tennis",

      // Enhanced fields
      hitRateWindows,
      matchupGrade,
      confidence,
      correlations,
      lineMovement,
      sentiment: null,
      direction: (filters?.direction === "all" ? "over" : filters?.direction) ?? "over",
      venue: null,
      upcomingOpponent: primaryRow.upcoming_opponent ?? null,
      withoutPlayerApplied: false,
    }

    results.push(enhancedProp)
  }

  // Sort by L10 hit rate descending
  results.sort((a, b) => {
    const aRate = a.hitRateWindows.find((w) => w.window === "L10")
    const bRate = b.hitRateWindows.find((w) => w.window === "L10")
    const aHit = aRate?.available ? aRate.hitRate : 0
    const bHit = bRate?.available ? bRate.hitRate : 0
    return bHit - aHit
  })

  return results
}
