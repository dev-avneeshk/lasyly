/**
 * Parlay Leg Settlement Module
 *
 * Settles individual parlay legs by checking actual player game stats
 * against the prop line and direction. Once all legs in a parlay are
 * settled, the parlay itself gets resolved (won if all legs won, lost
 * if any leg lost).
 *
 * Settlement logic:
 * - Fetches pending legs along with the parlay's created_at timestamp
 * - Only considers games that tipped off AFTER the parlay was created
 * - NBA names match exactly (creation validates them); Tennis is case-insensitive
 * - Supports NBA auto-settlement; Tennis uses serve stats when available
 * - Unsettleable legs expire after 5 days; the parlay is then void, never won
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { fetchESPNLeague } from "@/lib/services/espn"
import { fetchAllIn } from "@/lib/supabase/paged"

// ─── Types ──────────────────────────────────────────────────────────────────

interface PendingLeg {
  id: string
  parlay_id: string
  player_name: string
  stat_category: string
  prop_line: number
  direction: "over" | "under"
  sport: string
  result: string
  parlay_created_at: string // ISO timestamp of when the parlay was created
}

interface SettlementResult {
  legsChecked: number
  legsSettled: number
  parlaysResolved: number
  parlaysExpired: number
  errors: number
  /**
   * Set when settlement could not run because a required schema object is
   * missing (e.g. the `20250531_add_result_to_parlay_legs.sql` migration was
   * never applied). Lets the cron report the problem instead of 500ing.
   */
  skipped?: string
}

/**
 * True when a Postgres/PostgREST error means a required column or table for
 * settlement is missing — i.e. the settlement migration hasn't been applied.
 * `42703` = undefined_column, `42P01` = undefined_table. PostgREST also
 * surfaces schema-cache misses as `PGRST204`/`PGRST205` with a message that
 * mentions the missing column/relation.
 */
function isMissingSchema(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === "42703" || error.code === "42P01") return true
  if (error.code === "PGRST204" || error.code === "PGRST205") return true
  const msg = error.message?.toLowerCase() ?? ""
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find") ||
    msg.includes("relation") ||
    msg.includes("column")
  )
}

// ─── Stat Category Mapping ──────────────────────────────────────────────────

// Maps user-facing stat categories to database column names
const NBA_STAT_MAP: Record<string, string> = {
  // Standard keys (from props/constants.ts)
  points: "pts",
  pts: "pts",
  rebounds: "trb",
  reb: "trb",
  trb: "trb",
  assists: "ast",
  ast: "ast",
  steals: "stl",
  stl: "stl",
  blocks: "blk",
  blk: "blk",
  "3pm": "tp",
  "3-pointers": "tp",
  threes: "tp",
  tp: "tp",
  turnovers: "tov",
  tov: "tov",
  "field goals": "fg",
  fg: "fg",
  fga: "fga",
  "free throws": "ft",
  ft: "ft",
  fta: "fta",
  // Combos (computed from multiple columns)
  pra: "pra",
  "pts+reb+ast": "pra",
  "points+rebounds+assists": "pra",
  pa: "pa",
  "pts+ast": "pa",
  pr: "pr",
  "pts+reb": "pr",
  ra: "ra",
  "reb+ast": "ra",
}

// ─── Main Settlement Function ───────────────────────────────────────────────

/**
 * Settles all pending parlay legs that have available game results.
 * Then resolves any parlays where all legs are now settled.
 * Also expires stale parlays (older than 5 days with no stats found).
 */
