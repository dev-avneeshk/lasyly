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
import { cached } from "@/lib/cache"
import { fetchPagedParallel } from "@/lib/supabase/paged"
import { getStoredHeadshotIds, resolveHeadshotUrl } from "@/lib/data/headshot-storage"
import { PropCardData, GameResult } from "@/lib/props/types"
import {
  getNFLDefenseLeagueTable,
  rankDefenseTable,
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

/**
 * A raw `nfl_player_stats` row, as selected by SELECT_COLUMNS.
 *
 * We keep these as flat records rather than mapping to a typed shape because
 * `resolveStatValues` picks its source column at runtime (a QB's "YDS" is
 * pass_yds, a RB's is rush_yds), and because a plain record survives the
 * JSON round trip through Redis unchanged.
 */
type NFLRawRow = Record<string, unknown>

/** Player name → their game rows, most recent first. JSON-safe for caching. */
type NFLPlayerRows = Record<string, NFLRawRow[]>

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

// ─── Cache TTLs ──────────────────────────────────────────────────────────────
//
// `stat=all` fans out to four parallel computeNFLProps calls (YDS/TD/REC/CAR),
// and every one of them needs the same slate, the same player-history rows, the
// same head-to-head records and the same headshots. Without a shared cache each
// stat re-ran all of it, so the request paid for that work four times over.
// These TTLs are generous because the underlying data is weekly: NFL box scores
// do not change between Monday and Thursday.

/** Upcoming slate: re-check a few times an hour for status flips. */
const SLATE_TTL_MS = 5 * 60_000

/** Player game history: only changes when a game finishes. */
const PLAYER_HISTORY_TTL_MS = 15 * 60_000

/** Head-to-head records and scoring environment: effectively static in-week. */
const TEAM_CONTEXT_TTL_MS = 60 * 60_000

/** Headshot URLs: roster-stable, safe to hold for a day. */
const HEADSHOT_TTL_MS = 24 * 60 * 60_000

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

// ─── Completed-game history (shared by series records + pace) ────────────────

interface CompletedGame {
  home_abbr: string | null
  away_abbr: string | null
  home_score: number | null
  away_score: number | null
}

/**
 * Every completed NFL game, fetched once and shared.
 *
 * Head-to-head records and the scoring-environment ("pace") table were both
 * querying `nfl_games` for completed games independently — and each of the four
 * parallel stat computations ran both. That was eight nearly identical scans of
 * the same table per request. They are now one cached read that both consumers
 * reduce in memory.
 */
async function fetchCompletedGames(): Promise<CompletedGame[]> {
  return cached(
    "nfl-completed-games",
    async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("nfl_games")
        .select("home_abbr, away_abbr, home_score, away_score")
        .eq("status", "completed")
        .limit(4000)

      if (error) {
        console.error("[engine-nfl] completed games query failed:", error.message)
        return []
      }
      return (data ?? []) as CompletedGame[]
    },
    TEAM_CONTEXT_TTL_MS
  )
}

/**
 * Fetch head-to-head records for a set of (team, opponent) pairs from
 * nfl_games. Returns a map keyed "TEAM-OPP" → { team, opponent } win counts.
 */
