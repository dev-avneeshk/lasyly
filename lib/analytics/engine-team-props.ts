/**
 * Soccer Team Props Engine
 *
 * Generates team-level prop cards for soccer matches:
 * - Team Goals O/U: How many goals a specific team scores
 * - Match Goals O/U: Total goals in a match (both teams combined)
 * - Corners, Cards (yellow + red), Shots, Shots on Target, Fouls O/U per team
 *
 * Big-5 leagues read the imported `soccer_matches` / `soccer_match_stats`
 * tables (full-time rows). Leagues without imported rows (uefa.champions,
 * usa.1), and every league when the DB read fails, fall back to ESPN:
 * espn_games (scores) and espn_player_stats (summed per team per game).
 *
 * Every cached() value is plain JSON (arrays/objects): Maps are rebuilt after
 * the read, since cached() round-trips through Redis as JSON.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { cached, CACHE_TTL } from "@/lib/cache"
import { fetchPagedParallel } from "@/lib/supabase/paged"
import { PropCardData, GameResult } from "@/lib/props/types"
import { getTodayET } from "@/lib/props/dates"
import { computeHitRates, HitRateWindow } from "@/lib/analytics/hit-rates"
import { normalizeTeamName } from "@/lib/scores/alignTeams"
import { BIG5_LEAGUE_CODES, DB_STAT_SOURCES, buildMatchKey } from "@/lib/soccer/big5"

// ─── Types ──────────────────────────────────────────────────────────────────

export const TEAM_PROP_STATS = [
  "team_totalGoals", "team_matchGoals", "team_corners", "team_cards",
  "team_shots", "team_shotsOnTarget", "team_fouls",
] as const

export type TeamPropStat = (typeof TEAM_PROP_STATS)[number]

export function isTeamPropStat(s: string): s is TeamPropStat {
  return (TEAM_PROP_STATS as readonly string[]).includes(s)
}

type TeamGame = { value: number; date: string; opponent: string; matchKey?: string }

type TeamHistory = { league: string; logoUrl: string | null; games: TeamGame[] }

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

/** One imported match, reduced to the two side values for one stat. */
type DbMatchValue = {
  league: string
  season: string
  matchNo: number
  date: string
  home: string
  away: string
  homeValue: number | null
  awayValue: number | null
}

const ESPN_SUM_KEYS = [
  "yellowCards", "redCards", "cornerKicks", "corners", "totalShots", "shotsOnTarget", "foulsCommitted",
] as const

type EspnSumKey = (typeof ESPN_SUM_KEYS)[number]

