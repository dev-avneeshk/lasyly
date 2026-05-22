/**
 * Soccer Team Props Engine
 *
 * Generates team-level prop cards for soccer matches:
 * - Team Goals O/U: How many goals a specific team scores
 * - Match Goals O/U: Total goals in a match (both teams combined)
 * - Corners O/U: Total corners for a team
 * - Cards O/U: Total cards (yellow + red) for a team
 *
 * Uses espn_games (scores) and espn_player_stats (aggregated team stats)
 * to compute team-level trends and prop lines.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { PropCardData, GameResult } from "@/lib/props/types"
import { computeHitRates, HitRateWindow } from "@/lib/analytics/hit-rates"

// ─── Types ──────────────────────────────────────────────────────────────────

export type TeamPropStat = "team_totalGoals" | "team_corners" | "team_cards" | "team_matchGoals"

export interface TeamPropCard extends PropCardData {
  direction: "over" | "under"
  league: string
  probability: number
  projectedValue: number | null
  isTeamProp: true
  logoUrl: string | null
  headshotUrl: null
  position: string
  hitRateWindows: HitRateWindow[]
  graphData: { value: number; date: string; opponent: string; overLine: boolean; minutes: number }[]
  upcomingOpponent?: string | null
}

export interface TeamPropsResult {
  props: TeamPropCard[]
  computeTimeMs: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SOCCER_LEAGUES = ["eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "uefa.champions", "usa.1"]

const LEAGUE_DISPLAY: Record<string, string> = {
  "eng.1": "Premier League",
  "esp.1": "La Liga",
  "ger.1": "Bundesliga",
  "ita.1": "Serie A",
  "fra.1": "Ligue 1",
  "uefa.champions": "Champions League",
  "usa.1": "MLS",
}

const MIN_GAMES = 5
const HIT_RATE_THRESHOLD = 0.55

// ─── Helpers ────────────────────────────────────────────────────────────────

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

function avgSlice(values: number[], n: number): number {
  if (values.length === 0) return 0
  const slice = values.slice(0, Math.min(n, values.length))
  return slice.reduce((s, v) => s + v, 0) / slice.length
}

/**
 * Fetches the next upcoming opponent for each team from espn_games.
 * Returns a map of team name → opponent name.
 */
async function fetchUpcomingOpponents(
  supabase: ReturnType<typeof createAdminClient>
): Promise<Map<string, string>> {
  const upcomingMap = new Map<string, string>()

  try {
    const today = new Date().toISOString().split("T")[0]
    const { data: upcomingGames } = await supabase
      .from("espn_games")
      .select("home_team, away_team, match_date")
      .in("league", SOCCER_LEAGUES)
      .eq("status", "scheduled")
      .gte("match_date", today)
      .order("match_date", { ascending: true })
      .limit(500)

    if (upcomingGames) {
      // For each team, store the first (nearest) upcoming opponent
      for (const game of upcomingGames) {
        if (!upcomingMap.has(game.home_team)) {
          upcomingMap.set(game.home_team, game.away_team)
        }
        if (!upcomingMap.has(game.away_team)) {
          upcomingMap.set(game.away_team, game.home_team)
        }
      }
    }
  } catch {
    // Non-critical — props will just show without opponent
  }

  return upcomingMap
}

function computeProjection(values: number[]): number {
  const l3 = avgSlice(values, 3)
  const l5 = avgSlice(values, 5)
  const l10 = avgSlice(values, 10)
  const season = avgSlice(values, values.length)
  const projection = l3 * 0.40 + l5 * 0.30 + l10 * 0.20 + season * 0.10
  return Math.round(projection * 10) / 10
}

function computePropLine(values: number[]): number {
  const recent = values.slice(0, 10)
  if (recent.length === 0) return 0
  // For team stats, use mean rounded to 0.5
  const mean = recent.reduce((s, v) => s + v, 0) / recent.length
  const line = roundToHalf(mean)
  if (line === 0 && recent.some((v) => v > 0)) return 0.5
  return line
}

// ─── Main Engine ────────────────────────────────────────────────────────────