async function fetchSeriesRecords(pairs: [string, string][]): Promise<Map<string, NFLSeriesRecord>> {
  const out = new Map<string, NFLSeriesRecord>()
  if (pairs.length === 0) return out

  const games = await fetchCompletedGames()
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

  const games = await fetchCompletedGames()

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
  //
  // The league allowance table is identical for every (opponent, position) pair,
  // so it is fetched ONCE and ranked in memory. Previously this mapped over
  // `defenseKeys` calling `getNFLDefenseAllowed`, which went through `cached()`
  // per pair — ~40 Redis reads of the same blob per stat, ~160 per `stat=all`
  // request, for data that never varies within a request.
  const [leagueTable, seriesMap, paceMap] = await Promise.all([
    getNFLDefenseLeagueTable().catch(() => null),
    fetchSeriesRecords(seriesPairs),
    fetchPaceMap([...oppsForPace]),
  ])

  const defenseResults = new Map<string, DefenseAllowedResult>()
  if (leagueTable) {
    for (const [k, { opp, pos }] of defenseKeys) {
      try {
        defenseResults.set(k, rankDefenseTable(leagueTable, opp, pos))
      } catch { /* skip */ }
    }
  }

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
 * Fetch the NFL slate props should be generated for. This is TWO sets unioned:
 *
 *  1. Upcoming games: status scheduled/in_progress in (today, today + window].
 *  2. TODAY's games regardless of status — including a game that just finished
 *     (status "completed"). NFL is once-a-week and games are often standalone
 *     (a single Monday/Thursday night game). If we only ever showed scheduled
 *     games, the props page would go empty the moment the day's game kicked off
 *     and stay empty all day, even though the game strip still shows it. Props
 *     are built from each team's PRIOR-game history, so a completed game today
 *     still has everything needed to surface props for its two teams.
 *
 * Returns team abbreviations, which match nfl_player_stats.team directly.
 */
async function fetchUpcomingGames(today: string): Promise<NFLTodayGame[]> {
  return cached(
    `nfl-slate:${today}`,
    async () => {
      const supabase = createAdminClient()

      const end = new Date(`${today}T00:00:00Z`)
      end.setUTCDate(end.getUTCDate() + UPCOMING_WINDOW_DAYS)
      const endStr = end.toISOString().split("T")[0]

      // Upcoming scheduled/in-progress games across the week window, PLUS every
      // game dated today (any status). A single query with an OR keeps this one
      // round trip: (status in scheduled/in_progress AND date in window) OR
      // (date = today).
      const { data, error } = await supabase
        .from("nfl_games")
        .select("home_abbr, away_abbr, game_date, status")
        .gte("game_date", today)
        .lte("game_date", endStr)
        .or(`status.in.(scheduled,in_progress),game_date.eq.${today}`)
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
          // A completed game today is surfaced as "live" so the UI treats it as
          // part of today's slate rather than a future fixture.
          status: row.status === "scheduled" ? "scheduled" : "live",
        })) as NFLTodayGame[]
    },
    SLATE_TTL_MS
  )
}

// ─── Headshots ───────────────────────────────────────────────────────────────

/**
 * NFL headshot URLs for every player we know about, keyed by name.
 *
 * Previously each stat computation issued its own `.in("name", names)` lookup
 * with a different name list, so the four parallel calls could not share a cache
 * entry. Fetching the whole NFL roster once is a smaller query in aggregate and
 * gives every caller a hit.
 */
async function fetchHeadshotMap(): Promise<Record<string, string>> {
  return cached(
    // v2: the values are now our own Storage URLs where available, so entries
    // written by the previous version must not be served from cache.
    "nfl-headshots:v2",
    async () => {
      const supabase = createAdminClient()

      // Which players we serve ourselves. Independent of the row fetch, so both
      // go out together.
      //
      // The row fetch is PAGED, and that is the fix for a real bug rather than a
      // precaution. This was a single `.limit(4000)` call, but PostgREST caps a
      // response at 1000 rows irrespective of the requested limit — silently. So
      // this map only ever held ~1000 of the 2913 NFL players, and every player
      // past the cap arrived at the client with no photo, which then made
      // PlayerPhoto fire an individual /api/players/headshot request per card.
      // That was ~25 extra requests on a 50-prop page, and it looked like a
      // name-matching problem when it was truncation.
      const [storedIds, rows] = await Promise.all([
        getStoredHeadshotIds("nfl"),
        fetchPagedParallel<{ name: string; espn_id: string | null; headshot_url: string | null }>(
          async () => {
            const { count } = await supabase
              .from("espn_players")
              .select("name", { count: "exact", head: true })
              .eq("league", "nfl")
            return count ?? null
          },
          async (from, to) => {
            // Filter on `league`, not `sport`: the ESPN scraper writes
            // sport="football" and league="nfl" (see scripts/scrape_espn.py
            // LEAGUES), so an .eq("sport","NFL") filter matches nothing.
            // `league` is also indexed.
            const { data, error } = await supabase
              .from("espn_players")
              .select("name, espn_id, headshot_url")
              .eq("league", "nfl")
              .order("espn_id", { ascending: true })
              .range(from, to)
            if (error) {
              console.error("[engine-nfl] headshot page failed:", error.message)
              return []
            }
            return (data ?? []) as { name: string; espn_id: string | null; headshot_url: string | null }[]
          },
          { maxRows: 8000 }
        ),
      ])

      const map: Record<string, string> = {}
      for (const row of rows) {
        if (!row.name) continue
        // Prefers our stored ~10KB WebP, then the row's ESPN URL, then a URL
        // synthesised from espn_id — that last step stops a null headshot_url
        // from reaching the client as a missing photo.
        const url = resolveHeadshotUrl("nfl", row.espn_id, row.headshot_url, storedIds)
        if (url) map[row.name] = url
      }
      return map
    },
    HEADSHOT_TTL_MS
  )
}

