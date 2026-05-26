import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { playerNameToSlug } from "@/lib/seo/player-slug"
import { computeHitRates } from "@/lib/analytics/hit-rates"
import { computeMatchupGrade, type MatchupGrade } from "@/lib/analytics/matchup-grades"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PublicPlayerData {
  slug: string
  name: string
  team: string
  sport: string
  position?: string
  propLine: number | null
  statCategory: string | null
  hitRate: { l5: number; l10: number; season: number } | null
  matchupGrade: string | null // A-F
  trend: "up" | "down" | "neutral" | null
  trendPct: number | null
  streak: ("over" | "under")[] // last 10 games
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maps stat categories from prop_line_history to nba_player_stats columns */
const STAT_COLUMN_MAP: Record<string, string> = {
  pts: "pts",
  trb: "trb",
  ast: "ast",
  tp: "tp",
  stl: "stl",
  blk: "blk",
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch a single player's public data by slug.
 * Queries prop_line_history for the latest prop line, then nba_player_stats
 * for game-by-game values to compute hit rates, trend, and streak.
 *
 * Returns null if no player matches the slug.
 */
export async function getPublicPlayerBySlug(
  slug: string
): Promise<PublicPlayerData | null> {
  const supabase = createAdminClient()

  // Step 1: Find the player name from prop_line_history by matching slug
  const { data: propPlayers, error: propError } = await supabase
    .from("prop_line_history")
    .select("player_name, sport, stat_category, line_value, recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(5000)

  if (propError || !propPlayers) {
    console.error("[public-players] Failed to fetch prop_line_history:", propError?.message)
    return null
  }

  // Find the player whose name matches the slug
  const matchingRow = propPlayers.find(
    (row: { player_name: string }) => playerNameToSlug(row.player_name) === slug
  )

  if (!matchingRow) {
    return null
  }

  const playerName = matchingRow.player_name
  const sport = matchingRow.sport

  // Step 2: Get the most recent prop line for this player
  const { data: latestProp, error: latestPropError } = await supabase
    .from("prop_line_history")
    .select("stat_category, line_value, recorded_at")
    .eq("player_name", playerName)
    .order("recorded_at", { ascending: false })
    .limit(1)

  if (latestPropError || !latestProp || latestProp.length === 0) {
    // Player exists but no prop data — return minimal data
    return {
      slug,
      name: playerName,
      team: "",
      sport,
      propLine: null,
      statCategory: null,
      hitRate: null,
      matchupGrade: null,
      trend: null,
      trendPct: null,
      streak: [],
    }
  }

  const propLine = Number(latestProp[0].line_value)
  const statCategory = latestProp[0].stat_category
  const statColumn = STAT_COLUMN_MAP[statCategory.toLowerCase()] ?? statCategory.toLowerCase()

  // Step 3: Fetch game stats for this player from nba_player_stats
  const { data: gameStats, error: gameError } = await supabase
    .from("nba_player_stats")
    .select(`player_name, team, opponent, position, ${statColumn}, nba_games!inner(game_date)`)
    .eq("player_name", playerName)
    .order("nba_games(game_date)", { ascending: false })
    .limit(82) // max one season of games

  if (gameError || !gameStats || gameStats.length === 0) {
    // Player has prop line but no game stats — return with prop data but no analytics
    return {
      slug,
      name: playerName,
      team: "",
      sport,
      propLine,
      statCategory,
      hitRate: null,
      matchupGrade: null,
      trend: null,
      trendPct: null,
      streak: [],
    }
  }

  const typedStats = gameStats as any[]
  const team = typedStats[0].team ?? ""
  const position = typedStats[0].position ?? undefined

  // Extract stat values (most recent first)
  const gameValues = typedStats.map((g) => Number(g[statColumn]) || 0)

  // Step 4: Compute hit rates using the existing module
  const hitRateWindows = computeHitRates(gameValues, propLine)
  const l5Window = hitRateWindows.find((w) => w.window === "L5")
  const l10Window = hitRateWindows.find((w) => w.window === "L10")
  const seasonWindow = hitRateWindows.find((w) => w.window === "Season")

  const hitRate =
    l5Window?.available || l10Window?.available || seasonWindow?.available
      ? {
          l5: l5Window?.available ? l5Window.hitRate : 0,
          l10: l10Window?.available ? l10Window.hitRate : 0,
          season: seasonWindow?.available ? seasonWindow.hitRate : 0,
        }
      : null

  // Step 5: Compute trend (L5 avg vs L10 avg)
  const recentGames = gameValues.slice(0, 10)
  const l5Values = gameValues.slice(0, 5)
  const l5Avg = l5Values.length > 0 ? l5Values.reduce((s, v) => s + v, 0) / l5Values.length : 0
  const l10Avg = recentGames.length > 0 ? recentGames.reduce((s, v) => s + v, 0) / recentGames.length : 0
  const trendPct = l10Avg > 0 ? Math.round(((l5Avg - l10Avg) / l10Avg) * 100) : 0
  const trend: "up" | "down" | "neutral" =
    trendPct > 5 ? "up" : trendPct < -5 ? "down" : "neutral"

  // Step 6: Compute streak (last 10 games: over or under the line)
  const streak: ("over" | "under")[] = gameValues
    .slice(0, 10)
    .map((v) => (v >= propLine ? "over" : "under"))

  // Step 7: Compute matchup grade (simplified — based on most recent opponent)
  const mostRecentOpponent = typedStats[0].opponent
  let matchupGrade: MatchupGrade | null = null

  if (mostRecentOpponent) {
    // Fetch defensive stats for all teams for this stat
    const { data: allOpponentStats } = await supabase
      .from("nba_player_stats")
      .select(`opponent, ${statColumn}`)
      .limit(5000)

    if (allOpponentStats && allOpponentStats.length > 0) {
      // Aggregate: sum stat values per opponent (approximation of defensive weakness)
      const teamTotals = new Map<string, { total: number; games: number }>()

      for (const row of allOpponentStats as any[]) {
        const opp = row.opponent as string
        const value = Number(row[statColumn]) || 0
        const existing = teamTotals.get(opp) || { total: 0, games: 0 }
        existing.total += value
        existing.games += 1
        teamTotals.set(opp, existing)
      }

      // Compute average allowed per player per game for each team
      const teamAverages = new Map<string, number>()
      for (const [opp, stats] of teamTotals) {
        teamAverages.set(opp, stats.total / stats.games)
      }

      const opponentAvg = teamAverages.get(mostRecentOpponent)
      const allValues = [...teamAverages.values()]

      if (opponentAvg !== undefined && allValues.length >= 5) {
        const opponentGames = teamTotals.get(mostRecentOpponent)?.games ?? 0
        matchupGrade = computeMatchupGrade(opponentAvg, allValues, opponentGames)
      }
    }
  }

  return {
    slug,
    name: playerName,
    team,
    sport,
    position,
    propLine,
    statCategory,
    hitRate,
    matchupGrade,
    trend,
    trendPct: Math.abs(trendPct),
    streak,
  }
}

/**
 * Fetch all player slugs for sitemap generation.
 * Returns distinct players with their most recent game date.
 */
export async function getAllPlayerSlugs(): Promise<{ slug: string; lastGameDate: string }[]> {
  const supabase = createAdminClient()

  // Get all distinct players from prop_line_history
  const { data: propPlayers, error } = await supabase
    .from("prop_line_history")
    .select("player_name, recorded_at")
    .order("recorded_at", { ascending: false })

  if (error || !propPlayers) {
    console.error("[public-players] Failed to fetch players for sitemap:", error?.message)
    return []
  }

  // Deduplicate by player name, keeping the most recent recorded_at
  const playerMap = new Map<string, string>()

  for (const row of propPlayers) {
    const name = row.player_name as string
    const recordedAt = row.recorded_at as string

    if (!playerMap.has(name)) {
      playerMap.set(name, recordedAt)
    }
  }

  // Try to get actual game dates from nba_player_stats for more accurate lastModified
  const playerNames = [...playerMap.keys()]
  const gameDataMap = new Map<string, string>()

  // Fetch game dates in batches to avoid query limits
  const batchSize = 100
  for (let i = 0; i < playerNames.length; i += batchSize) {
    const batch = playerNames.slice(i, i + batchSize)
    const { data: gameData } = await supabase
      .from("nba_player_stats")
      .select("player_name, nba_games!inner(game_date)")
      .in("player_name", batch)
      .order("nba_games(game_date)", { ascending: false })
      .limit(batch.length) // one row per player is enough (most recent)

    if (gameData) {
      for (const row of gameData as any[]) {
        const name = row.player_name as string
        const gameDate = row.nba_games?.game_date as string
        if (gameDate && !gameDataMap.has(name)) {
          gameDataMap.set(name, gameDate)
        }
      }
    }
  }

  // Build result: use game date if available, fall back to prop recorded_at
  const results: { slug: string; lastGameDate: string }[] = []

  for (const [name, recordedAt] of playerMap) {
    const slug = playerNameToSlug(name)
    const lastGameDate = gameDataMap.get(name) ?? recordedAt.split("T")[0]
    results.push({ slug, lastGameDate })
  }

  return results
}
