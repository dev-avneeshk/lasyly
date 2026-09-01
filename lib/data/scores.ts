import "server-only"

import { fetchLiveScores } from "@/lib/services/sportsApi"
import { fetchESPNScores } from "@/lib/services/espn"
import { cached, CACHE_TTL } from "@/lib/cache"
import { getMatchesWithFreshnessRange, upsertMatches } from "@/lib/services/matchStorage"
import type { LiveMatch } from "@/types"

/**
 * Shared scores data layer.
 *
 * Used by both `app/api/scores/route.ts` and the `(app)/scores` server
 * component, so the SSR path doesn't have to round-trip through its own API.
 */

export const SUPPORTED_SPORTS = [
  "Football",
  "Basketball",
  "American Football",
  "Hockey",
  "Tennis",
  "Baseball",
  "F1",
  "Golf",
  "MMA",
  "Cricket",
  "All",
] as const

export type ScoresSource = "db" | "espn" | "espn_cached"

export type ScoresResult = {
  data: LiveMatch[]
  meta: { date: string; source: ScoresSource; hasLive: boolean }
}

export function isValidYYYYMMDD(date: string): boolean {
  if (!/^\d{8}$/.test(date)) return false
  const year = parseInt(date.slice(0, 4), 10)
  const month = parseInt(date.slice(4, 6), 10)
  const day = parseInt(date.slice(6, 8), 10)
  if (year < 2000 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

/** Shift a YYYYMMDD string by `days` calendar days (UTC), returning YYYYMMDD. */
export function shiftYYYYMMDD(date: string, days: number): string {
  const y = parseInt(date.slice(0, 4), 10)
  const m = parseInt(date.slice(4, 6), 10)
  const d = parseInt(date.slice(6, 8), 10)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`
}

/** De-duplicate matches by id, keeping the first occurrence. */
function dedupeById(matches: LiveMatch[]): LiveMatch[] {
  const seen = new Set<string>()
  const out: LiveMatch[] = []
  for (const m of matches) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    out.push(m)
  }
  return out
}

export function getTodayYYYYMMDD(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
}

/**
 * In-progress match statuses. Matches with any of these are excluded from the
 * scores section — we only surface upcoming ("Not Started") games and results
 * ("Finished"/"Postponed"). Kept in one place so every consumer stays in sync.
 */
const LIVE_STATUSES = new Set([
  "In Progress",
  "Halftime",
  "First Half",
  "Second Half",
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "OT",
])

/** True when a match is currently being played (i.e. not upcoming or a result). */
export function isLiveMatch(match: LiveMatch): boolean {
  return LIVE_STATUSES.has(match.status)
}

/**
 * True when a match has no real team/competitor names. ESPN returns "TBD"
 * placeholders for events that don't fit a two-team head-to-head shape
 * (F1 races, golf tournaments, undrawn bracket slots). These shouldn't render
 * as score cards.
 */
export function isPlaceholderMatch(match: LiveMatch): boolean {
  const home = (match.homeTeam ?? "").trim().toUpperCase()
  const away = (match.awayTeam ?? "").trim().toUpperCase()
  const isBlankOrTBD = (name: string) => name === "" || name === "TBD"
  // Drop only when BOTH sides are missing — a real match always has two names.
  return isBlankOrTBD(home) && isBlankOrTBD(away)
}

/**
 * DB-first scores lookup.
 *
 * 1. Hit Supabase. If the row set is "fresh" per `getMatchesWithFreshness`, return it.
 * 2. Otherwise hit ESPN (cached for a few seconds to batch concurrent callers),
 *    persist to Supabase as a side effect, and return the new set.
 * 3. If ESPN returned nothing but we still have stale DB rows, fall back to those.
 *
 * `sportFilter` accepts any case; "All" or null/undefined returns everything.
 */
export async function getScoresForDate(
  rawDate: string | null | undefined,
  sportFilter?: string | null
): Promise<ScoresResult> {
  const date = rawDate && isValidYYYYMMDD(rawDate) ? rawDate : getTodayYYYYMMDD()

  let scores: LiveMatch[]
  let source: ScoresSource = "db"

  // Read a ±1 day window: `match_date` is a UTC calendar date, but the UI
  // groups by the viewer's LOCAL day, so games that belong on the selected
  // local day may be stored under the neighboring UTC date. The client
  // re-buckets by local time; we just make sure it has the data to do so.
  const { matches: dbMatches, isFresh } = await getMatchesWithFreshnessRange(date)

  if (isFresh && dbMatches.length > 0) {
    scores = dbMatches
    source = "db"
  } else {
    const isToday = date === getTodayYYYYMMDD()
    const prevDate = shiftYYYYMMDD(date, -1)
    const nextDate = shiftYYYYMMDD(date, 1)

    if (isToday) {
      // "today" (live) plus the adjacent UTC days so the local-day window is
      // complete. fetchLiveScores() already covers the current scoreboard.
      const [live, prev, next] = await Promise.all([
        cached(`scores:espn:${date}`, () => fetchLiveScores(), CACHE_TTL.scores),
        cached(`scores:espn:${prevDate}`, () => fetchESPNScores(prevDate), 60_000),
        cached(`scores:espn:${nextDate}`, () => fetchESPNScores(nextDate), 60_000),
      ])
      scores = dedupeById([...live, ...prev, ...next])
    } else {
      const [center, prev, next] = await Promise.all([
        cached(`scores:espn:${date}`, () => fetchESPNScores(date), 60_000),
        cached(`scores:espn:${prevDate}`, () => fetchESPNScores(prevDate), 60_000),
        cached(`scores:espn:${nextDate}`, () => fetchESPNScores(nextDate), 60_000),
      ])
      scores = dedupeById([...center, ...prev, ...next])
    }

    source = "espn_cached"

    if (scores.length > 0) {
      // Fire-and-forget; don't block the response on persistence. Each match
      // is stored under its own UTC match_date (derived from startTime), not
      // the requested `date`, so neighboring-day games are filed correctly.
      upsertMatches(scores, "espn").catch(() => {})
    }

    if (scores.length === 0 && dbMatches.length > 0) {
      scores = dbMatches
      source = "db"
    }
  }

  // Exclude in-progress matches (scores section shows only upcoming games and
  // results) and "TBD vs TBD" placeholder events. Applied for every consumer.
  let filtered = scores.filter((m) => !isLiveMatch(m) && !isPlaceholderMatch(m))

  // Sport filter
  if (sportFilter && sportFilter !== "All") {
    const matched = SUPPORTED_SPORTS.find(
      (s) => s.toLowerCase() === sportFilter.toLowerCase()
    )
    if (!matched || matched === "All") {
      filtered = []
    } else {
      filtered = filtered.filter(
        (m) => m.sport.toLowerCase() === matched.toLowerCase()
      )
    }
  }

  return {
    data: filtered,
    // Live games are never surfaced, so `hasLive` is always false here.
    meta: { date, source, hasLive: false },
  }
}
