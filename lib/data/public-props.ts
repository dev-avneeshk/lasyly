import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { playerNameToSlug } from "@/lib/seo/player-slug"

export interface PublicPropEntry {
  playerSlug: string
  playerName: string
  team: string
  sport: string
  game: { homeTeam: string; awayTeam: string; startTime: string }
  statCategory: string
  propLine: number
  l10HitRate: number
  matchupGrade: string // A-F
}

/**
 * Get today's date in US Eastern Time as YYYY-MM-DD.
 */
function getTodayEastern(): string {
  const now = new Date()
  const eastern = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  )
  const year = eastern.getFullYear()
  const month = String(eastern.getMonth() + 1).padStart(2, "0")
  const day = String(eastern.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * NBA stat category to column name mapping.
 */
const NBA_STAT_COLUMNS: Record<string, string> = {
  points: "pts",
  rebounds: "trb",
  assists: "ast",
  "3-pointers": "tp",
  steals: "stl",
  blocks: "blk",
  pts: "pts",
  trb: "trb",
  ast: "ast",
  tp: "tp",
  stl: "stl",
  blk: "blk",
}

/**
 * Fetch all props for today, grouped by sport then game.
 *
 * Returns props ordered: sports alphabetically, games by start time ascending.
 * Uses US Eastern Time boundary for "today".
 *
 * Requirements: 2.1, 2.2, 2.6, 2.8, 2.9, 2.10
 */
export async function getTodaysPublicProps(): Promise<{
  props: PublicPropEntry[]
  totalCount: number
  sports: string[]
}> {
  const supabase = createAdminClient()
  const today = getTodayEastern()

  // Fetch today's NBA games
  const { data: nbaGames } = await supabase
    .from("nba_games")
    .select("home_team, away_team, game_date, status")
    .eq("game_date", today)

  // Fetch today's ESPN games (all other sports)
  const { data: espnGames } = await supabase
    .from("espn_games")
    .select("home_team, away_team, match_date, start_time, sport, league, status")
    .eq("match_date", today)

  // Build team-to-game lookup for NBA
  const nbaTeamToGame = new Map<
    string,
    { homeTeam: string; awayTeam: string; startTime: string }
  >()
  if (nbaGames) {
    for (const game of nbaGames) {
      const gameInfo = {
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        startTime: game.game_date ?? today,
      }
      nbaTeamToGame.set(game.home_team, gameInfo)
      nbaTeamToGame.set(game.away_team, gameInfo)
    }
  }

  // Build team-to-game lookup for ESPN sports
  const espnTeamToGame = new Map<
    string,
    { homeTeam: string; awayTeam: string; startTime: string; sport: string }
  >()
  if (espnGames) {
    for (const game of espnGames) {
      const gameInfo = {
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        startTime: game.start_time ?? game.match_date ?? today,
        sport: game.sport ?? "",
      }
      espnTeamToGame.set(game.home_team, gameInfo)
      espnTeamToGame.set(game.away_team, gameInfo)
    }
  }

  // Fetch recent prop lines (recorded today or most recent for active players)
  // Get the most recent prop line for each player/stat combination
  const startOfDay = `${today}T00:00:00.000Z`
  const { data: propLines } = await supabase
    .from("prop_line_history")
    .select("player_name, sport, stat_category, line_value, recorded_at")
    .gte("recorded_at", startOfDay)
    .order("recorded_at", { ascending: false })

  if (!propLines || propLines.length === 0) {
    return { props: [], totalCount: 0, sports: [] }
  }

  // Deduplicate: keep only the most recent line per player+stat
  const seen = new Set<string>()
  const uniqueProps: typeof propLines = []
  for (const prop of propLines) {
    const key = `${prop.player_name}::${prop.stat_category}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueProps.push(prop)
    }
  }

  // Get player teams from nba_player_stats (for NBA players)
  const nbaPlayerNames = uniqueProps
    .filter((p) => p.sport === "NBA")
    .map((p) => p.player_name)

  const playerTeamMap = new Map<string, string>()

  if (nbaPlayerNames.length > 0) {
    // Fetch team info for NBA players from their most recent game
    const { data: playerTeams } = await supabase
      .from("nba_player_stats")
      .select("player_name, team")
      .in("player_name", nbaPlayerNames.slice(0, 200))
      .limit(1000)

    if (playerTeams) {
      for (const row of playerTeams) {
        // Keep the first (most recent due to ordering) team for each player
        if (!playerTeamMap.has(row.player_name)) {
          playerTeamMap.set(row.player_name, row.team)
        }
      }
    }
  }

  // Compute L10 hit rates for NBA players
  const l10HitRateMap = await computeL10HitRates(supabase, uniqueProps)

  // Build the public prop entries
  const entries: PublicPropEntry[] = []

  for (const prop of uniqueProps) {
    const playerName = prop.player_name
    const sport = prop.sport ?? "NBA"
    const team = playerTeamMap.get(playerName) ?? ""

    // Find the game for this player
    let game: { homeTeam: string; awayTeam: string; startTime: string } | null = null

    if (sport === "NBA") {
      // Look up by team abbreviation in NBA games
      game = nbaTeamToGame.get(team) ?? null
      // Also try full team name lookup
      if (!game) {
        for (const [teamName, gameInfo] of nbaTeamToGame) {
          if (teamName.includes(team) || team.includes(teamName)) {
            game = gameInfo
            break
          }
        }
      }
    } else {
      // For other sports, try ESPN games
      game = espnTeamToGame.get(team) ?? null
    }

    // Skip props without a matching game today
    if (!game) continue

    const key = `${playerName}::${prop.stat_category}`
    const l10HitRate = l10HitRateMap.get(key) ?? 0
    const matchupGrade = computeSimpleMatchupGrade(l10HitRate)

    entries.push({
      playerSlug: playerNameToSlug(playerName),
      playerName,
      team,
      sport,
      game: {
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        startTime: game.startTime,
      },
      statCategory: prop.stat_category,
      propLine: Number(prop.line_value),
      l10HitRate,
      matchupGrade,
    })
  }

  // Sort: sports alphabetically, then games by start time ascending
  entries.sort((a, b) => {
    // First sort by sport alphabetically
    const sportCompare = a.sport.localeCompare(b.sport)
    if (sportCompare !== 0) return sportCompare

    // Then sort by game start time ascending
    const timeA = new Date(a.game.startTime).getTime()
    const timeB = new Date(b.game.startTime).getTime()
    if (timeA !== timeB) return timeA - timeB

    // Within same game, sort by player name for consistency
    return a.playerName.localeCompare(b.playerName)
  })

  // Extract unique sports
  const sports = [...new Set(entries.map((e) => e.sport))].sort()

  return {
    props: entries,
    totalCount: entries.length,
    sports,
  }
}

/**
 * Compute L10 hit rates for a batch of props.
 * For NBA players, queries nba_player_stats to get last 10 game values.
 */
async function computeL10HitRates(
  supabase: ReturnType<typeof createAdminClient>,
  props: { player_name: string; stat_category: string; line_value: number; sport: string }[]
): Promise<Map<string, number>> {
  const hitRateMap = new Map<string, number>()

  // Only compute for NBA players (we have game-level stats)
  const nbaProps = props.filter((p) => p.sport === "NBA")
  if (nbaProps.length === 0) return hitRateMap

  // Group by stat category to batch queries
  const statGroups = new Map<string, typeof nbaProps>()
  for (const prop of nbaProps) {
    const stat = prop.stat_category.toLowerCase()
    if (!statGroups.has(stat)) {
      statGroups.set(stat, [])
    }
    statGroups.get(stat)!.push(prop)
  }

  for (const [stat, groupProps] of statGroups) {
    const column = NBA_STAT_COLUMNS[stat] ?? stat
    const playerNames = groupProps.map((p) => p.player_name)

    // Fetch last 10 games for these players
    const { data: gameStats } = await supabase
      .from("nba_player_stats")
      .select(`player_name, ${column}, nba_games!inner(game_date)`)
      .in("player_name", playerNames.slice(0, 100))
      .order("nba_games(game_date)", { ascending: false })
      .limit(2000)

    if (!gameStats) continue

    // Group by player and compute hit rate
    const playerGames = new Map<string, number[]>()
    for (const row of gameStats as any[]) {
      const name = row.player_name as string
      const value = Number(row[column]) || 0
      if (!playerGames.has(name)) {
        playerGames.set(name, [])
      }
      playerGames.get(name)!.push(value)
    }

    // Compute L10 hit rate for each player in this stat group
    for (const prop of groupProps) {
      const games = playerGames.get(prop.player_name)
      if (!games || games.length < 3) {
        hitRateMap.set(`${prop.player_name}::${prop.stat_category}`, 0)
        continue
      }

      const l10 = games.slice(0, 10)
      const over = l10.filter((v) => v >= Number(prop.line_value)).length
      const hitRate = Math.round((over / l10.length) * 100)
      hitRateMap.set(`${prop.player_name}::${prop.stat_category}`, hitRate)
    }
  }

  return hitRateMap
}

/**
 * Simplified matchup grade based on L10 hit rate.
 * A full matchup grade requires defensive stats which are expensive to compute
 * for a public listing page. This provides a reasonable approximation.
 *
 * A: 80-100% hit rate (favorable matchup implied)
 * B: 60-79%
 * C: 40-59%
 * D: 20-39%
 * F: 0-19%
 */
function computeSimpleMatchupGrade(l10HitRate: number): string {
  if (l10HitRate >= 80) return "A"
  if (l10HitRate >= 60) return "B"
  if (l10HitRate >= 40) return "C"
  if (l10HitRate >= 20) return "D"
  return "F"
}