export async function computeTeamProps(
  stat: TeamPropStat,
  options?: { search?: string; limit?: number }
): Promise<TeamPropsResult> {
  const search = options?.search ?? ""
  const limit = options?.limit ?? 50
  const cacheKey = `team-props:${stat}:${search.slice(0, 20)}`

  return cached(cacheKey, () => computeTeamPropsUncached(stat, search, limit), 60_000)
}

async function computeTeamPropsUncached(
  stat: TeamPropStat,
  search: string,
  limit: number
): Promise<TeamPropsResult> {
  const startTime = Date.now()
  const supabase = createAdminClient()

  // Fetch upcoming opponents for all teams (shared across all stat types)
  const upcomingOpponents = await fetchUpcomingOpponents(supabase)

  if (stat === "team_totalGoals" || stat === "team_matchGoals") {
    return computeGoalProps(supabase, stat, search, limit, startTime, upcomingOpponents)
  }

  if (stat === "team_cards") {
    return computeCardProps(supabase, search, limit, startTime, upcomingOpponents)
  }

  if (stat === "team_corners") {
    return computeCornerProps(supabase, search, limit, startTime, upcomingOpponents)
  }

  return { props: [], computeTimeMs: Date.now() - startTime }
}

// ─── Goal Props (Team Goals & Match Goals) ──────────────────────────────────

