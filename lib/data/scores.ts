import "server-only"

import { fetchLiveScores } from "@/lib/services/sportsApi"
import { fetchESPNScores } from "@/lib/services/espn"
import { cached, CACHE_TTL } from "@/lib/cache"
import { getMatchesWithFreshness, upsertMatches } from "@/lib/services/matchStorage"
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

export function getTodayYYYYMMDD(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
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

  const { matches: dbMatches, isFresh, hasLive } = await getMatchesWithFreshness(date)

  if (isFresh && dbMatches.length > 0) {
    scores = dbMatches
    source = "db"
  } else {
    const isToday = date === getTodayYYYYMMDD()

    if (isToday) {
      scores = await cached(
        `scores:espn:${date}`,
        () => fetchLiveScores(),
        CACHE_TTL.scores
      )
    } else {
      scores = await cached(
        `scores:espn:${date}`,
        () => fetchESPNScores(date),
        60_000
      )
    }

    source = "espn_cached"

    if (scores.length > 0) {
      // Fire-and-forget; don't block the response on persistence.
      upsertMatches(scores, "espn", date).catch(() => {})
    }

    if (scores.length === 0 && dbMatches.length > 0) {
      scores = dbMatches
      source = "db"
    }
  }

  // Sport filter
  let filtered = scores
  if (sportFilter && sportFilter !== "All") {
    const matched = SUPPORTED_SPORTS.find(
      (s) => s.toLowerCase() === sportFilter.toLowerCase()
    )
    if (!matched || matched === "All") {
      filtered = []
    } else {
      filtered = scores.filter(
        (m) => m.sport.toLowerCase() === matched.toLowerCase()
      )
    }
  }

  return {
    data: filtered,
    meta: { date, source, hasLive },
  }
}
