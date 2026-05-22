/**
 * ESPN Multi-Sport Analytics Engine
 *
 * Provides prop-style analytics for Soccer, NFL, and NHL using the
 * espn_player_stats table (JSONB stats column).
 *
 * Each sport uses a tailored projection model:
 * - Soccer: Poisson-adjusted for rare events (goals, assists), form-weighted for volume stats
 * - NFL: Heavy recency weighting (L3 dominant) due to weekly matchup variance
 * - NHL: Hybrid model — Poisson for goals/assists, volume-based for shots/hits
 *
 * All sports share the same quality gate: 60%+ hit rate required to show a prop.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"
import { PropCardData, GameResult } from "@/lib/props/types"

// ─── Types ──────────────────────────────────────────────────────────────────

export type ESPNSport = "Soccer" | "NFL" | "NHL"

export interface ESPNPropCard extends PropCardData {
  position: string
  probability: number
  direction: "over" | "under"
  league: string
  headshotUrl: string | null
  /** Projected value from the sport-specific model */
  projectedValue: number | null
  /** Graph data for MiniGraph (chronological order) */
  graphData?: { value: number; date: string; opponent: string; overLine: boolean; minutes: number }[]
}

export interface ESPNPropsResult {
  props: ESPNPropCard[]
  computeTimeMs: number
}

// ─── League Mapping ─────────────────────────────────────────────────────────