export async function settleParlayLegs(): Promise<SettlementResult> {
  const supabase = createAdminClient()
  const result: SettlementResult = {
    legsChecked: 0,
    legsSettled: 0,
    parlaysResolved: 0,
    parlaysExpired: 0,
    errors: 0,
  }

  // 1. Fetch pending legs with parlay created_at for date-based filtering
  const { data: pendingLegs, error: legsError } = await supabase
    .from("parlay_legs")
    .select(`
      id, parlay_id, player_name, stat_category, prop_line,
      direction, sport, result,
      parlays!inner(created_at)
    `)
    .eq("result", "pending")
    // Only sports we can settle; unsettleable legs (left to expire) must not
    // fill the batch and starve these.
    .in("sport", ["NBA", "Tennis"])
    // Oldest bets first: each run settles or expires the front of the queue,
    // so newer legs can't sit behind an arbitrary unordered 500.
    .order("parlays(created_at)", { ascending: true })
    .limit(500)

  if (legsError) {
    if (isMissingSchema(legsError)) {
      // The `parlay_legs.result`/`game_id` columns (or the table itself) don't
      // exist yet — the settlement migration hasn't been applied. Don't throw:
      // report it so the cron logs a clear reason instead of returning 500 and
      // silently leaving every bet unsettled.
      const reason =
        "parlay_legs settlement schema missing — apply migration " +
        "20250531_add_result_to_parlay_legs.sql (result/game_id columns)"
      console.error(`[settlement] ${reason}. Underlying error: ${legsError.message}`)
      return { ...result, skipped: reason }
    }
    throw new Error(`Failed to fetch pending legs: ${legsError.message}`)
  }

  if (!pendingLegs || pendingLegs.length === 0) {
    return { ...result, parlaysExpired: await expireStaleParlays(supabase) }
  }

  // Reshape: extract parlay_created_at from the join
  const legs: PendingLeg[] = pendingLegs.map((row: Record<string, unknown>) => {
    const parlays = row.parlays as { created_at: string } | null
    return {
      id: row.id as string,
      parlay_id: row.parlay_id as string,
      player_name: row.player_name as string,
      stat_category: row.stat_category as string,
      prop_line: Number(row.prop_line),
      direction: row.direction as "over" | "under",
      sport: row.sport as string,
      result: row.result as string,
      parlay_created_at: parlays?.created_at ?? "",
    }
  })

  result.legsChecked = legs.length

  // 2. Group legs by sport for batch processing
  const nbaLegs = legs.filter((l) => l.sport === "NBA")
  const tennisLegs = legs.filter((l) => l.sport === "Tennis")

  // 3. Settle NBA legs
  if (nbaLegs.length > 0) {
    const settled = await settleNBALegs(supabase, nbaLegs)
    result.legsSettled += settled.settled
    result.errors += settled.errors
  }

  // 4. Settle Tennis legs
  if (tennisLegs.length > 0) {
    const settled = await settleTennisLegs(supabase, tennisLegs)
    result.legsSettled += settled.settled
    result.errors += settled.errors
  }

  // 5. Resolve parlays where all legs are now settled
  const parlayIds = [...new Set(legs.map((l) => l.parlay_id))]
  const resolved = await resolveParlays(supabase, parlayIds)
  result.parlaysResolved = resolved

  // 6. Expire stale parlays (older than 5 days, still pending, no stats found)
  const expired = await expireStaleParlays(supabase)
  result.parlaysExpired = expired

  return result
}

// ─── NBA Settlement ─────────────────────────────────────────────────────────

// nba_player_stats.game_id is a UUID FK; the date lives on nba_games.
const NBA_STAT_COLUMNS =
  "game_id, pts, trb, ast, tp, stl, blk, tov, fg, fga, ft, fta, nba_games!inner(game_date, home_team)"
type NbaStatRow = Record<string, unknown> & { game_id: string; nba_games: { game_date: string; home_team: string } }

/** YYYY-MM-DD of an instant in US Eastern time — the calendar nba_games.game_date uses. */
export function easternDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(iso))
}

/** over/under against the line; equal is a push. */
export function legOutcome(actual: number, line: number, direction: "over" | "under"): "won" | "lost" | "push" {
  if (actual === line) return "push"
  return (direction === "over" ? actual > line : actual < line) ? "won" : "lost"
}

/** Team nickname ("Lakers"): unique in the NBA and identical in ESPN and nba_games. */
const nick = (team: string) => team.trim().split(/\s+/).pop() ?? ""

/** ESPN tip-off times (ms) keyed `YYYY-MM-DD|home nickname`, for the given days. */
async function nbaTipOffs(days: string[]): Promise<Map<string, number>> {
  const tips = new Map<string, number>()
  const boards = await Promise.all(
    days.map((d) => fetchESPNLeague("basketball/nba", d.replace(/-/g, "")).catch(() => []))
  )
  days.forEach((d, i) => {
    for (const m of boards[i]) if (m.startTime) tips.set(`${d}|${nick(m.homeTeam)}`, Date.parse(m.startTime))
  })
  return tips
}

/**
 * A leg settles against the player's FIRST game that tipped off after the
 * parlay was created. A game on the creation day (US Eastern) counts only if
 * it tipped off later; if it already started, the next game counts; if its
 * tip-off is unknown the leg waits (and eventually expires void). There is no
 * fallback to an earlier game: that let users bet on games already played.
 */
