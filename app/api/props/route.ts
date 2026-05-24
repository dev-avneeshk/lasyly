import { NextResponse } from "next/server"
import { cached } from "@/lib/cache"
import { computeEnhancedProps } from "@/lib/analytics/engine"
import { computeMatchupScopedProps, isValidMatchupFormat } from "@/lib/analytics/engine-v2"
import { computeESPNProps, ESPNSport } from "@/lib/analytics/engine-espn"
import { computeTeamProps, TeamPropStat } from "@/lib/analytics/engine-team-props"
import { applyAdvancedFilters, getActiveFilterCount } from "@/lib/analytics/filters"
import { AdvancedFilterState } from "@/lib/analytics/types"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// ─── Constants ────────────────────────────────────────────────────────────────

/** Cache TTL for matchup-scoped props: 60 seconds */
const MATCHUP_PROPS_CACHE_TTL = 60_000

/** Valid NBA team abbreviations */
const TEAM_ABBREVIATIONS = new Set([
  "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
])

/** Valid NBA stat categories */
const VALID_NBA_STATS = new Set([
  "pts", "reb", "ast", "stl", "blk", "3pm", "tov", "fg", "fga", "ft", "fta",
  "trb", "tp", "pra",
])

/** Valid Tennis stat categories */
const VALID_TENNIS_STATS = new Set([
  "all",
  "aces", "double_faults", "first_serve_pct", "first_serve_win_pct",
  "second_serve_win_pct", "hold_pct", "win_pct",
  "sets_won", "sets_lost", "games_won", "games_lost",
])

/** Valid Soccer stat categories */
const VALID_SOCCER_STATS = new Set([
  "totalGoals", "goalAssists", "totalShots", "shotsOnTarget",
  "foulsCommitted", "foulsSuffered", "yellowCards", "redCards",
  "saves", "appearances",
  // Team props
  "team_totalGoals", "team_corners", "team_cards", "team_matchGoals",
])

/** Valid NFL stat categories */
const VALID_NFL_STATS = new Set([
  "YDS", "TD", "REC", "CAR", "INT", "SACKS", "C/ATT", "QBR", "RTG",
  "AVG", "LONG", "FUM", "TGTS",
])

/** Valid NHL stat categories */
const VALID_NHL_STATS = new Set([
  "G", "A", "SOG", "+/-", "HT", "BS", "TK", "PIM", "TOI", "FO%",
  "S", "SM", "SHFT", "GV", "PN", "FW", "FL",
])

/** Valid sport values */
const VALID_SPORTS = new Set(["NBA", "Tennis", "Soccer", "NFL", "NHL"])

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns today's date in UTC as YYYY-MM-DD.
 */
function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0]
}

/**
 * Validates that both teams in a matchup string are recognized NBA abbreviations.
 */