/** One team's ESPN player-stat sums for one game. */
type EspnTeamGame = {
  team: string
  league: string
  gameId: string
  date: string
  opponent: string
  sums: Record<EspnSumKey, number>
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>

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

/** Row caps for the paged reads (cost guards). */
const DB_MAX_ROWS = 10_000
const ESPN_MAX_ROWS = 20_000

/** ESPN espn_player_stats keys summed for each aggregate stat. */
const ESPN_STAT_KEYS: Record<Exclude<TeamPropStat, "team_totalGoals" | "team_matchGoals">, readonly EspnSumKey[]> = {
  team_corners: ["cornerKicks", "corners"],
  team_cards: ["yellowCards", "redCards"],
  team_shots: ["totalShots"],
  team_shotsOnTarget: ["shotsOnTarget"],
  team_fouls: ["foulsCommitted"],
}

const BIG5_SET = new Set<string>(BIG5_LEAGUE_CODES)

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

function errorMessage(err: unknown): string {
  return (err as { message?: string } | null)?.message ?? String(err)
}

/** Finite number from a PostgREST value (numeric may arrive as a string), else null. */
function toFinite(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Fetches the next upcoming opponent for each team from espn_games.
 * Returns a map of team name → opponent name.
 */
async function fetchUpcomingOpponents(supabase: SupabaseAdmin): Promise<Map<string, string>> {
  const upcomingMap = new Map<string, string>()

  try {
    // Use US Eastern Time for date comparison (matches are typically scheduled in local/ET time)
    const today = getTodayET()
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

/** `[name, logo_url]` pairs from espn_teams; [] on error (non-critical). */
async function fetchLogoEntries(supabase: SupabaseAdmin): Promise<Array<[string, string]>> {
  try {
    const { data, error } = await supabase
      .from("espn_teams")
      .select("name, logo_url")
      .in("league", SOCCER_LEAGUES)
      .not("logo_url", "is", null)
    if (error || !data) return []
    const out: Array<[string, string]> = []
    for (const row of data as Array<{ name: string | null; logo_url: string | null }>) {
      if (row.name && row.logo_url) out.push([row.name, row.logo_url])
    }
    return out
  } catch {
    return []
  }
}

/**
 * One entry per imported Big-5 match for `stat`. Goals come from
 * soccer_matches; the other stats from FT soccer_match_stats rows. Throws on
 * any read error (so a failure is never cached and the caller falls back).
 */
async function readDbMatchValues(supabase: SupabaseAdmin, stat: TeamPropStat): Promise<DbMatchValue[]> {
  const leagues = [...BIG5_LEAGUE_CODES]

  if (stat === "team_totalGoals" || stat === "team_matchGoals") {
    type MatchRow = {
      id: string; league: string; season: string; match_no: number; match_date: string
      home_team: string; away_team: string; home_score: unknown; away_score: unknown
    }
    const rows = await fetchPagedParallel<MatchRow>(
      async () =>
        (await supabase
          .from("soccer_matches")
          .select("id", { count: "exact", head: true })
          .in("league", leagues)).count,
      async (from, to) => {
        const { data, error } = await supabase
          .from("soccer_matches")
          .select("id, league, season, match_no, match_date, home_team, away_team, home_score, away_score")
          .in("league", leagues)
          .order("match_date", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to)
        if (error) throw error
        return (data ?? []) as MatchRow[]
      },
      { maxRows: DB_MAX_ROWS }
    )

    const out: DbMatchValue[] = []
    for (const r of rows) {
      const hs = toFinite(r.home_score)
      const as = toFinite(r.away_score)
      let homeValue: number | null
      let awayValue: number | null
      if (stat === "team_totalGoals") {
        homeValue = hs
        awayValue = as
      } else {
        const total = hs !== null && as !== null ? hs + as : null
        homeValue = total
        awayValue = total
      }
      if (homeValue === null && awayValue === null) continue
      out.push({
        league: r.league, season: r.season, matchNo: Number(r.match_no), date: r.match_date,
        home: r.home_team, away: r.away_team, homeValue, awayValue,
      })
    }
    return out
  }

  const src = DB_STAT_SOURCES[stat]
  const names = [...src.names] as string[]
  type StatRow = {
    id: number; league: string; season: string; match_no: number; match_date: string
    home_team: string; away_team: string; stat_name: string; home_value: unknown; away_value: unknown
  }
  const rows = await fetchPagedParallel<StatRow>(
    async () =>
      (await supabase
        .from("soccer_match_stats")
        .select("id", { count: "exact", head: true })
        .eq("period", "FT")
        .eq("stat_group", src.group)
        .in("stat_name", names)
        .in("league", leagues)).count,
    async (from, to) => {
      const { data, error } = await supabase
        .from("soccer_match_stats")
        .select("id, league, season, match_no, match_date, home_team, away_team, stat_name, home_value, away_value")
        .eq("period", "FT")
        .eq("stat_group", src.group)
        .in("stat_name", names)
        .in("league", leagues)
        .order("match_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
      if (error) throw error
      return (data ?? []) as StatRow[]
    },
    { maxRows: DB_MAX_ROWS }
  )

  // Group by match (insertion order keeps match_date desc). Local only.
  const byMatch = new Map<string, { row: StatRow; values: Map<string, { home: number | null; away: number | null }> }>()
  for (const r of rows) {
    const key = buildMatchKey(r.league, r.season, r.match_no)
    let entry = byMatch.get(key)
    if (!entry) {
      entry = { row: r, values: new Map() }
      byMatch.set(key, entry)
    }
    entry.values.set(r.stat_name, { home: toFinite(r.home_value), away: toFinite(r.away_value) })
  }

  const sideSum = (values: Map<string, { home: number | null; away: number | null }>, side: "home" | "away") => {
    let sum = 0
    for (const name of names) {
      const v = values.get(name)?.[side]
      if (v === null || v === undefined) return null
      sum += v
    }
    return sum
  }

  const out: DbMatchValue[] = []
  for (const { row, values } of byMatch.values()) {
    const homeValue = sideSum(values, "home")
    const awayValue = sideSum(values, "away")
    if (homeValue === null && awayValue === null) continue
    out.push({
      league: row.league, season: row.season, matchNo: Number(row.match_no), date: row.match_date,
      home: row.home_team, away: row.away_team, homeValue, awayValue,
    })
  }
  return out
}

/**
 * ESPN player-stat sums per (team, game) for `leagues`, with the opponent from
 * completed espn_games ("" when the game is missing). Throws on page errors.
 */
async function fetchEspnTeamGames(supabase: SupabaseAdmin, leagues: string[]): Promise<EspnTeamGame[]> {
  type PlayerRow = { game_id: string; team: string; league: string; match_date: string; stats: unknown }
  type GameRow = { id: string; home_team: string | null; away_team: string | null }

  const [playerRows, gameRows] = await Promise.all([
    fetchPagedParallel<PlayerRow>(
      async () =>
        (await supabase
          .from("espn_player_stats")
          .select("id", { count: "exact", head: true })
          .in("league", leagues)).count,
      async (from, to) => {
        const { data, error } = await supabase
          .from("espn_player_stats")
          .select("game_id, team, league, match_date, stats")
          .in("league", leagues)
          .order("match_date", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to)
        if (error) throw error
        return (data ?? []) as PlayerRow[]
      },
      { maxRows: ESPN_MAX_ROWS }
    ),
    fetchPagedParallel<GameRow>(
      async () =>
        (await supabase
          .from("espn_games")
          .select("id", { count: "exact", head: true })
          .in("league", leagues)
          .eq("status", "completed")).count,
      async (from, to) => {
        const { data, error } = await supabase
          .from("espn_games")
          .select("id, home_team, away_team")
          .in("league", leagues)
          .eq("status", "completed")
          .order("id", { ascending: true })
          .range(from, to)
        if (error) throw error
        return (data ?? []) as GameRow[]
      },
      { maxRows: ESPN_MAX_ROWS }
    ),
  ])

  const games = new Map<string, GameRow>()
  for (const g of gameRows) games.set(g.id, g)

  const byTeamGame = new Map<string, EspnTeamGame>()
  for (const row of playerRows) {
    const statsJson = (typeof row.stats === "string" ? JSON.parse(row.stats) : row.stats) as Record<string, unknown> | null
    const key = `${row.team}\u0001${row.game_id}`
    let entry = byTeamGame.get(key)
    if (!entry) {
      const game = games.get(row.game_id)
      const opponent = game ? (row.team === game.home_team ? game.away_team : game.home_team) ?? "" : ""
      entry = {
        team: row.team, league: row.league, gameId: row.game_id, date: row.match_date, opponent,
        sums: { yellowCards: 0, redCards: 0, cornerKicks: 0, corners: 0, totalShots: 0, shotsOnTarget: 0, foulsCommitted: 0 },
      }
      byTeamGame.set(key, entry)
    }
    for (const k of ESPN_SUM_KEYS) {
      entry.sums[k] += Number(statsJson?.[k] ?? 0) || 0
    }
  }

  return [...byTeamGame.values()]
}

/** Completed espn_games with scores for `leagues` (today's paging; stops on error). */
async function fetchEspnGoalGames(supabase: SupabaseAdmin, leagues: string[]) {
  type GoalGame = {
    id: string; home_team: string; away_team: string; home_score: number; away_score: number
    league: string; match_date: string; home_logo: string | null; away_logo: string | null
  }
  let data: GoalGame[] = []
  const pageSize = 1000

  for (let offset = 0; offset < 3000; offset += pageSize) {
    const { data: batch, error } = await supabase
      .from("espn_games")
      .select("id, home_team, away_team, home_score, away_score, league, match_date, home_team_id, away_team_id, home_logo, away_logo")
      .in("league", leagues)
      .eq("status", "completed")
      .not("home_score", "is", null)
      .not("away_score", "is", null)
      .order("match_date", { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error || !batch || batch.length === 0) break
    data = data.concat(batch as GoalGame[])
    if (batch.length < pageSize) break
  }

  return data
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
  const cacheKey = `team-props:v2:${stat}:${limit}:${search}`

  return cached(cacheKey, () => computeTeamPropsUncached(stat, search, limit), CACHE_TTL.props)
}

async function computeTeamPropsUncached(
  stat: TeamPropStat,
  search: string,
  limit: number
): Promise<TeamPropsResult> {
  const startTime = Date.now()
  const supabase = createAdminClient()
  const todayET = getTodayET()

  // 1. Upcoming opponents (shared across the stat=all fan-out).
  const upcomingEntries = await cached(
    `soccer-upcoming:v1:${todayET}`,
    async () => [...(await fetchUpcomingOpponents(supabase)).entries()] as Array<[string, string]>,
    CACHE_TTL.props
  )
  const upcomingOpponents = new Map(upcomingEntries)

  // 2. Logos.
  const logoEntries = await cached("soccer-team-logos:v1", () => fetchLogoEntries(supabase), CACHE_TTL.props)
  const teamLogoMap = new Map<string, string>(logoEntries)

  // 3. Imported Big-5 histories.
  let dbMatches: DbMatchValue[] = []
  try {
    dbMatches = await cached(`soccer-db-history:v1:${stat}`, () => readDbMatchValues(supabase, stat), CACHE_TTL.props)
  } catch (err) {
    // 4. Fallback: every league goes through ESPN.
    console.warn(`[team-props] soccer DB read failed for ${stat}; using ESPN:`, errorMessage(err))
    dbMatches = []
  }

  const histories = new Map<string, TeamHistory>()
  const dbLeagues = new Set<string>()
  const addDbGame = (team: string, league: string, game: TeamGame) => {
    let h = histories.get(team)
    if (!h) {
      h = { league, logoUrl: teamLogoMap.get(team) ?? null, games: [] }
      histories.set(team, h)
    }
    h.games.push(game)
  }
  for (const m of dbMatches) {
    dbLeagues.add(m.league)
    const matchKey = buildMatchKey(m.league, m.season, m.matchNo)
    if (m.homeValue !== null) addDbGame(m.home, m.league, { value: m.homeValue, date: m.date, opponent: m.away, matchKey })
    if (m.awayValue !== null) addDbGame(m.away, m.league, { value: m.awayValue, date: m.date, opponent: m.home, matchKey })
  }
  const dbTeams = new Set(histories.keys())

  // 5. ESPN histories for leagues without imported rows.
  const espnLeagues = SOCCER_LEAGUES.filter((l) => !dbLeagues.has(l))
  if (espnLeagues.length > 0) {
    // Per-team ESPN games, with each game's league (for the team-league rule).
    const espnGames = new Map<string, Array<TeamGame & { league: string }>>()
    const fallbackLogos = new Map<string, string>()
    const addEspnGame = (team: string, game: TeamGame & { league: string }) => {
      if (!team || dbTeams.has(team)) return // A2: DB teams use DB history only
      let list = espnGames.get(team)
      if (!list) {
        list = []
        espnGames.set(team, list)
      }
      list.push(game)
    }

    if (stat === "team_totalGoals" || stat === "team_matchGoals") {
      const games = await fetchEspnGoalGames(supabase, espnLeagues)
      for (const g of games) {
        if (g.home_logo && g.home_team) fallbackLogos.set(g.home_team, g.home_logo)
        if (g.away_logo && g.away_team) fallbackLogos.set(g.away_team, g.away_logo)
        const total = g.home_score + g.away_score
        const homeValue = stat === "team_matchGoals" ? total : g.home_score
        const awayValue = stat === "team_matchGoals" ? total : g.away_score
        addEspnGame(g.home_team, { value: homeValue, date: g.match_date, opponent: g.away_team, league: g.league })
        addEspnGame(g.away_team, { value: awayValue, date: g.match_date, opponent: g.home_team, league: g.league })
      }
    } else {
      let teamGames: EspnTeamGame[] = []
      try {
        teamGames = await cached(
          `soccer-espn-team-games:v1:${[...espnLeagues].sort().join(",")}`,
          () => fetchEspnTeamGames(supabase, espnLeagues),
          CACHE_TTL.props
        )
      } catch (err) {
        console.warn("[team-props] ESPN aggregate read failed:", errorMessage(err))
        teamGames = []
      }
      const keys = ESPN_STAT_KEYS[stat]
      for (const tg of teamGames) {
        const value =
          stat === "team_corners"
            ? tg.sums.cornerKicks || tg.sums.corners
            : keys.reduce((s, k) => s + tg.sums[k], 0)
        if (stat === "team_corners" && value === 0) continue // no corner data for this game
        addEspnGame(tg.team, { value, date: tg.date, opponent: tg.opponent, league: tg.league })
      }
    }

    for (const [team, games] of espnGames) {
      games.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      const covered = games.find((g) => BIG5_SET.has(g.league))
      const league = covered?.league ?? games[0]?.league ?? ""
      histories.set(team, {
        league,
        logoUrl: teamLogoMap.get(team) ?? fallbackLogos.get(team) ?? null,
        games: games.map(({ value, date, opponent }) => ({ value, date, opponent })),
      })
    }
  }

  // 6. Build props.
  const props: TeamPropCard[] = []
  for (const [team, teamData] of histories) {
    for (const card of buildTeamProp(team, teamData, stat, search, upcomingOpponents)) props.push(card)
  }

  // 7. Sort by probability.
  props.sort((a, b) => b.probability - a.probability)

  return { props: props.slice(0, limit), computeTimeMs: Date.now() - startTime }
}

// ─── Shared Prop Builder ────────────────────────────────────────────────────

function buildTeamProp(
  team: string,
  teamData: TeamHistory,
  stat: TeamPropStat,
  search: string,
  upcomingOpponents: Map<string, string>
): TeamPropCard[] {
  const { league, logoUrl } = teamData
  const games = [...teamData.games].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (games.length < MIN_GAMES) return []

  // Recency check — team must have played within last 30 days
  const mostRecentDate = new Date(games[0].date)
  const daysSinceLastGame = (Date.now() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceLastGame > 30) return []

  // Search filter: accents and punctuation are ignored on both sides. A search
  // that normalizes to fewer than 2 characters (e.g. "--") matches no team.
  if (search.trim().length >= 2) {
    const q = normalizeTeamName(search)
    if (q.length < 2 || !normalizeTeamName(team).includes(q)) return []
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
    matchKey: g.matchKey,
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