async function computeGoalProps(
  supabase: ReturnType<typeof createAdminClient>,
  stat: TeamPropStat,
  search: string,
  limit: number,
  startTime: number,
  upcomingOpponents: Map<string, string>
): Promise<TeamPropsResult> {
  // Fetch completed soccer games with scores
  let data: any[] = []
  const pageSize = 1000

  for (let offset = 0; offset < 3000; offset += pageSize) {
    const { data: batch, error } = await supabase
      .from("espn_games")
      .select("id, home_team, away_team, home_score, away_score, league, match_date, home_team_id, away_team_id, home_logo, away_logo")
      .in("league", SOCCER_LEAGUES)
      .eq("status", "completed")
      .not("home_score", "is", null)
      .not("away_score", "is", null)
      .order("match_date", { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error || !batch || batch.length === 0) break
    data = data.concat(batch)
    if (batch.length < pageSize) break
  }

  if (data.length === 0) {
    return { props: [], computeTimeMs: Date.now() - startTime }
  }

  // Build a team → logo map from the games data
  const teamLogoMap = new Map<string, string>()
  for (const game of data) {
    if (game.home_logo && game.home_team) teamLogoMap.set(game.home_team, game.home_logo)
    if (game.away_logo && game.away_team) teamLogoMap.set(game.away_team, game.away_logo)
  }

  // Also fetch logos from espn_teams table for better coverage
  const allTeamNames = new Set<string>()
  for (const game of data) {
    allTeamNames.add(game.home_team)
    allTeamNames.add(game.away_team)
  }
  try {
    const { data: teamRows } = await supabase
      .from("espn_teams")
      .select("name, logo_url")
      .in("league", SOCCER_LEAGUES)

    if (teamRows) {
      for (const row of teamRows as any[]) {
        if (row.logo_url && row.name) {
          teamLogoMap.set(row.name, row.logo_url)
        }
      }
    }
  } catch {
    // Non-critical
  }

  const props: TeamPropCard[] = []

  if (stat === "team_matchGoals") {
    // Match Goals O/U: group by matchup pair, compute total goals per match
    // Group by team to show "Team X matches tend to have O/U Y goals"
    const teamMatchGoals = new Map<string, {
      league: string
      logoUrl: string | null
      games: { value: number; date: string; opponent: string }[]
    }>()

    for (const game of data) {
      const totalGoals = (game.home_score as number) + (game.away_score as number)

      // Add for home team
      if (!teamMatchGoals.has(game.home_team)) {
        teamMatchGoals.set(game.home_team, { league: game.league, logoUrl: teamLogoMap.get(game.home_team) ?? null, games: [] })
      }
      teamMatchGoals.get(game.home_team)!.games.push({
        value: totalGoals,
        date: game.match_date,
        opponent: game.away_team,
      })

      // Add for away team
      if (!teamMatchGoals.has(game.away_team)) {
        teamMatchGoals.set(game.away_team, { league: game.league, logoUrl: teamLogoMap.get(game.away_team) ?? null, games: [] })
      }
      teamMatchGoals.get(game.away_team)!.games.push({
        value: totalGoals,
        date: game.match_date,
        opponent: game.home_team,
      })
    }

    for (const [team, teamData] of teamMatchGoals) {
      const results = buildTeamProp(team, teamData, stat, search, upcomingOpponents)
      for (const result of results) props.push(result)
    }
  } else {
    // Team Goals O/U: how many goals a specific team scores
    const teamGoals = new Map<string, {
      league: string
      logoUrl: string | null
      games: { value: number; date: string; opponent: string }[]
    }>()

    for (const game of data) {
      // Home team goals
      if (!teamGoals.has(game.home_team)) {
        teamGoals.set(game.home_team, { league: game.league, logoUrl: teamLogoMap.get(game.home_team) ?? null, games: [] })
      }
      teamGoals.get(game.home_team)!.games.push({
        value: game.home_score as number,
        date: game.match_date,
        opponent: game.away_team,
      })

      // Away team goals
      if (!teamGoals.has(game.away_team)) {
        teamGoals.set(game.away_team, { league: game.league, logoUrl: teamLogoMap.get(game.away_team) ?? null, games: [] })
      }
      teamGoals.get(game.away_team)!.games.push({
        value: game.away_score as number,
        date: game.match_date,
        opponent: game.home_team,
      })
    }

    for (const [team, teamData] of teamGoals) {
      const results = buildTeamProp(team, teamData, stat, search, upcomingOpponents)
      for (const result of results) props.push(result)
    }
  }

  // Sort by probability
  props.sort((a, b) => b.probability - a.probability)

  return { props: props.slice(0, limit), computeTimeMs: Date.now() - startTime }
}

// ─── Card Props (Yellow + Red cards per team per match) ─────────────────────

async function computeCardProps(
  supabase: ReturnType<typeof createAdminClient>,
  search: string,
  limit: number,
  startTime: number,
  upcomingOpponents: Map<string, string>
): Promise<TeamPropsResult> {
  // Aggregate cards from espn_player_stats per team per game
  let data: any[] = []
  const pageSize = 1000

  for (let offset = 0; offset < 5000; offset += pageSize) {
    const { data: batch, error } = await supabase
      .from("espn_player_stats")
      .select("game_id, team, league, match_date, stats")
      .in("league", SOCCER_LEAGUES)
      .order("match_date", { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error || !batch || batch.length === 0) break
    data = data.concat(batch)
    if (batch.length < pageSize) break
  }

  if (data.length === 0) {
    return { props: [], computeTimeMs: Date.now() - startTime }
  }

  // Fetch team logos
  const teamLogoMap = new Map<string, string>()
  try {
    const { data: teamRows } = await supabase
      .from("espn_teams")
      .select("name, logo_url")
      .in("league", SOCCER_LEAGUES)

    if (teamRows) {
      for (const row of teamRows as any[]) {
        if (row.logo_url && row.name) teamLogoMap.set(row.name, row.logo_url)
      }
    }
  } catch { /* non-critical */ }

  // Group by team + game_id, sum cards
  const teamGameCards = new Map<string, Map<string, { cards: number; date: string }>>()

  for (const row of data) {
    const statsJson = typeof row.stats === "string" ? JSON.parse(row.stats) : row.stats
    const yellows = Number(statsJson?.yellowCards ?? 0) || 0
    const reds = Number(statsJson?.redCards ?? 0) || 0
    const totalCards = yellows + reds

    const team = row.team as string
    const gameId = row.game_id as string

    if (!teamGameCards.has(team)) {
      teamGameCards.set(team, new Map())
    }
    const gameMap = teamGameCards.get(team)!
    if (!gameMap.has(gameId)) {
      gameMap.set(gameId, { cards: 0, date: row.match_date })
    }
    gameMap.get(gameId)!.cards += totalCards
  }

  // Build props from aggregated data
  const props: TeamPropCard[] = []

  for (const [team, gameMap] of teamGameCards) {
    const games = Array.from(gameMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((g) => ({ value: g.cards, date: g.date, opponent: "" }))

    // Find league for this team
    const teamRow = data.find((r: any) => r.team === team)
    const league = teamRow?.league ?? ""

    const result = buildTeamProp(team, { league, logoUrl: teamLogoMap.get(team) ?? null, games }, "team_cards", search, upcomingOpponents)
    for (const r of result) props.push(r)
  }

  props.sort((a, b) => b.probability - a.probability)
  return { props: props.slice(0, limit), computeTimeMs: Date.now() - startTime }
}

// ─── Corner Props ───────────────────────────────────────────────────────────

async function computeCornerProps(
  supabase: ReturnType<typeof createAdminClient>,
  search: string,
  limit: number,
  startTime: number,
  upcomingOpponents: Map<string, string>
): Promise<TeamPropsResult> {
  // Corners are stored in espn_player_stats JSONB as "cornerKicks" (team-level stat)
  let data: any[] = []
  const pageSize = 1000

  for (let offset = 0; offset < 5000; offset += pageSize) {
    const { data: batch, error } = await supabase
      .from("espn_player_stats")
      .select("game_id, team, league, match_date, stats")
      .in("league", SOCCER_LEAGUES)
      .order("match_date", { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error || !batch || batch.length === 0) break
    data = data.concat(batch)
    if (batch.length < pageSize) break
  }

  if (data.length === 0) {
    return { props: [], computeTimeMs: Date.now() - startTime }
  }

  // Fetch team logos
  const teamLogoMap = new Map<string, string>()
  try {
    const { data: teamRows } = await supabase
      .from("espn_teams")
      .select("name, logo_url")
      .in("league", SOCCER_LEAGUES)

    if (teamRows) {
      for (const row of teamRows as any[]) {
        if (row.logo_url && row.name) teamLogoMap.set(row.name, row.logo_url)
      }
    }
  } catch { /* non-critical */ }

  // Try to extract corner data from stats JSONB
  // ESPN stores corners as "cornerKicks" in team-level stats
  const teamGameCorners = new Map<string, Map<string, { corners: number; date: string }>>()

  for (const row of data) {
    const statsJson = typeof row.stats === "string" ? JSON.parse(row.stats) : row.stats
    const corners = Number(statsJson?.cornerKicks ?? statsJson?.corners ?? 0) || 0
    if (corners === 0) continue // Skip if no corner data

    const team = row.team as string
    const gameId = row.game_id as string

    if (!teamGameCorners.has(team)) {
      teamGameCorners.set(team, new Map())
    }
    const gameMap = teamGameCorners.get(team)!
    if (!gameMap.has(gameId)) {
      gameMap.set(gameId, { corners: 0, date: row.match_date })
    }
    gameMap.get(gameId)!.corners += corners
  }

  const props: TeamPropCard[] = []

  for (const [team, gameMap] of teamGameCorners) {
    const games = Array.from(gameMap.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((g) => ({ value: g.corners, date: g.date, opponent: "" }))

    const teamRow = data.find((r: any) => r.team === team)
    const league = teamRow?.league ?? ""

    const result = buildTeamProp(team, { league, logoUrl: teamLogoMap.get(team) ?? null, games }, "team_corners", search, upcomingOpponents)
    for (const r of result) props.push(r)
  }

  props.sort((a, b) => b.probability - a.probability)
  return { props: props.slice(0, limit), computeTimeMs: Date.now() - startTime }
}

// ─── Shared Prop Builder ────────────────────────────────────────────────────

function buildTeamProp(
  team: string,
  teamData: { league: string; logoUrl: string | null; games: { value: number; date: string; opponent: string }[] },
  stat: TeamPropStat,
  search: string,
  upcomingOpponents: Map<string, string>
): TeamPropCard[] {
  const { league, logoUrl, games } = teamData

  if (games.length < MIN_GAMES) return []

  // Recency check — team must have played within last 30 days
  const mostRecentDate = new Date(games[0].date)
  const daysSinceLastGame = (Date.now() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceLastGame > 30) return []

  // Search filter
  if (search.length >= 2) {
    const q = search.toLowerCase()
    if (!team.toLowerCase().includes(q)) return []
  }

  const values = games.map((g) => g.value)

  // Compute prop line
  const propLine = computePropLine(values)
  if (propLine <= 0) return []

  // Compute averages
  const l5Avg = Math.round(avgSlice(values, 5) * 10) / 10
  const l10Avg = Math.round(avgSlice(values, 10) * 10) / 10

  // Hit rate (L10)
  const l10Values = values.slice(0, 10)
  const overCount = l10Values.filter((v) => v > propLine).length
  const underCount = l10Values.length - overCount
  const totalGames = l10Values.length
  const overHitRate = totalGames > 0 ? overCount / totalGames : 0
  const underHitRate = totalGames > 0 ? underCount / totalGames : 0

  // Projection
  const projectedValue = computeProjection(values)

  // Trend
  const trendPct = l10Avg > 0 ? Math.round(((l5Avg - l10Avg) / l10Avg) * 100) : 0
  const trend: "up" | "down" | "neutral" =
    trendPct > 5 ? "up" : trendPct < -5 ? "down" : "neutral"

  // Last games
  const lastGames: GameResult[] = games.slice(0, 15).map((g) => ({
    value: g.value,
    overLine: g.value > propLine,
    date: g.date,
    opponent: g.opponent || team,
  }))

  // Compute hit rate windows for chart display
  const hitRateWindows = computeHitRates(values, propLine)

  // Build graph data for MiniGraph (last 6 games, chronological oldest first)
  const graphData = games.slice(0, 6).reverse().map((g) => ({
    value: g.value,
    date: g.date,
    opponent: g.opponent ? g.opponent.slice(0, 3).toUpperCase() : "",
    overLine: g.value > propLine,
    minutes: 90,
  }))

  // Get upcoming opponent
  const nextOpponent = upcomingOpponents.get(team) ?? null

  // Generate props for both directions that meet quality threshold
  const results: TeamPropCard[] = []

  const buildCard = (direction: "over" | "under", hitRate: number, hitCount: number): TeamPropCard | null => {
    // Quality gate: need at least > 45% hit rate to show
    if (hitRate < 0.45) return null

    const projectionAgrees =
      (direction === "over" && projectedValue >= propLine) ||
      (direction === "under" && projectedValue <= propLine)
    const probability = projectionAgrees
      ? Math.min(0.99, hitRate + 0.05)
      : Math.max(0.40, hitRate - 0.10)

    return {
      id: `${slugify(team)}-${stat}-${direction}`,
      player: team,
      team,
      statCategory: stat,
      propLine,
      l5Avg,
      l10Avg,
      lastGames,
      hitRate: {
        over: overCount,
        total: totalGames,
        label: `${hitCount}/${totalGames}`,
      },
      trend,
      trendPct: Math.abs(trendPct),
      matchup: nextOpponent ?? "",
      sport: "Soccer",
      direction,
      league: LEAGUE_DISPLAY[league] ?? league,
      probability,
      projectedValue,
      isTeamProp: true,
      logoUrl,
      headshotUrl: null,
      position: "Team",
      hitRateWindows,
      graphData,
      upcomingOpponent: nextOpponent,
    }
  }

  // Generate the best direction prop (always, if it meets threshold)
  if (overHitRate >= HIT_RATE_THRESHOLD) {
    const card = buildCard("over", overHitRate, overCount)
    if (card) results.push(card)
  } else if (overHitRate > 0.45) {
    const card = buildCard("over", overHitRate, overCount)
    if (card) results.push(card)
  }

  if (underHitRate >= HIT_RATE_THRESHOLD) {
    const card = buildCard("under", underHitRate, underCount)
    if (card) results.push(card)
  } else if (underHitRate > 0.45) {
    const card = buildCard("under", underHitRate, underCount)
    if (card) results.push(card)
  }

  // If neither direction met the threshold, try the best lean > 50%
  if (results.length === 0) {
    if (overHitRate > underHitRate && overHitRate > 0.5) {
      const card = buildCard("over", overHitRate, overCount)
      if (card) results.push(card)
    } else if (underHitRate > overHitRate && underHitRate > 0.5) {
      const card = buildCard("under", underHitRate, underCount)
      if (card) results.push(card)
    }
  }

  return results
}
