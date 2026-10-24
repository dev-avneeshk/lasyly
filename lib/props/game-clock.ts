/**
 * Tip-off times and live status for an NBA slate.
 *
 * nba_games only stores a calendar date and is marked 'completed' when the
 * box score is scraped (often the next morning), so it cannot say when a game
 * started. The ESPN-fed `matches` table (refreshed every ~10 minutes, and on
 * demand by /api/scores) carries the real start time and live status.
 *
 * Server only (admin client).
 */

import { cached } from "@/lib/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { TEAM_NAME_TO_ABBR, fetchTodayGames } from "@/lib/analytics/engine-v2"
import { getTodayET } from "./dates"
import { hasGameStarted, type GameState } from "./game-lock"

export interface SlateGameClock {
  startTime: string | null
  status: GameState
}

/** Short TTL: this is what flips a game to "live". */
const CLOCK_TTL_MS = 60_000

/** ESPN spellings that differ from nba_games. */
const EXTRA_NAMES: Record<string, string> = {
  "LA Clippers": "LAC",
  "LA Lakers": "LAL",
}

function teamAbbr(name: string): string | null {
  return TEAM_NAME_TO_ABBR[name] ?? EXTRA_NAMES[name] ?? null
}

/** `YYYY-MM-DD` of an instant in US Eastern time (the calendar nba_games uses). */
export function easternDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(iso))
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function mapMatchStatus(raw: string | null | undefined): GameState {
  const s = (raw ?? "").toLowerCase()
  if (s === "finished" || s === "final" || s === "completed" || s === "full_time" || s === "ft") return "final"
  if (!s || s === "not started" || s === "scheduled" || s === "pre") return "scheduled"
  if (s === "postponed" || s === "canceled" || s === "cancelled") return "scheduled"
  // "In Progress", "Halftime", "End of 3rd", ...
  return "live"
}

async function fetchClockUncached(date: string): Promise<Record<string, SlateGameClock>> {
  // matches.match_date is the UTC day of tip-off, so an evening ET game can
  // sit on the next UTC day. Read both and keep the ones on this ET date.
  const { data, error } = await createAdminClient()
    .from("matches")
    .select("home_team, away_team, status, start_time")
    .eq("league", "NBA")
    .in("match_date", [date, shiftDate(date, 1)])
  if (error) throw new Error(`matches read failed: ${error.message}`)

  const out: Record<string, SlateGameClock> = {}
  for (const row of (data ?? []) as { home_team: string; status: string | null; start_time: string | null }[]) {
    if (!row.start_time || easternDate(row.start_time) !== date) continue
    const home = teamAbbr(row.home_team)
    if (!home) continue
    out[home] = { startTime: row.start_time, status: mapMatchStatus(row.status) }
  }
  return out
}

/**
 * Tip-off and status per HOME team abbreviation for an ET date. Empty on any
 * error: callers then fall back to nba_games' status, and the client still
 * locks every non-today slate.
 */
export async function getNbaSlateClock(date: string): Promise<Record<string, SlateGameClock>> {
  try {
    return await cached(`nba-slate-clock:v1:${date}`, () => fetchClockUncached(date), CLOCK_TTL_MS)
  } catch (e) {
    console.warn("[game-clock] lookup failed:", e instanceof Error ? e.message : String(e))
    return {}
  }
}

/** Today's (ET) game state per team abbreviation, both sides of each game. */
async function todayGameStateByTeam(): Promise<Map<string, { startTime: string | null; status: GameState }>> {
  const today = getTodayET()
  const [games, clock] = await Promise.all([fetchTodayGames(today, { includeFinished: true }), getNbaSlateClock(today)])
  const byTeam = new Map<string, { startTime: string | null; status: GameState }>()
  for (const g of games) {
    const c = clock[g.homeTeam]
    const state = {
      startTime: c?.startTime ?? null,
      status: g.status === "final" ? ("final" as const) : (c?.status ?? g.status),
    }
    byTeam.set(g.homeTeam, state)
    byTeam.set(g.awayTeam, state)
  }
  return byTeam
}

/**
 * NBA players (from `names`) whose game today has already tipped off, for
 * rejecting new predictions on them. A player with no game today is open: his
 * pick settles against his next game.
 *
 * Fails open (returns []) on lookup errors. That is safe because settlement
 * never counts a game that started before the pick was made
 * (lib/parlays/settlement.ts); this check exists to give a clear error
 * instead of a pick silently rolling over to the next game.
 */
export async function startedNbaPlayers(names: readonly string[], nowMs: number = Date.now()): Promise<string[]> {
  const unique = [...new Set(names.filter(Boolean))]
  if (unique.length === 0) return []
  try {
    const byTeam = await todayGameStateByTeam()
    if (byTeam.size === 0) return []
    const supabase = createAdminClient()
    const started = await Promise.all(
      unique.map(async (name) => {
        const { data } = await supabase
          .from("nba_player_stats")
          .select("team, nba_games!inner(game_date)")
          .eq("player_name", name)
          .order("nba_games(game_date)", { ascending: false })
          .limit(1)
        const team = (data?.[0] as { team?: string } | undefined)?.team
        return team && hasGameStarted(byTeam.get(team), nowMs) ? name : null
      })
    )
    return started.filter((n): n is string => n !== null)
  } catch (e) {
    console.warn("[game-clock] started-player check failed:", e instanceof Error ? e.message : String(e))
    return []
  }
}