async function settleNBALegs(
  supabase: ReturnType<typeof createAdminClient>,
  legs: PendingLeg[]
): Promise<{ settled: number; errors: number }> {
  let settled = 0
  let errors = 0

  // First games per (player, creation day): a later one is used when the first
  // tipped off before the bet (4 rows tolerate duplicated stats rows). One small indexed-range query each; a
  // single `.in(players).limit(n)` truncated at PostgREST's row cap.
  const keyOf = (l: PendingLeg) => `${l.player_name}|${easternDay(l.parlay_created_at)}`
  const keys = [...new Set(legs.filter((l) => l.parlay_created_at).map(keyOf))]
  const nextGames = new Map<string, NbaStatRow[]>()
  for (let i = 0; i < keys.length; i += 20) {
    await Promise.all(
      keys.slice(i, i + 20).map(async (key) => {
        const [name, day] = key.split("|")
        const { data, error } = await supabase
          .from("nba_player_stats")
          .select(NBA_STAT_COLUMNS)
          .eq("player_name", name)
          .gte("nba_games.game_date", day)
          .order("nba_games(game_date)", { ascending: true })
          .limit(4)
        if (error) errors++
        else if (data?.length) nextGames.set(key, data as unknown as NbaStatRow[])
      })
    )
  }

  const sameDays = [...nextGames.entries()]
    .filter(([key, rows]) => rows[0].nba_games.game_date === key.split("|")[1])
    .map(([key]) => key.split("|")[1])
  const tipOffs = await nbaTipOffs([...new Set(sameDays)])

  for (const leg of legs) {
    if (!leg.parlay_created_at) continue
    const rows = nextGames.get(keyOf(leg))
    const statKey = NBA_STAT_MAP[leg.stat_category.toLowerCase()]
    if (!rows || !statKey) continue

    let game: NbaStatRow | undefined = rows[0]
    if (game.nba_games.game_date === easternDay(leg.parlay_created_at)) {
      const tip = tipOffs.get(`${game.nba_games.game_date}|${nick(game.nba_games.home_team)}`)
      if (tip === undefined) continue
      // Already started: the next game on a LATER day (duplicate stats rows for
      // tonight's game must not count as "next").
      if (tip <= Date.parse(leg.parlay_created_at)) game = rows.find((r) => r.nba_games.game_date > game!.nba_games.game_date)
      if (!game) continue
    }
    const stats: NbaStatRow = game

    const v = (k: string) => Number(stats[k]) || 0
    const combos: Record<string, string[]> = { pra: ["pts", "trb", "ast"], pa: ["pts", "ast"], pr: ["pts", "trb"], ra: ["trb", "ast"] }
    const actualValue = (combos[statKey] ?? [statKey]).reduce((sum, k) => sum + v(k), 0)

    const { error: updateError } = await supabase
      .from("parlay_legs")
      .update({ result: legOutcome(actualValue, leg.prop_line, leg.direction), game_id: stats.game_id })
      .eq("id", leg.id)
      .eq("result", "pending") // the cron and the queue job can overlap

    if (updateError) errors++
    else settled++
  }

  return { settled, errors }
}

// ─── Tennis Settlement ──────────────────────────────────────────────────────

async function settleTennisLegs(
  supabase: ReturnType<typeof createAdminClient>,
  legs: PendingLeg[]
): Promise<{ settled: number; errors: number }> {
  let settled = 0
  let errors = 0

  // Tennis settlement checks tennis_serve_stats for per-match stats
  for (const leg of legs) {
    // Try to find serve stats for this player after the parlay was created
    const parlayDate = leg.parlay_created_at
      ? new Date(leg.parlay_created_at).toISOString()
      : null

    let query = supabase
      .from("tennis_serve_stats")
      .select("player_name, aces, double_faults, first_serve_pct, games_won, games_lost, sets_won, sets_lost, created_at")
      .ilike("player_name", leg.player_name.replace(/[\\%_]/g, "\\$&")) // literal, not a pattern
      .order("created_at", { ascending: true }) // first match after the bet
      .limit(1)

    if (parlayDate) {
      query = query.gte("created_at", parlayDate)
    }

    const { data: serveStats, error: serveError } = await query

    if (serveError || !serveStats || serveStats.length === 0) {
      // No serve stats available — skip this leg
      continue
    }

    const stat = serveStats[0]
    const category = leg.stat_category.toLowerCase()

    // 0 is a real value ("under 2.5 aces" with 0 aces wins); only missing is skipped.
    const columns = ["aces", "double_faults", "first_serve_pct", "games_won", "sets_won"]
    const raw = columns.includes(category) ? stat[category as keyof typeof stat] : null
    const actualValue = raw === null || raw === undefined ? NaN : Number(raw)
    if (!Number.isFinite(actualValue)) continue

    const { error: updateError } = await supabase
      .from("parlay_legs")
      .update({ result: legOutcome(actualValue, leg.prop_line, leg.direction) })
      .eq("id", leg.id)
      .eq("result", "pending")

    if (updateError) errors++
    else settled++
  }

  return { settled, errors }
}

