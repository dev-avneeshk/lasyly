/**
 * NFL Analytics Engine (mirrors the NBA engine-v2 pattern)
 *
 * Reads the dedicated, clean `nfl_player_stats` + `nfl_games` tables (numeric
 * flat columns) — the same architecture the NBA engine uses with
 * `nba_player_stats` / `nba_games`. This replaces the previous NFL path that
 * read the shared `espn_player_stats` JSONB table (where passing/rushing/
 * receiving "YDS" keys collided).
 *
 * Behavior mirrors NBA:
 *  - Props are gated on the upcoming slate (players whose team plays in the
 *    current game window). NFL is weekly (Thu/Sun/Mon), so the window is the
 *    next 6 days rather than a single calendar day.
 *  - If no games are scheduled in the window, we return fallbackMode=true with
 *    no props (identical to NBA's off-day behavior).
 *  - Per-player: prop line, L5/L10 averages, hit rate, projection, probability,
 *    trend, and graphData for the mini chart.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { PropCardData, GameResult } from "@/lib/props/types"
import {
  getNFLDefenseAllowed,
  NFLDefensePosition,
  NFLDefenseStatKey,
  DefenseAllowedResult,
} from "@/lib/analytics/nfl-defense"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NFLTodayGame {
  homeTeam: string // abbreviation (e.g. "SEA")
  awayTeam: string
  gameDate: string
  status: "scheduled" | "live"
}

export interface NFLDefensiveMatchup {
  opponentTeam: string
  statAllowedPerGame: number
  leagueAverage: number
  grade: "A" | "B" | "C" | "D" | "F"
  /** Rank 1 = softest (allows most) → 32 = toughest. */
  rank: number
  rankOf: number
  /** Pace analog: opponent scoring environment (fast/average/slow). */
  paceRating: "fast" | "average" | "slow"
}

export interface NFLSeriesRecord {
  /** Wins by the player's team in the head-to-head sample. */
  team: number
  /** Wins by the opponent. */
  opponent: number
  type: "season" | "all-time"
}

export interface NFLPropCard extends PropCardData {
  position: string
  probability: number
  direction: "over" | "under"
  league: string
  headshotUrl: string | null
  projectedValue: number | null
  graphData?: { value: number; date: string; opponent: string; overLine: boolean; minutes: number }[]
  defensiveMatchup: NFLDefensiveMatchup | null
  seriesRecord: NFLSeriesRecord | null
}

export interface NFLPropsResult {
  props: NFLPropCard[]
  todayGames: NFLTodayGame[]
  fallbackMode: boolean
  computeTimeMs: number
}

interface NFLGameRow {
  playerName: string
  team: string
  opponent: string | null
  position: string | null
  gameDate: string
  value: number
}

// ─── Configuration ──────────────────────────────────────────────────────────

/** Days ahead to consider "the upcoming slate" — covers a full NFL game week. */
const UPCOMING_WINDOW_DAYS = 6

/** Minimum games of history before a prop is meaningful. */
const MIN_GAMES = 3

/** How far back to pull history for charts/averages (a full-ish season). */
const HISTORY_DAYS = 400

/** Stats that are rare events (low counts — use mean, lower hit-rate bar). */
const RARE_EVENT_STATS = new Set(["TD", "INT", "SACKS"])

/** Hit-rate threshold to surface a prop (NFL has small samples — 50%). */
const HIT_RATE_THRESHOLD = 0.5

// ─── Stat resolution ──────────────────────────────────────────────────────────
//
// UI stat keys map to different underlying columns depending on the player's
// role. "YDS" for a QB means passing yards; for a RB, rushing yards; for a
// WR/TE, receiving yards. We resolve per player using their dominant volume.

const YARD_COLUMNS = ["pass_yds", "rush_yds", "rec_yds"] as const
const TD_COLUMNS = ["pass_td", "rush_td", "rec_td"] as const

/** All numeric columns we need to fetch from nfl_player_stats. */
const SELECT_COLUMNS = [
  "player_name", "team", "opponent", "position", "game_date",
  "pass_yds", "rush_yds", "rec_yds",
  "pass_td", "rush_td", "rec_td",
  "rec", "rush_att", "pass_int", "sacks",
].join(", ")

/**
 * Given a UI stat key and a player's set of game rows, resolve the numeric
 * value for each game. Returns null if this stat doesn't apply to the player.
 */