// ─── Player Stats ─────────────────────────────────────────────────────────────

/**
 * Game history for every player on the given teams, grouped by player name and
 * ordered most-recent-first.
 *
 * This is the single most expensive query in the NFL path — up to 8000 rows
 * spanning a full season — and it does not depend on the stat being computed.
 * Caching it by team set means `stat=all` pays for it once instead of four
 * times, and the pages are now fetched in parallel instead of one at a time.
 */
async function fetchPlayerStats(teams: string[]): Promise<NFLPlayerRows> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - HISTORY_DAYS)
  const cutoff = cutoffDate.toISOString().split("T")[0]

  // Sorted so that the same slate produces the same key regardless of the order
  // the teams came out of the games query.
  const teamsKey = [...teams].sort().join(",")

  return cached(
    `nfl-player-rows:${cutoff}:${teamsKey}`,
    async () => {
      const supabase = createAdminClient()

      const rows = await fetchPagedParallel<NFLRawRow>(
        async () => {
          const { count } = await supabase
            .from("nfl_player_stats")
            .select("player_name", { count: "exact", head: true })
            .in("team", teams)
            .gte("game_date", cutoff)
          return count ?? null
        },
        async (from, to) => {
          // `id` is the tiebreaker, not decoration: paging in parallel means
          // each page is its own query, and ordering only by the non-unique
          // game_date lets Postgres return equal-dated rows in a different
          // order per page — which silently duplicates some rows and drops
          // others. Ordering by the primary key makes the sort total.
          const { data, error } = await supabase
            .from("nfl_player_stats")
            .select(SELECT_COLUMNS)
            .in("team", teams)
            .gte("game_date", cutoff)
            .order("game_date", { ascending: false })
            .order("id", { ascending: true })
            .range(from, to)

          if (error) {
            console.error("[engine-nfl] player stats query failed:", error.message)
            return []
          }
          // SELECT_COLUMNS is a runtime-built string, so Supabase cannot infer a
          // row type for it and falls back to GenericStringError.
          return (data ?? []) as unknown as NFLRawRow[]
        },
        { maxRows: 8000 }
      )

      const out: NFLPlayerRows = {}
      for (const row of rows) {
        const name = row.player_name as string
        if (!name) continue
        if (!out[name]) out[name] = []
        out[name].push(row)
      }
      return out
    },
    PLAYER_HISTORY_TTL_MS
  )
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

  // Step 3: player stats for those teams, plus headshots (independent, so
  // fetch them together rather than serially).
  const [playerRows, headshotMap] = await Promise.all([
    fetchPlayerStats(teams),
    fetchHeadshotMap(),
  ])
  const playerEntries = Object.entries(playerRows)
  if (playerEntries.length === 0) {
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

  for (const [playerName, rawRows] of playerEntries) {
    if (!rawRows || rawRows.length === 0) continue

    // Search filter (early)
    const team = (rawRows[0]?.team as string) ?? ""
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
      position: (rawRows[0]?.position as string) ?? "",
      probability,
      direction: bestDirection,
      league: "NFL",
      headshotUrl: headshotMap[playerName] ?? null,
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
  // Headshots are already attached from the shared cached map above.
  await enrichWithMatchup(limited, stat)

  return {
    props: limited,
    todayGames,
    fallbackMode: false,
    computeTimeMs: Date.now() - startTime,
  }
}