// ─── Parlay Resolution ──────────────────────────────────────────────────────

/**
 * Parlay outcome from its leg results (null = not decided yet).
 * - any leg lost → lost
 * - otherwise pushed legs drop out: any won → won, all push → void
 * - unsettled legs: wait, or void once the parlay has expired. A leg we can't
 *   settle (unsupported sport/stat, player never played) used to become a push
 *   and the parlay a free win.
 * `void` is excluded from win rates (they count won/lost only).
 */
export function parlayOutcome(results: string[], expired = false): "won" | "lost" | "void" | null {
  if (results.includes("lost")) return "lost"
  if (results.includes("pending")) return expired ? "void" : null
  return results.includes("won") ? "won" : "void"
}

/** Results of every leg of the given parlays, by parlay id (chunked `.in()`). */
async function legResultsByParlay(
  supabase: ReturnType<typeof createAdminClient>,
  parlayIds: string[]
): Promise<Map<string, { id: string; result: string }[]> | null> {
  const byParlay = new Map<string, { id: string; result: string }[]>()
  for (let i = 0; i < parlayIds.length; i += 100) {
    // Paged: a plain .in() stops at 1000 rows, and a dropped `lost` leg (legacy
    // parlays can exceed the 10-leg cap) would resolve its parlay `won`.
    let data: { id: string; parlay_id: string; result: string }[]
    try {
      data = await fetchAllIn(supabase, "parlay_legs", "id, parlay_id, result", "parlay_id", parlayIds.slice(i, i + 100))
    } catch {
      return null
    }
    for (const l of data) byParlay.set(l.parlay_id, [...(byParlay.get(l.parlay_id) ?? []), l])
  }
  return byParlay
}

/** Sets each parlay's outcome, one guarded update per outcome; returns how many. */
async function finishParlays(
  supabase: ReturnType<typeof createAdminClient>,
  outcomes: Map<string, "won" | "lost" | "void" | null>
): Promise<number> {
  let finished = 0
  for (const status of ["won", "lost", "void"] as const) {
    const ids = [...outcomes].filter(([, o]) => o === status).map(([id]) => id)
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabase
        .from("parlays")
        .update({ status, resolved_at: new Date().toISOString() })
        .in("id", ids.slice(i, i + 100))
        .eq("status", "pending") // Only update if still pending (idempotent)
        .select("id")
      if (error) console.error(`[settlement] parlays ${status} update failed:`, error.message)
      finished += data?.length ?? 0 // rows the pending guard actually matched
    }
  }
  return finished
}

/** Resolves the given parlays whose legs are all settled. */
async function resolveParlays(
  supabase: ReturnType<typeof createAdminClient>,
  parlayIds: string[]
): Promise<number> {
  const byParlay = await legResultsByParlay(supabase, parlayIds)
  if (!byParlay) return 0
  const outcomes = new Map([...byParlay].map(([id, legs]) => [id, parlayOutcome(legs.map((l) => l.result))]))
  return finishParlays(supabase, outcomes)
}

// ─── Stale Parlay Expiry ────────────────────────────────────────────────────

/**
 * Expires parlays older than 5 days that still have pending legs (stats never
 * found, or a leg type with no auto-settlement). Unsettled legs become `push`;
 * the parlay is lost if a settled leg lost, otherwise void.
 */
async function expireStaleParlays(
  supabase: ReturnType<typeof createAdminClient>
): Promise<number> {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  const { data: staleParlays, error } = await supabase
    .from("parlays")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", fiveDaysAgo)
    .limit(100)

  if (error || !staleParlays || staleParlays.length === 0) return 0
  const ids = staleParlays.map((p) => p.id as string)
  const byParlay = await legResultsByParlay(supabase, ids)
  if (!byParlay) return 0
  const pendingIds = [...byParlay.values()].flat().filter((l) => l.result === "pending").map((l) => l.id)
  for (let i = 0; i < pendingIds.length; i += 100) {
    const { error: pushError } = await supabase
      .from("parlay_legs")
      .update({ result: "push" })
      .in("id", pendingIds.slice(i, i + 100))
      .eq("result", "pending")
    if (pushError) return 0
  }
  // No legs → void, never pending forever.
  const outcomes = new Map(ids.map((id) => [id, parlayOutcome((byParlay.get(id) ?? []).map((l) => l.result), true)]))
  return finishParlays(supabase, outcomes)
}