function resolveStatValues(statKey: string, rows: Record<string, unknown>[]): number[] | null {
  const sum = (col: string) => rows.reduce((s, r) => s + (Number(r[col]) || 0), 0)

  switch (statKey) {
    case "YDS": {
      // Pick the yard type the player accumulates the most of.
      const totals = YARD_COLUMNS.map((c) => ({ col: c, total: sum(c) }))
      const best = totals.sort((a, b) => b.total - a.total)[0]
      if (!best || best.total <= 0) return null
      return rows.map((r) => Number(r[best.col]) || 0)
    }
    case "TD": {
      // Combined touchdowns (pass + rush + rec) — a player's scoring output.
      const total = TD_COLUMNS.reduce((s, c) => s + sum(c), 0)
      if (total <= 0) return null
      return rows.map((r) => TD_COLUMNS.reduce((s, c) => s + (Number(r[c]) || 0), 0))
    }
    case "REC": {
      if (sum("rec") <= 0) return null
      return rows.map((r) => Number(r["rec"]) || 0)
    }
    case "CAR": {
      if (sum("rush_att") <= 0) return null
      return rows.map((r) => Number(r["rush_att"]) || 0)
    }
    case "INT": {
      if (sum("pass_int") <= 0) return null
      return rows.map((r) => Number(r["pass_int"]) || 0)
    }
    case "SACKS": {
      if (sum("sacks") <= 0) return null
      return rows.map((r) => Number(r["sacks"]) || 0)
    }
    default:
      return null
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2
}

function avgSlice(values: number[], n: number): number {
  if (values.length === 0) return 0
  const slice = values.slice(0, Math.min(n, values.length))
  return slice.reduce((s, v) => s + v, 0) / slice.length
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

/**
 * Prop line: median for volume stats, mean for rare events (median would be 0
 * for most players on TD/INT/SACKS). Rounded to the nearest 0.5.
 */
function computePropLine(values: number[], isRareEvent: boolean): number {
  const recent = values.slice(0, 10)
  if (recent.length === 0) return 0

  if (isRareEvent) {
    const mean = recent.reduce((s, v) => s + v, 0) / recent.length
    const line = roundToHalf(mean)
    if (line === 0 && recent.some((v) => v > 0)) return 0.5
    return line
  }

  const sorted = [...recent].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const med = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  return roundToHalf(med)
}

/**
 * NFL projection model — recent form dominates (only 17 games/season).
 *   Projection = L3 × 0.55 + L5 × 0.25 + Season × 0.20
 */
function computeNFLProjection(values: number[]): number {
  const l3 = avgSlice(values, 3)
  const l5 = avgSlice(values, 5)
  const season = avgSlice(values, values.length)

  let projection: number
  if (values.length >= 5) {
    projection = l3 * 0.55 + l5 * 0.25 + season * 0.20
  } else if (values.length >= 3) {
    projection = l3 * 0.65 + season * 0.35
  } else {
    projection = season
  }
  return Math.round(projection * 10) / 10
}

// ─── Defensive Matchup Helpers ──────────────────────────────────────────────

/**
 * Grade a matchup from how much the opponent allows vs the league average.
 * Higher allowed = easier matchup = better grade (same thresholds as NBA).
 * For defense-friendly stats (INT thrown), the scale is inverted.
 */
function gradeFromRatio(ratio: number, offenseFriendly: boolean): "A" | "B" | "C" | "D" | "F" {
  const r = offenseFriendly ? ratio : 1 / (ratio || 1)
  if (r >= 1.15) return "A"
  if (r >= 1.05) return "B"
  if (r >= 0.95) return "C"
  if (r >= 0.85) return "D"
  return "F"
}

/** Normalize a raw ESPN position into a defense bucket. */
function toDefensePosition(position: string | null, dominantYardCol: string): NFLDefensePosition {
  const p = (position ?? "").toUpperCase()
  if (p === "QB") return "QB"
  if (p === "RB" || p === "FB") return "RB"
  if (p === "WR") return "WR"
  if (p === "TE") return "TE"
  // Fallback by what the player accumulates most.
  if (dominantYardCol === "pass_yds") return "QB"
  if (dominantYardCol === "rush_yds") return "RB"
  return "WR"
}

/**
 * Map a UI stat key + the player's dominant yard column to the defense stat key
 * we should grade against.
 */
function statToDefenseKey(
  statKey: string,
  dominantYardCol: string
): NFLDefenseStatKey | null {
  switch (statKey) {
    case "YDS":
      if (dominantYardCol === "pass_yds") return "pass_yds"
      if (dominantYardCol === "rush_yds") return "rush_yds"
      return "rec_yds"
    case "REC":
      return "receptions"
    case "CAR":
      return "carries"
    case "INT":
      return "pass_int"
    case "TD":
      // Grade combined scoring against the position's primary TD lane.
      if (dominantYardCol === "pass_yds") return "pass_td"
      if (dominantYardCol === "rush_yds") return "rush_td"
      return "rec_td"
    default:
      return null
  }
}

/**
 * Fetch head-to-head records for a set of (team, opponent) pairs from
 * nfl_games. Returns a map keyed "TEAM-OPP" → { team, opponent } win counts.
 */
async function fetchSeriesRecords(pairs: [string, string][]): Promise<Map<string, NFLSeriesRecord>> {
  const out = new Map<string, NFLSeriesRecord>()
  if (pairs.length === 0) return out
  const supabase = createAdminClient()

  const teamsInvolved = [...new Set(pairs.flatMap((p) => p))]
  const { data } = await supabase
    .from("nfl_games")
    .select("home_abbr, away_abbr, home_score, away_score, status")
    .in("home_abbr", teamsInvolved)
    .eq("status", "completed")
    .limit(4000)

  const games = (data ?? []) as any[]
  for (const [team, opp] of pairs) {
    const key = `${team}-${opp}`
    if (out.has(key)) continue
    let teamWins = 0
    let oppWins = 0
    for (const g of games) {
      const h = g.home_abbr, a = g.away_abbr
      const isPair = (h === team && a === opp) || (h === opp && a === team)
      if (!isPair) continue
      const hs = g.home_score ?? 0, as_ = g.away_score ?? 0
      if (hs === as_) continue
      const homeWon = hs > as_
      const winner = homeWon ? h : a
      if (winner === team) teamWins++
      else if (winner === opp) oppWins++
    }
    out.set(key, { team: teamWins, opponent: oppWins, type: "all-time" })
  }
  return out
}

/**
 * Opponent scoring environment (pace analog): points the opponent's games
 * average (for + against) relative to the league. fast/average/slow.
 */
async function fetchPaceMap(opps: string[]): Promise<Map<string, "fast" | "average" | "slow">> {
  const out = new Map<string, "fast" | "average" | "slow">()
  if (opps.length === 0) return out
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("nfl_games")
    .select("home_abbr, away_abbr, home_score, away_score, status")
    .eq("status", "completed")
    .limit(4000)
  const games = (data ?? []) as any[]

  // League total-points-per-game baseline.
  let leagueTotal = 0, leagueN = 0
  const teamTotals = new Map<string, { total: number; n: number }>()
  for (const g of games) {
    const hs = g.home_score ?? 0, as_ = g.away_score ?? 0
    const total = hs + as_
    leagueTotal += total; leagueN++
    for (const t of [g.home_abbr, g.away_abbr]) {
      if (!t) continue
      const e = teamTotals.get(t) ?? { total: 0, n: 0 }
      e.total += total; e.n++
      teamTotals.set(t, e)
    }
  }
  const leagueAvg = leagueN > 0 ? leagueTotal / leagueN : 45

  for (const opp of opps) {
    const e = teamTotals.get(opp)
    if (!e || e.n === 0) { out.set(opp, "average"); continue }
    const avg = e.total / e.n
    out.set(opp, avg > leagueAvg + 4 ? "fast" : avg < leagueAvg - 4 ? "slow" : "average")
  }
  return out
}

/**
 * Attach defensiveMatchup + seriesRecord to each prop in `props`, in place.
 * Batches defense lookups by unique (opponent, position) and series by
 * unique (team, opponent). Strips the internal enrichment fields.
 */
async function enrichWithMatchup(props: NFLPropCard[], stat: string): Promise<void> {
  if (props.length === 0) return

  // Gather unique defense lookups and series pairs.
  const defenseKeys = new Map<string, { opp: string; pos: NFLDefensePosition }>()
  const seriesPairs: [string, string][] = []
  const oppsForPace = new Set<string>()

  for (const p of props) {
    const opp = (p as any).__opp as string
    const dom = (p as any).__dominantYardCol as string
    if (!opp) continue
    const pos = toDefensePosition(p.position, dom)
    defenseKeys.set(`${opp}:${pos}`, { opp, pos })
    seriesPairs.push([p.team, opp])
    oppsForPace.add(opp)
  }

  // Batch: defense results, series records, pace.
  const defenseResults = new Map<string, DefenseAllowedResult>()
  await Promise.all(
    [...defenseKeys.entries()].map(async ([k, { opp, pos }]) => {
      try {
        defenseResults.set(k, await getNFLDefenseAllowed(opp, pos))
      } catch { /* skip */ }
    })
  )
  const [seriesMap, paceMap] = await Promise.all([
    fetchSeriesRecords(seriesPairs),
    fetchPaceMap([...oppsForPace]),
  ])

  for (const p of props) {
    const opp = (p as any).__opp as string
    const dom = (p as any).__dominantYardCol as string
    if (opp) {
      const pos = toDefensePosition(p.position, dom)
      const defKey = statToDefenseKey(stat, dom)
      const result = defenseResults.get(`${opp}:${pos}`)
      const cell = defKey ? result?.byStat[defKey] : undefined
      if (cell) {
        const ratio = cell.leagueAvg > 0 ? cell.perGame / cell.leagueAvg : 1
        p.defensiveMatchup = {
          opponentTeam: opp,
          statAllowedPerGame: cell.perGame,
          leagueAverage: cell.leagueAvg,
          grade: gradeFromRatio(ratio, cell.offenseFriendly),
          rank: cell.rank,
          rankOf: cell.rankOf,
          paceRating: paceMap.get(opp) ?? "average",
        }
      }
      p.seriesRecord = seriesMap.get(`${p.team}-${opp}`) ?? null
    }
    // Strip internal fields.
    delete (p as any).__opp
    delete (p as any).__dominantYardCol
  }
}

// ─── Today's Games ────────────────────────────────────────────────────────────

/**
 * Fetch the upcoming NFL slate: games with status scheduled/in_progress whose
 * date falls within [today, today + UPCOMING_WINDOW_DAYS]. Returns team
 * abbreviations, which match nfl_player_stats.team directly.
 */
async function fetchUpcomingGames(today: string): Promise<NFLTodayGame[]> {
  const supabase = createAdminClient()

  const end = new Date(`${today}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + UPCOMING_WINDOW_DAYS)
  const endStr = end.toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("nfl_games")
    .select("home_abbr, away_abbr, game_date, status")
    .gte("game_date", today)
    .lte("game_date", endStr)
    .in("status", ["scheduled", "in_progress"])
    .order("game_date", { ascending: true })
    .limit(40)

  if (error || !data) {
    console.error("[engine-nfl] Failed to fetch upcoming games:", error?.message)
    return []
  }

  return data
    .filter((row: any) => row.home_abbr && row.away_abbr && row.home_abbr !== "TBD")
    .map((row: any) => ({
      homeTeam: row.home_abbr,
      awayTeam: row.away_abbr,
      gameDate: row.game_date,
      status: row.status === "in_progress" ? "live" : "scheduled",
    }))
}

// ─── Player Stats ─────────────────────────────────────────────────────────────

async function fetchPlayerStats(teams: string[]): Promise<Map<string, NFLGameRow[]>> {
  const supabase = createAdminClient()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - HISTORY_DAYS)
  const cutoff = cutoffDate.toISOString().split("T")[0]

  const playerRows = new Map<string, Record<string, unknown>[]>()

  const pageSize = 1000
  const maxRows = 8000
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data, error } = await supabase
      .from("nfl_player_stats")
      .select(SELECT_COLUMNS)
      .in("team", teams)
      .gte("game_date", cutoff)
      .order("game_date", { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error || !data || data.length === 0) {
      if (offset === 0 && error) console.error("[engine-nfl] player stats query failed:", error.message)
      break
    }
    for (const row of data as any[]) {
      const name = row.player_name as string
      if (!name) continue
      if (!playerRows.has(name)) playerRows.set(name, [])
      playerRows.get(name)!.push(row)
    }
    if (data.length < pageSize) break
  }

  // Rebuild into typed rows (raw records are kept for stat resolution).
  const out = new Map<string, NFLGameRow[]>()
  for (const [name, rows] of playerRows) {
    out.set(
      name,
      rows.map((r) => ({
        playerName: name,
        team: (r.team as string) ?? "",
        opponent: (r.opponent as string) ?? null,
        position: (r.position as string) ?? null,
        gameDate: (r.game_date as string) ?? "",
        value: 0, // resolved per-stat later
      }))
    )
    // Attach raw records for resolveStatValues
    ;(out.get(name) as any).__raw = rows
  }
  return out
}

// ─── Main Engine ────────────────────────────────────────────────────────────

export async function computeNFLProps(
  stat: string,
  today: string,
  options?: { direction?: "over" | "under" | "all"; search?: string; limit?: number; matchup?: string }
): Promise<NFLPropsResult> {
  const startTime = Date.now()
  const search = options?.search ?? ""
  const limit = options?.limit ?? 50
  const direction = options?.direction ?? "all"
  const matchupFilter = options?.matchup?.toUpperCase() ?? ""

  // Step 1: upcoming slate
  const todayGames = await fetchUpcomingGames(today)

  // Step 2: teams to query. If a matchup filter is set (e.g. "LAR-SF"), scope
  // to just those two teams; otherwise use the whole upcoming slate.
  let teams: string[]
  if (matchupFilter && /^[A-Z]{2,3}-[A-Z]{2,3}$/.test(matchupFilter)) {
    teams = matchupFilter.split("-")
  } else {
    teams = [...new Set(todayGames.flatMap((g) => [g.homeTeam, g.awayTeam]))]
  }

  // No games in the window → fallback mode (mirror NBA: return empty)
  if (teams.length === 0) {
    return { props: [], todayGames, fallbackMode: true, computeTimeMs: Date.now() - startTime }
  }

  // Step 3: player stats for those teams
  const playerMap = await fetchPlayerStats(teams)
  if (playerMap.size === 0) {
    return { props: [], todayGames, fallbackMode: false, computeTimeMs: Date.now() - startTime }
  }

  // Build a matchup lookup (team abbr → opponent abbr for the upcoming game)
  const matchupMap = new Map<string, string>()
  for (const g of todayGames) {
    matchupMap.set(g.homeTeam, g.awayTeam)
    matchupMap.set(g.awayTeam, g.homeTeam)
  }

  const isRareEvent = RARE_EVENT_STATS.has(stat)
  const props: NFLPropCard[] = []

  for (const [playerName, games] of playerMap) {
    const rawRows = (games as any).__raw as Record<string, unknown>[]
    if (!rawRows || rawRows.length === 0) continue

    // Search filter (early)
    const team = games[0]?.team ?? ""
    if (search.length >= 2) {
      const q = search.toLowerCase()
      if (!playerName.toLowerCase().includes(q) && !team.toLowerCase().includes(q)) continue
    }

    // Resolve this stat's per-game values (most recent first — rows are desc)
    const values = resolveStatValues(stat, rawRows)
    if (!values) continue

    // Trim to games where the player was involved for volume stats is implicit
    // (0s are valid data points for hit-rate); keep all games.
    if (values.length < MIN_GAMES) continue

    const propLine = computePropLine(values, isRareEvent)
    if (propLine <= 0) continue

    const l5Avg = Math.round(avgSlice(values, 5) * 10) / 10
    const l10Avg = Math.round(avgSlice(values, 10) * 10) / 10

    // Hit rate over the last 10 games
    const l10Values = values.slice(0, 10)
    const overCount = l10Values.filter((v) => v >= propLine).length
    const totalGames = l10Values.length
    const overHitRate = totalGames > 0 ? overCount / totalGames : 0
    const underHitRate = totalGames > 0 ? (totalGames - overCount) / totalGames : 0

    // Quality gate — pick the stronger directional lean
    let bestDirection: "over" | "under"
    let hitRateForDirection: number
    if (totalGames >= 6) {
      const threshold = isRareEvent ? 0.5 : HIT_RATE_THRESHOLD
      if (overHitRate >= threshold) {
        bestDirection = "over"
        hitRateForDirection = overHitRate
      } else if (underHitRate >= threshold) {
        bestDirection = "under"
        hitRateForDirection = underHitRate
      } else {
        continue
      }
    } else {
      if (overHitRate > underHitRate) {
        bestDirection = "over"
        hitRateForDirection = overHitRate
      } else if (underHitRate > overHitRate) {
        bestDirection = "under"
        hitRateForDirection = underHitRate
      } else {
        continue
      }
    }

    const projectedValue = computeNFLProjection(values)

    const projectionAgrees =
      (bestDirection === "over" && projectedValue >= propLine) ||
      (bestDirection === "under" && projectedValue <= propLine)
    const probability = projectionAgrees
      ? Math.min(0.99, hitRateForDirection + 0.05)
      : Math.max(0.5, hitRateForDirection - 0.1)

    // Trend
    const trendPct = l10Avg > 0 ? Math.round(((l5Avg - l10Avg) / l10Avg) * 100) : 0
    const trend: "up" | "down" | "neutral" = trendPct > 5 ? "up" : trendPct < -5 ? "down" : "neutral"

    // Build lastGames + graphData (align dates/opponents with values)
    const dates = rawRows.map((r) => (r.game_date as string) ?? "")
    const opponents = rawRows.map((r) => (r.opponent as string) ?? team)

    const lastGames: GameResult[] = values.slice(0, 15).map((v, i) => ({
      value: v,
      overLine: v >= propLine,
      date: dates[i] ?? "",
      opponent: opponents[i] ?? team,
    }))

    const graphData = values
      .slice(0, 15)
      .map((v, i) => ({
        value: v,
        date: dates[i] ?? "",
        opponent: opponents[i] ?? team,
        overLine: v >= propLine,
        minutes: 0,
      }))
      .reverse()

    const upcomingOpp = matchupMap.get(team) ?? ""
    const matchup = upcomingOpp ? `${team}-${upcomingOpp}` : ""

    // Determine the player's dominant yard column (for position + defense-key
    // resolution). Reuse the same logic resolveStatValues uses for "YDS".
    const yardTotals = {
      pass_yds: rawRows.reduce((s, r) => s + (Number(r.pass_yds) || 0), 0),
      rush_yds: rawRows.reduce((s, r) => s + (Number(r.rush_yds) || 0), 0),
      rec_yds: rawRows.reduce((s, r) => s + (Number(r.rec_yds) || 0), 0),
    }
    const dominantYardCol =
      Object.entries(yardTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "rec_yds"

    props.push({
      id: `${slugify(playerName)}-${stat}`,
      player: playerName,
      team,
      statCategory: stat,
      propLine,
      l5Avg,
      l10Avg,
      lastGames,
      hitRate: { over: overCount, total: totalGames, label: `${overCount}/${totalGames}` },
      trend,
      trendPct: Math.abs(trendPct),
      matchup,
      sport: "NFL",
      position: games[0]?.position ?? "",
      probability,
      direction: bestDirection,
      league: "NFL",
      headshotUrl: null,
      projectedValue,
      graphData,
      defensiveMatchup: null,
      seriesRecord: null,
      // internal: used only for post-loop enrichment, stripped from output shape
      ...( { __dominantYardCol: dominantYardCol, __opp: upcomingOpp } as any),
    })
  }

  // Direction filter
  let filtered = props
  if (direction !== "all") {
    const dirFiltered = filtered.filter((p) => p.direction === direction)
    if (dirFiltered.length > 0) filtered = dirFiltered
  }

  // Sort by probability, then hit rate
  filtered.sort((a, b) => {
    if (b.probability !== a.probability) return b.probability - a.probability
    const aHit = a.hitRate.total > 0 ? a.hitRate.over / a.hitRate.total : 0
    const bHit = b.hitRate.total > 0 ? b.hitRate.over / b.hitRate.total : 0
    return bHit - aHit
  })

  const limited = filtered.slice(0, limit)

  // ─── Enrich with defensive matchup + series record (only the returned set) ──
  await enrichWithMatchup(limited, stat)

  // Attach headshots (best-effort, from espn_players)
  if (limited.length > 0) {
    try {
      const supabase = createAdminClient()
      const names = limited.map((p) => p.player)
      const { data: playerRows } = await supabase
        .from("espn_players")
        .select("name, espn_id, headshot_url, sport")
        .in("name", names)
      if (playerRows && playerRows.length > 0) {
        const map = new Map<string, string>()
        for (const row of playerRows as any[]) {
          const url = row.headshot_url
            || `https://a.espncdn.com/i/headshots/nfl/players/full/${row.espn_id}.png`
          map.set(row.name, url)
        }
        for (const p of limited) p.headshotUrl = map.get(p.player) ?? null
      }
    } catch {
      // non-critical
    }
  }

  return {
    props: limited,
    todayGames,
    fallbackMode: false,
    computeTimeMs: Date.now() - startTime,
  }
}
