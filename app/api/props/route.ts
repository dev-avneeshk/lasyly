import { NextResponse } from "next/server"
import { cached } from "@/lib/cache"
import { computeEnhancedProps } from "@/lib/analytics/engine"
import { computeMatchupScopedProps, isValidMatchupFormat } from "@/lib/analytics/engine-v2"
import { computeESPNProps, ESPNSport } from "@/lib/analytics/engine-espn"
import { computeNFLProps } from "@/lib/analytics/engine-nfl"
import { computeTeamProps, TeamPropStat } from "@/lib/analytics/engine-team-props"
import { applyAdvancedFilters, getActiveFilterCount } from "@/lib/analytics/filters"
import { resolveNBAHeadshots } from "@/lib/analytics/nba-headshots"
import { AdvancedFilterState } from "@/lib/analytics/types"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { getClientIp } from "@/lib/security/clientIp"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  VALID_SPORTS,
  VALID_NBA_STATS,
  VALID_TENNIS_STATS,
  VALID_SOCCER_STATS,
  VALID_NFL_STATS,
  VALID_NHL_STATS,
} from "@/lib/props/statCatalog"

// ─── Constants ────────────────────────────────────────────────────────────────

/** Cache TTL for matchup-scoped props: 60 seconds */
const MATCHUP_PROPS_CACHE_TTL = 60_000

/**
 * Per-sport response TTLs.
 *
 * These were 30-60 seconds, which was badly mismatched to the cost of a miss:
 * computing a full NBA or NFL slate is dozens of Supabase queries over tens of
 * thousands of rows, so a one-minute TTL meant an ordinary browsing session kept
 * landing on cold recomputes. Nothing upstream justified being that eager —
 * props are derived from *completed* games plus the scheduled slate, and both
 * only change when a scraper runs.
 *
 * `cached()` additionally serves stale entries instantly up to 2x these values
 * while one instance refreshes in the background, so the effective worst case a
 * user sees is a cache hit.
 */
const PROPS_TTL = {
  /** NBA: nightly slate; injury/rotation news moves lines within the day. */
  nba: 3 * 60_000,
  /** NFL: games are weekly, so the inputs are static for days at a time. */
  nfl: 10 * 60_000,
  /** Soccer team props: multi-day fixture window. */
  soccer: 5 * 60_000,
  /** NHL / other ESPN-sourced sports. */
  espn: 5 * 60_000,
  /** Soccer fixture gate — a small query, but it ran outside the cache. */
  soccerSlate: 5 * 60_000,
} as const

/**
 * Hard cap on free-text query params (`search`, `withoutPlayer`).
 *
 * These flow into two dangerous places: the Redis cache key, and an
 * `ilike '%…%'` predicate. Uncapped, `withoutPlayer` was the cheapest way to
 * make this endpoint do maximum work — it is part of the cache key, so every
 * distinct value is a guaranteed cache MISS, and a miss recomputes six stat
 * categories (~42 Supabase queries, up to 30k rows). No auth required.
 *
 * 40 characters comfortably fits any real player name.
 */
const MAX_FREE_TEXT_LENGTH = 40

/** Valid NBA team abbreviations */
const TEAM_ABBREVIATIONS = new Set([
  "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
])

// Sport and stat allowlists live in lib/props/statCatalog so that /api/bets
// validates against exactly the same definitions. They previously diverged,
// which made some props impossible to log.

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns today's date in US Eastern Time as YYYY-MM-DD.
 * NBA games are scheduled in ET, so we use ET to match game_date in the database.
 */
function getTodayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
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
  // Clamp rather than trust: a NaN limit propagated into Math.min(limit, 200)
  // as NaN, and a negative one turned `slice(0, limit)` into a tail slice.
  const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50
  const matchup = searchParams.get("matchup") ?? undefined

  // ─── Advanced Filter Parameters ─────────────────────────────────────────────
  const withoutPlayer = searchParams.get("withoutPlayer") ?? ""

  // ─── Bound the free-text inputs BEFORE they reach a cache key or an ilike ───
  for (const [name, value] of [
    ["search", search],
    ["withoutPlayer", withoutPlayer],
  ] as const) {
    if (value.length > MAX_FREE_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `"${name}" must be ${MAX_FREE_TEXT_LENGTH} characters or fewer.` },
        { status: 400 }
      )
    }
  }

  // This endpoint is unauthenticated and, on a cache miss, is the most
  // expensive thing in the app. The coarse per-IP tier in proxy.ts (120/min for
  // anonymous traffic) is far too generous for it, so bound it specifically.
  const expensiveRead = await checkRateLimit(
    `props:${getClientIp(request)}`,
    RATE_LIMITS.expensiveRead
  )
  if (!expensiveRead.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(expensiveRead.retryAfterMs / 1000)) },
      }
    )
  }
  const homeAway = (searchParams.get("homeAway") ?? "all") as "all" | "home" | "away"
  const opponent = searchParams.get("opponent") ?? null
  const minConfidence = Math.max(1, Math.min(5, parseInt(searchParams.get("minConfidence") ?? "1", 10) || 1))
  const direction = (searchParams.get("direction") ?? "all") as "over" | "under" | "all"
  const hitRateMin = Math.max(0, Math.min(100, parseInt(searchParams.get("hitRateMin") ?? "0", 10) || 0))
  const hitRateMax = Math.max(0, Math.min(100, parseInt(searchParams.get("hitRateMax") ?? "100", 10) || 100))

  // ─── NBA-specific Filter Parameters ────────────────────────────────────────
  const minMinutes = Math.max(0, Math.min(48, parseInt(searchParams.get("minMinutes") ?? "0", 10) || 0))
  const vsOpponent = searchParams.get("vsOpponent") === "true"

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
  // NBA uses strict 3-letter NBA abbreviations; NFL abbreviations are 2-3
  // letters (SF, TB, KC) and are validated inside the NFL branch instead.
  if (matchup !== undefined && sport === "NBA") {
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
    minMinutes,
    vsOpponent,
  }

  // ─── NBA Path: Use Engine V2 ───────────────────────────────────────────────
  if (sport === "NBA") {
    const todayDate = getTodayET()

    // When stat=all, fetch top stat categories in parallel and merge
    const nbaStatsToFetch = stat === "all"
      ? ["pts", "trb", "ast", "tp", "stl", "blk"]
      : [stat]

    const filterKey = `${minMinutes}-${vsOpponent ? "1" : "0"}-${withoutPlayer.toLowerCase().replace(/\s+/g, "_")}`
    const nbaCacheKey = `nba-props:${stat}:${direction}:${matchup ?? "all"}:${todayDate}:${filterKey}`
    const results = await cached(nbaCacheKey, () =>
      Promise.all(
        nbaStatsToFetch.map((s) =>
          computeMatchupScopedProps("NBA", s, {
            direction: direction === "all" ? "over" : direction,
            matchup,
            todayDate,
            minMinutes,
            vsOpponent,
            withoutPlayer,
          })
        )
      ),
      PROPS_TTL.nba
    )

    // Merge all props, deduplicate by id, take todayGames from first result
    const allProps = results.flatMap((r) => r.props)
    const todayGames = results[0]?.todayGames ?? []
    const fallbackMode = results[0]?.fallbackMode ?? false
    const computeTimeMs = Math.max(...results.map((r) => r.computeTimeMs))

    // If no games today (fallback mode), return empty props instead of showing
    // stale data from random recent games that aren't actually scheduled
    if (fallbackMode) {
      return NextResponse.json({
        props: [],
        todayGames: [],
        fallbackMode: true,
        meta: {
          sport,
          stat,
          total: 0,
          timestamp: new Date().toISOString(),
          computeTimeMs,
          gamesCount: 0,
          noGamesToday: true,
        },
      })
    }

    // Deduplicate: if same player appears in multiple stats, keep all (they have different IDs)
    let filtered = allProps as any[]

    // ─── Activity Filter ────────────────────────────────────────────────────
    // Exclude low-activity players from the default browse view.
    // Rules:
    //   - Must have at least 3 total games
    //   - Must have played meaningful minutes (>= 10 min) in at least 3 of last 5 games
    //   - This filters out DNP / garbage-time-only players (Topić, Biyombo, etc.)
    // Search bypasses this filter so users can still look up any player directly.
    if (!search || search.length < 2) {
      const MIN_MEANINGFUL_MINUTES = 10
      filtered = filtered.filter((p: any) => {
        const games: any[] = p.lastGames ?? []
        const totalGames: number = p.hitRate?.total ?? games.length
        // Must have at least 3 total games of data
        if (totalGames < 3) return false
        // Check last 5 games for meaningful playing time (>= 10 min)
        const last5 = games.slice(-5) // lastGames is chronological (oldest first)
        const meaningfulCount = last5.filter(
          (g: any) => g.minutes != null && g.minutes >= MIN_MEANINGFUL_MINUTES
        ).length
        if (meaningfulCount < 3) return false
        return true
      })
    }

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

    // ─── Attach headshot URLs ───────────────────────────────────────────────
    // Resolution is cached as a unit inside resolveNBAHeadshots; this call is a
    // single Redis GET once warm. It used to be an inline Supabase query plus up
    // to six 4-second ESPN roster fetches, run on every request — including the
    // cache hits above that had otherwise done no work at all.
    if (limited.length > 0) {
      const headshots = await resolveNBAHeadshots(
        limited.map((p: any) => ({ player: p.player as string, team: p.team as string | null }))
      )
      for (const prop of limited) {
        const p = prop as any
        if (!p.headshotUrl) {
          p.headshotUrl = headshots[p.player] ?? null
        }
      }
    }

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

  // ─── NFL Path: dedicated nfl_player_stats + nfl_games engine (mirrors NBA) ──
  // NFL reads the clean flat-column tables (like NBA reads nba_player_stats),
  // gated on the upcoming slate. This replaces the old espn_player_stats path.
  if (sport === "NFL") {
    const todayDate = getTodayET()
    const nflStatsToFetch = stat === "all" ? ["YDS", "TD", "REC", "CAR"] : [stat]
    const nflMatchup = matchup && /^[A-Za-z]{2,3}-[A-Za-z]{2,3}$/.test(matchup) ? matchup : undefined

    const nflCacheKey = `nfl-props:${stat}:${direction}:${search}:${todayDate}:${nflMatchup ?? "all"}`
    const nflResults = await cached(
      nflCacheKey,
      () =>
        Promise.all(
          nflStatsToFetch.map((s) =>
            computeNFLProps(s, todayDate, {
              direction,
              search,
              limit: Math.min(limit, 200),
              matchup: nflMatchup,
            })
          )
        ),
      PROPS_TTL.nfl
    )

    const todayGames = nflResults[0]?.todayGames ?? []
    const fallbackMode = nflResults.every((r) => r.fallbackMode)
    const nflComputeTimeMs = Math.max(...nflResults.map((r) => r.computeTimeMs))

    // No games in the upcoming window → return empty (identical to NBA off-day)
    if (fallbackMode) {
      return NextResponse.json({
        props: [],
        todayGames: [],
        fallbackMode: true,
        meta: {
          sport,
          stat,
          total: 0,
          timestamp: new Date().toISOString(),
          computeTimeMs: nflComputeTimeMs,
          gamesCount: 0,
          noGamesToday: true,
        },
      })
    }

    // Merge props from all fetched stats, dedupe by id
    let nflMerged = nflResults.flatMap((r) => r.props) as any[]
    const seen = new Set<string>()
    nflMerged = nflMerged.filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    if (direction && direction !== "all") {
      const dirFiltered = nflMerged.filter((p) => p.direction === direction)
      if (dirFiltered.length > 0) nflMerged = dirFiltered
    }

    nflMerged.sort((a, b) => b.probability - a.probability)
    const nflLimited = nflMerged.slice(0, Math.min(limit, 100))

    return NextResponse.json({
      props: nflLimited,
      todayGames,
      fallbackMode: false,
      meta: {
        sport,
        stat,
        total: nflLimited.length,
        timestamp: new Date().toISOString(),
        computeTimeMs: nflComputeTimeMs,
        gamesCount: todayGames.length,
      },
    })
  }

  // ─── ESPN Sports Path: Soccer, NHL ──────────────────────────────────────────
  if (sport === "Soccer" || sport === "NHL") {
    // Check if this is a team prop stat (Soccer only)
    const TEAM_PROP_STATS = new Set(["team_totalGoals", "team_corners", "team_cards", "team_matchGoals"])
    const isTeamProp = sport === "Soccer" && TEAM_PROP_STATS.has(stat)

    // Soccer is TEAM PROPS ONLY — always route through team props engine
    if (sport === "Soccer") {
      // Show props for teams playing in the upcoming window (today → +3 days),
      // not just games that haven't kicked off today. Soccer is intermittent
      // (games cluster on weekends), so a strict "today only" gate leaves the
      // page empty on days where the slate just finished but more are coming.
      const todayET = getTodayET()

      // Cached: this gate is a small query, but it sat outside the cache below,
      // so every soccer props request paid for it even on a cache hit.
      const soccerTeamNames = await cached(
        `soccer-slate:${todayET}`,
        async () => {
          const windowEnd = new Date(`${todayET}T00:00:00Z`)
          windowEnd.setUTCDate(windowEnd.getUTCDate() + 3)
          const windowEndStr = windowEnd.toISOString().split("T")[0]
          const adminClient = createAdminClient()
          const { data } = await adminClient
            .from("espn_games")
            .select("home_team, away_team")
            .in("league", ["eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "uefa.champions", "usa.1"])
            .gte("match_date", todayET)
            .lte("match_date", windowEndStr)
            .in("status", ["scheduled", "in_progress"])
            .limit(80)

          const names: string[] = []
          for (const g of data ?? []) {
            if (g.home_team) names.push(g.home_team)
            if (g.away_team) names.push(g.away_team)
          }
          return [...new Set(names)]
        },
        PROPS_TTL.soccerSlate
      )

      const todaySoccerTeams = new Set<string>(soccerTeamNames)

      // If no soccer games in the upcoming window, return empty props
      if (todaySoccerTeams.size === 0) {
        return NextResponse.json({
          props: [],
          meta: {
            sport,
            stat,
            total: 0,
            timestamp: new Date().toISOString(),
            computeTimeMs: 0,
            isTeamProps: true,
            noGamesToday: true,
          },
        })
      }

      // Map "all" and player stat keys to team prop equivalents
      const soccerTeamStatsMap: Record<string, string[]> = {
        all: ["team_totalGoals", "team_matchGoals", "team_cards"],
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
        PROPS_TTL.soccer
      )

      let teamFiltered = teamResults.flatMap((r) => r.props) as any[]
      const teamComputeTimeMs = Math.max(...teamResults.map((r) => r.computeTimeMs))

      // Only show teams that have a game today
      teamFiltered = teamFiltered.filter((p: any) => todaySoccerTeams.has(p.team))

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

    // NHL — player props via ESPN engine (NFL is handled earlier by its own engine)
    const espnStatsMap: Record<string, string[]> = {
      NHL: ["G", "A", "SOG", "HT"],
    }
    const statsToFetch = stat === "all" ? espnStatsMap[sport] : [stat]

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
      PROPS_TTL.espn
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
  const tennisDirection = direction === "all" ? undefined : direction

  // `direction` belongs in the key: it is passed into computeEnhancedProps and
  // changes the result, so omitting it meant an "over" request could be served
  // the cached "under" set (and vice versa) for the life of the entry.
  const cacheKey = `enhanced-props-api:${sport}:${stat}:${direction}`

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
  }, PROPS_TTL.espn)

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