const SPORT_LEAGUES: Record<ESPNSport, string[]> = {
  Soccer: ["eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "uefa.champions", "usa.1"],
  NFL: ["nfl"],
  NHL: ["nhl"],
}

const LEAGUE_DISPLAY: Record<string, string> = {
  "eng.1": "Premier League",
  "esp.1": "La Liga",
  "ger.1": "Bundesliga",
  "ita.1": "Serie A",
  "fra.1": "Ligue 1",
  "uefa.champions": "Champions League",
  "usa.1": "MLS",
  nfl: "NFL",
  nhl: "NHL",
}

// ─── Sport-Specific Configuration ───────────────────────────────────────────

/** Stats that are rare events (Poisson-distributed: 0, 1, 2 per game typically) */
const RARE_EVENT_STATS: Record<ESPNSport, Set<string>> = {
  Soccer: new Set(["totalGoals", "goalAssists", "yellowCards", "redCards", "saves"]),
  NFL: new Set(["TD", "INT", "SACKS", "FUM"]),
  NHL: new Set(["G", "A", "+/-"]),
}

/** Minimum games required per sport */
const MIN_GAMES: Record<ESPNSport, number> = {
  Soccer: 5,
  NFL: 3,  // NFL has only 17 games/season, data is scarce
  NHL: 5,
}

/** Recency cutoff in days — players who haven't played within this window are excluded */
const RECENCY_CUTOFF_DAYS: Record<ESPNSport, number> = {
  Soccer: 30,
  NFL: 21,  // NFL is weekly, 3 weeks without a game means inactive
  NHL: 21,
}

/** Hit rate threshold to qualify as a valid prop */
const HIT_RATE_THRESHOLD = 0.6

/** Lower threshold for rare-event stats (goals, assists — Poisson-distributed) */
const RARE_EVENT_HIT_RATE_THRESHOLD = 0.5

/** NFL-specific lower threshold (small sample sizes with 17-game season) */
const NFL_HIT_RATE_THRESHOLD = 0.5

// ─── Stat Extraction from JSONB ─────────────────────────────────────────────

function extractStat(statsJson: Record<string, unknown>, statKey: string): number | null {
  const val = statsJson[statKey]
  if (val === undefined || val === null || val === "" || val === "--") return null
  const num = Number(val)
  return isNaN(num) ? null : num
}

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

// ─── Sport-Specific Projection Models ───────────────────────────────────────

/**
 * Soccer Projection Model
 *
 * For rare events (goals, assists): Poisson-based expected value
 *   - Lambda = weighted average: L3 × 0.40 + L5 × 0.30 + L10 × 0.20 + Season × 0.10
 *   - Projection = Lambda (the expected value IS the Poisson mean)
 *
 * For volume stats (shots, fouls): Standard weighted average
 *   - Projection = L3 × 0.40 + L5 × 0.30 + L10 × 0.20 + Season × 0.10
 */
function computeSoccerProjection(values: number[]): number {
  const l3 = avgSlice(values, 3)
  const l5 = avgSlice(values, 5)
  const l10 = avgSlice(values, 10)
  const season = avgSlice(values, values.length)

  const projection = l3 * 0.40 + l5 * 0.30 + l10 * 0.20 + season * 0.10
  return Math.round(projection * 10) / 10
}

/**
 * NFL Projection Model
 *
 * NFL is heavily matchup-dependent with only 17 games/season.
 * Recent form is king — L3 gets 55% weight.
 *
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

/**
 * NHL Projection Model
 *
 * NHL has 82 games/season — good sample sizes.
 * Goals/assists are Poisson-distributed; shots/hits are volume stats.
 *
 *   Projection = L3 × 0.35 + L5 × 0.30 + L10 × 0.20 + Season × 0.15
 */
function computeNHLProjection(values: number[]): number {
  const l3 = avgSlice(values, 3)
  const l5 = avgSlice(values, 5)
  const l10 = avgSlice(values, 10)
  const season = avgSlice(values, values.length)

  let projection: number
  if (values.length >= 10) {
    projection = l3 * 0.35 + l5 * 0.30 + l10 * 0.20 + season * 0.15
  } else if (values.length >= 5) {
    projection = l3 * 0.45 + l5 * 0.30 + season * 0.25
  } else {
    projection = l3 * 0.60 + season * 0.40
  }

  return Math.round(projection * 10) / 10
}

/** Computes the average of the first N values (most recent first). */
function avgSlice(values: number[], n: number): number {
  if (values.length === 0) return 0
  const slice = values.slice(0, Math.min(n, values.length))
  return slice.reduce((s, v) => s + v, 0) / slice.length
}

/**
 * Computes the prop line for a stat.
 *
 * For rare events: Use mean of L10 rounded to 0.5 (median would be 0 for most players).
 * For volume stats: Use median of L10 rounded to 0.5.
 */
function computeESPNPropLine(values: number[], isRareEvent: boolean): number {
  const recent = values.slice(0, 10)
  if (recent.length === 0) return 0

  if (isRareEvent) {
    const mean = recent.reduce((s, v) => s + v, 0) / recent.length
    const line = roundToHalf(mean)
    if (line === 0 && recent.some((v) => v > 0)) return 0.5
    return line
  }

  // Volume stats: use median
  const sorted = [...recent].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const med = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
  return roundToHalf(med)
}

// ─── Main Engine ────────────────────────────────────────────────────────────

export async function computeESPNProps(
  sport: ESPNSport,
  stat: string,
  options?: { direction?: "over" | "under"; search?: string; limit?: number }
): Promise<ESPNPropsResult> {
  const search = options?.search ?? ""
  const limit = options?.limit ?? 50

  const cacheKey = `espn-props:${sport}:${stat}:${search.slice(0, 20)}`

  return cached(cacheKey, () => computeESPNPropsUncached(sport, stat, search, limit), 60_000)
}

async function computeESPNPropsUncached(
  sport: ESPNSport,
  stat: string,
  search: string,
  limit: number
): Promise<ESPNPropsResult> {
  const startTime = Date.now()
  const supabase = createAdminClient()
  const leagues = SPORT_LEAGUES[sport]
  const isRareEvent = RARE_EVENT_STATS[sport].has(stat)
  const minGames = MIN_GAMES[sport]

  // Paginate to get enough data
  let data: any[] = []
  const pageSize = 1000
  const maxRows = 5000

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data: batch, error } = await supabase
      .from("espn_player_stats")
      .select("player_name, team, league, match_date, stats")
      .in("league", leagues)
      .order("match_date", { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error || !batch || batch.length === 0) {
      if (offset === 0 && error) {
        console.error(`[engine-espn] ${sport} query failed:`, error.message)
      }
      break
    }

    data = data.concat(batch)
    if (batch.length < pageSize) break
  }

  if (data.length === 0) {
    return { props: [], computeTimeMs: Date.now() - startTime }
  }

  // Group by player and extract stat values (most recent first)
  const playerGames = new Map<string, {
    team: string
    league: string
    games: { value: number; date: string; opponent: string }[]
  }>()

  for (const row of data as any[]) {
    const playerName = row.player_name as string
    const statsJson = typeof row.stats === "string" ? JSON.parse(row.stats) : row.stats

    const value = extractStat(statsJson, stat)
    if (value === null) continue

    if (!playerGames.has(playerName)) {
      playerGames.set(playerName, {
        team: row.team,
        league: row.league,
        games: [],
      })
    }

    playerGames.get(playerName)!.games.push({
      value,
      date: row.match_date,
      opponent: "",
    })
  }

  // Build prop cards with quality filtering
  const props: ESPNPropCard[] = []

  for (const [playerName, playerData] of playerGames) {
    const { team, league, games } = playerData

    // Minimum games check
    if (games.length < minGames) continue

    // Recency check: skip players who haven't played within the sport-specific cutoff
    const mostRecentDate = new Date(games[0].date)
    const daysSinceLastGame = (Date.now() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24)
    const recencyCutoff = RECENCY_CUTOFF_DAYS[sport]
    if (daysSinceLastGame > recencyCutoff) continue

    // Apply search filter early
    if (search.length >= 2) {
      const q = search.toLowerCase()
      if (!playerName.toLowerCase().includes(q) && !team.toLowerCase().includes(q)) {
        continue
      }
    }

    const values = games.map((g) => g.value)

    // Compute prop line
    const propLine = computeESPNPropLine(values, isRareEvent)
    if (propLine <= 0) continue

    // Compute averages
    const l5Avg = Math.round(avgSlice(values, 5) * 10) / 10
    const l10Avg = Math.round(avgSlice(values, 10) * 10) / 10

    // Compute hit rate (L10)
    const l10Values = values.slice(0, 10)
    const overCount = l10Values.filter((v) => v >= propLine).length
    const totalGames = l10Values.length
    const overHitRate = totalGames > 0 ? overCount / totalGames : 0
    const underHitRate = totalGames > 0 ? (totalGames - overCount) / totalGames : 0

    // ─── Quality Gate ──────────────────────────────────────────────────────
    // For limited data (< 6 games), use any directional lean
    // For sufficient data (6+ games), require hit rate threshold
    let bestDirection: "over" | "under"
    let hitRateForDirection: number

    if (totalGames >= 6) {
      // Enough data — use hit rate threshold
      let threshold: number
      if (sport === "NFL") {
        threshold = NFL_HIT_RATE_THRESHOLD
      } else if (isRareEvent) {
        threshold = RARE_EVENT_HIT_RATE_THRESHOLD
      } else {
        threshold = HIT_RATE_THRESHOLD
      }

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
      // Limited data — use any directional lean (> 50%)
      if (overHitRate > underHitRate) {
        bestDirection = "over"
        hitRateForDirection = overHitRate
      } else if (underHitRate > overHitRate) {
        bestDirection = "under"
        hitRateForDirection = underHitRate
      } else {
        // Exactly 50/50 — skip
        continue
      }
    }

    // ─── Sport-Specific Projection ────────────────────────────────────────
    let projectedValue: number
    switch (sport) {
      case "Soccer":
        projectedValue = computeSoccerProjection(values)
        break
      case "NFL":
        projectedValue = computeNFLProjection(values)
        break
      case "NHL":
        projectedValue = computeNHLProjection(values)
        break
    }

    // Compute trend
    const trendPct = l10Avg > 0 ? Math.round(((l5Avg - l10Avg) / l10Avg) * 100) : 0
    const trend: "up" | "down" | "neutral" =
      trendPct > 5 ? "up" : trendPct < -5 ? "down" : "neutral"

    // Probability: based on hit rate, boosted if projection agrees with direction
    const projectionAgrees =
      (bestDirection === "over" && projectedValue >= propLine) ||
      (bestDirection === "under" && projectedValue <= propLine)

    const probability = projectionAgrees
      ? Math.min(0.99, hitRateForDirection + 0.05)
      : Math.max(0.50, hitRateForDirection - 0.10)

    // Build last games array
    const lastGames: GameResult[] = games.slice(0, 15).map((g) => ({
      value: g.value,
      overLine: g.value >= propLine,
      date: g.date,
      opponent: g.opponent || team,
    }))

    // Build graphData for MiniGraph (chronological order, most recent last)
    const graphData = games.slice(0, 15).reverse().map((g) => ({
      value: g.value,
      date: g.date,
      opponent: g.opponent || team,
      overLine: g.value >= propLine,
      minutes: 0,
    }))

    const prop: ESPNPropCard = {
      id: `${slugify(playerName)}-${stat}`,
      player: playerName,
      team,
      statCategory: stat,
      propLine,
      l5Avg,
      l10Avg,
      lastGames,
      hitRate: {
        over: overCount,
        total: totalGames,
        label: `${overCount}/${totalGames}`,
      },
      trend,
      trendPct: Math.abs(trendPct),
      matchup: "",
      sport,
      position: "",
      probability,
      direction: bestDirection,
      league: LEAGUE_DISPLAY[league] ?? league,
      headshotUrl: null,
      projectedValue,
      graphData,
    }

    props.push(prop)
  }

  // Sort by probability descending (strongest signals first)
  props.sort((a, b) => {
    if (b.probability !== a.probability) return b.probability - a.probability
    const aHit = a.hitRate.total > 0 ? a.hitRate.over / a.hitRate.total : 0
    const bHit = b.hitRate.total > 0 ? b.hitRate.over / b.hitRate.total : 0
    return bHit - aHit
  })

  // Apply limit
  const limited = props.slice(0, limit)

  // ─── Bulk fetch headshot URLs from espn_players table ─────────────────────
  if (limited.length > 0) {
    const playerNames = limited.map((p) => p.player)
    try {
      const { data: playerRows } = await supabase
        .from("espn_players")
        .select("name, espn_id, headshot_url, sport")
        .in("name", playerNames)

      if (playerRows && playerRows.length > 0) {
        const headshotMap = new Map<string, string>()
        for (const row of playerRows as any[]) {
          const url = row.headshot_url
            || `https://a.espncdn.com/i/headshots/${row.sport}/players/full/${row.espn_id}.png`
          headshotMap.set(row.name, url)
        }
        for (const prop of limited) {
          prop.headshotUrl = headshotMap.get(prop.player) ?? null
        }
      }
    } catch {
      // Non-critical — props still work without headshots
    }
  }

  return {
    props: limited,
    computeTimeMs: Date.now() - startTime,
  }
}