function areTeamsRecognized(matchup: string): boolean {
  const [teamA, teamB] = matchup.toUpperCase().split("-")
  return TEAM_ABBREVIATIONS.has(teamA) && TEAM_ABBREVIATIONS.has(teamB)
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)

  // ─── Base Parameters ────────────────────────────────────────────────────────
  const sport = (searchParams.get("sport") ?? "NBA") as string
  const stat = searchParams.get("stat") ?? (sport === "Tennis" ? "aces" : "pts")
  const search = searchParams.get("search") ?? ""
  const limit = parseInt(searchParams.get("limit") ?? "50", 10)
  const matchup = searchParams.get("matchup") ?? undefined

  // ─── Advanced Filter Parameters ─────────────────────────────────────────────
  const withoutPlayer = searchParams.get("withoutPlayer") ?? ""
  const homeAway = (searchParams.get("homeAway") ?? "all") as "all" | "home" | "away"
  const opponent = searchParams.get("opponent") ?? null
  const minConfidence = Math.max(1, Math.min(5, parseInt(searchParams.get("minConfidence") ?? "1", 10) || 1))
  const direction = (searchParams.get("direction") ?? "all") as "over" | "under" | "all"
  const hitRateMin = Math.max(0, Math.min(100, parseInt(searchParams.get("hitRateMin") ?? "0", 10) || 0))
  const hitRateMax = Math.max(0, Math.min(100, parseInt(searchParams.get("hitRateMax") ?? "100", 10) || 100))

  // ─── Injection Check ────────────────────────────────────────────────────────
  const injectionCheck = checkQueryParams({
    sport: searchParams.get("sport"),
    stat: searchParams.get("stat"),
    search: searchParams.get("search"),
    withoutPlayer: searchParams.get("withoutPlayer"),
    opponent: searchParams.get("opponent"),
    matchup: searchParams.get("matchup"),
  })
  if (injectionCheck) return injectionCheck

  // ─── Validate Sport ─────────────────────────────────────────────────────────
  if (!VALID_SPORTS.has(sport)) {
    return NextResponse.json(
      { error: `Invalid sport: "${sport}". Supported values are: NBA, Tennis.` },
      { status: 400 }
    )
  }

  // ─── Validate Stat ──────────────────────────────────────────────────────────
  const validStatsMap: Record<string, Set<string>> = {
    NBA: VALID_NBA_STATS,
    Tennis: VALID_TENNIS_STATS,
    Soccer: VALID_SOCCER_STATS,
    NFL: VALID_NFL_STATS,
    NHL: VALID_NHL_STATS,
  }
  const validStats = validStatsMap[sport] ?? VALID_NBA_STATS
  // "all" is a special meta-stat that fetches multiple categories
  if (stat !== "all" && !validStats.has(stat) && !validStats.has(stat.toLowerCase())) {
    return NextResponse.json(
      { error: `Invalid stat "${stat}" for sport "${sport}". Supported values are: all, ${[...validStats].join(", ")}.` },
      { status: 400 }
    )
  }

  // ─── Validate Matchup (NBA only) ───────────────────────────────────────────
  if (matchup !== undefined) {
    if (!isValidMatchupFormat(matchup)) {
      return NextResponse.json(
        { error: `Invalid matchup format: "${matchup}". Expected two 3-letter team abbreviations separated by a hyphen (e.g., "LAL-GSW").` },
        { status: 400 }
      )
    }
    if (!areTeamsRecognized(matchup)) {
      const [teamA, teamB] = matchup.toUpperCase().split("-")
      const unrecognized = [teamA, teamB].filter((t) => !TEAM_ABBREVIATIONS.has(t))
      return NextResponse.json(
        { error: `Unrecognized team abbreviation(s): ${unrecognized.join(", ")}. Must be valid NBA team abbreviations.` },
        { status: 400 }
      )
    }
  }

  // ─── Build Filter State ─────────────────────────────────────────────────────
  const filters: AdvancedFilterState = {
    withoutPlayer,
    homeAway,
    opposingTeam: opponent,
    opposingPlayer: null,
    minConfidence,
    direction,
    hitRateMin,
    hitRateMax,
  }

  // ─── NBA Path: Use Engine V2 ───────────────────────────────────────────────
  if (sport === "NBA") {
    const todayDate = getTodayUTC()

    // When stat=all, fetch top stat categories in parallel and merge
    const nbaStatsToFetch = stat === "all"
      ? ["pts", "trb", "ast", "tp", "stl", "blk"]
      : [stat]

    // Cache NBA props for 30 seconds to avoid recomputing on every request
    const nbaCacheKey = `nba-props:${stat}:${direction}:${matchup ?? "all"}:${todayDate}`
    const results = await cached(nbaCacheKey, () =>
      Promise.all(
        nbaStatsToFetch.map((s) =>
          computeMatchupScopedProps("NBA", s, {
            direction: direction === "all" ? "over" : direction,
            matchup,
            todayDate,
          })
        )
      ),
      30_000 // 30 second cache
    )

    // Merge all props, deduplicate by id, take todayGames from first result
    const allProps = results.flatMap((r) => r.props)
    const todayGames = results[0]?.todayGames ?? []
    const fallbackMode = results[0]?.fallbackMode ?? false
    const computeTimeMs = Math.max(...results.map((r) => r.computeTimeMs))

    // Deduplicate: if same player appears in multiple stats, keep all (they have different IDs)
    let filtered = allProps as any[]

    // Apply direction filter at API level
    if (direction && direction !== "all") {
      const dirFiltered = filtered.filter((p: any) => p.direction === direction)
      if (dirFiltered.length > 0) {
        filtered = dirFiltered
      }
    }

    // Apply search filter
    if (search.length >= 2) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (p: any) =>
          p.player.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q) ||
          (p.matchup && p.matchup.toLowerCase().includes(q))
      )
    }

    // Sort merged results by probability descending
    filtered.sort((a: any, b: any) => {
      if (b.probability !== a.probability) return b.probability - a.probability
      const aProj = a.projection?.projection ?? 0
      const bProj = b.projection?.projection ?? 0
      return bProj - aProj
    })

    // Apply limit
    const limited = filtered.slice(0, Math.min(limit, 100))

    return NextResponse.json({
      props: limited,
      todayGames,
      fallbackMode,
      meta: {
        sport,
        stat,
        total: limited.length,
        timestamp: new Date().toISOString(),
        computeTimeMs,
        gamesCount: todayGames.length,
      },
    })
  }

  // ─── ESPN Sports Path: Soccer, NFL, NHL ─────────────────────────────────────
  if (sport === "Soccer" || sport === "NFL" || sport === "NHL") {
    // Check if this is a team prop stat (Soccer only)
    const TEAM_PROP_STATS = new Set(["team_totalGoals", "team_corners", "team_cards", "team_matchGoals"])
    const isTeamProp = sport === "Soccer" && TEAM_PROP_STATS.has(stat)

    // Soccer is TEAM PROPS ONLY — always route through team props engine
    if (sport === "Soccer") {
      // Map "all" and player stat keys to team prop equivalents
      const soccerTeamStatsMap: Record<string, string[]> = {
        all: ["team_totalGoals", "team_matchGoals", "team_cards", "team_corners"],
        totalGoals: ["team_totalGoals"],
        goalAssists: ["team_totalGoals"],
        totalShots: ["team_totalGoals"],
        shotsOnTarget: ["team_totalGoals"],
        foulsCommitted: ["team_cards"],
        yellowCards: ["team_cards"],
        saves: ["team_totalGoals"],
        team_totalGoals: ["team_totalGoals"],
        team_matchGoals: ["team_matchGoals"],
        team_cards: ["team_cards"],
        team_corners: ["team_corners"],
      }
      const teamStatsToFetch = soccerTeamStatsMap[stat] ?? ["team_totalGoals"]

      const teamCacheKey = `team-props:soccer:${stat}:${search}`
      const teamResults = await cached(teamCacheKey, () =>
        Promise.all(
          teamStatsToFetch.map((ts) =>
            computeTeamProps(ts as TeamPropStat, { search, limit: Math.min(limit, 100) })
          )
        ),
        60_000
      )

      let teamFiltered = teamResults.flatMap((r) => r.props) as any[]
      const teamComputeTimeMs = Math.max(...teamResults.map((r) => r.computeTimeMs))

      // Apply direction filter
      if (direction && direction !== "all") {
        const dirFiltered = teamFiltered.filter((p: any) => p.direction === direction)
        if (dirFiltered.length > 0) {
          teamFiltered = dirFiltered
        }
      }

      // Deduplicate by id
      const seen = new Set<string>()
      teamFiltered = teamFiltered.filter((p: any) => {
        if (seen.has(p.id)) return false
        seen.add(p.id)
        return true
      })

      teamFiltered.sort((a: any, b: any) => b.probability - a.probability)
      const teamLimited = teamFiltered.slice(0, Math.min(limit, 100))

      return NextResponse.json({
        props: teamLimited,
        meta: {
          sport,
          stat,
          total: teamLimited.length,
          timestamp: new Date().toISOString(),
          computeTimeMs: teamComputeTimeMs,
          isTeamProps: true,
        },
      })
    }

    // NFL, NHL — player props via ESPN engine
    const espnStatsMap: Record<string, string[]> = {
      NFL: ["YDS", "TD", "REC", "CAR"],
      NHL: ["G", "A", "SOG", "HT"],
    }
    const statsToFetch = stat === "all" ? espnStatsMap[sport] : [stat]

    // Cache ESPN props for 60 seconds
    const espnCacheKey = `espn-props:${sport}:${stat}:${search}`
    const espnResults = await cached(espnCacheKey, () =>
      Promise.all(
        statsToFetch.map((s) =>
          computeESPNProps(sport as ESPNSport, s, {
            search,
            limit: Math.min(limit, 200),
          })
        )
      ),
      60_000
    )

    // Merge all props
    let espnFiltered = espnResults.flatMap((r) => r.props) as any[]
    const espnComputeTimeMs = Math.max(...espnResults.map((r) => r.computeTimeMs))

    // Apply direction filter at API level
    if (direction && direction !== "all") {
      const dirFiltered = espnFiltered.filter((p: any) => p.direction === direction)
      if (dirFiltered.length > 0) {
        espnFiltered = dirFiltered
      }
    }

    // Sort by probability
    espnFiltered.sort((a: any, b: any) => b.probability - a.probability)

    // Apply final limit
    const espnLimited = espnFiltered.slice(0, Math.min(limit, 100))

    return NextResponse.json({
      props: espnLimited,
      meta: {
        sport,
        stat,
        total: espnLimited.length,
        timestamp: new Date().toISOString(),
        computeTimeMs: espnComputeTimeMs,
      },
    })
  }

  // ─── Tennis Path: Use existing engine (V1) ─────────────────────────────────
  const cacheKey = `enhanced-props-api:${sport}:${stat}`

  const tennisDirection = direction === "all" ? undefined : direction

  // When stat=all, fetch aces + double_faults + win_pct + sets_won + games_won and merge
  const tennisStatsToFetch = stat === "all"
    ? ["aces", "double_faults", "win_pct", "sets_won", "games_won"]
    : [stat]

  const allProps = await cached(cacheKey, async () => {
    const results = await Promise.all(
      tennisStatsToFetch.map((s) =>
        computeEnhancedProps(sport as "NBA" | "Tennis", s, tennisDirection ? { direction: tennisDirection } : undefined)
      )
    )
    return results.flat()
  }, MATCHUP_PROPS_CACHE_TTL)

  // Apply advanced filters
  let filtered = applyAdvancedFilters(allProps, filters)

  // Apply search filter
  if (search.length >= 2) {
    const q = search.toLowerCase()
    filtered = filtered.filter(
      (p) =>
        p.player.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        (p.matchup && p.matchup.toLowerCase().includes(q))
    )
  }

  // Apply limit
  const result = filtered.slice(0, Math.min(limit, 100))

  return NextResponse.json({
    props: result,
    meta: {
      sport,
      stat,
      total: result.length,
      timestamp: new Date().toISOString(),
      activeFilters: getActiveFilterCount(filters),
    },
  })
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })
