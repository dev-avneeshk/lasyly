import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Read/write layer for the `computed_props` materialized read model.
 *
 * The /api/props endpoint used to compute prop slates on every cache miss —
 * dozens of Supabase queries over tens of thousands of rows. The precompute
 * cron (/api/cron/precompute-props) now runs the engines a few times a day and
 * stores the finished result here, keyed by (sport, stat, direction, date), so
 * the endpoint serves a single indexed SELECT and only falls back to live
 * compute when a slate is missing or a request carries custom filters/search.
 *
 * The stored `payload` is whatever the engine returned — an opaque blob to this
 * module. Callers own its shape (see MatchupScopedResult[] / NFLPropsResult[]).
 */

/** Row key: lowercased sport + stat keep it case-insensitive and stable. */
export function computedPropsKey(
  sport: string,
  stat: string,
  direction: string,
  gameDate: string
): string {
  return `${sport.toLowerCase()}:${stat.toLowerCase()}:${direction.toLowerCase()}:${gameDate}`
}

/**
 * Read a precomputed slate. Returns the stored payload (generic — the caller
 * casts to the engine result type it wrote) or null when there's no row for
 * this slate/date, which signals the caller to fall back to live compute.
 *
 * `maxAgeMs` guards against serving a slate whose cron stopped running: a row
 * older than the bound is treated as absent so the endpoint recomputes rather
 * than showing stale data indefinitely.
 */
export async function getPrecomputedProps<T = unknown>(
  sport: string,
  stat: string,
  direction: string,
  gameDate: string,
  maxAgeMs?: number
): Promise<T | null> {
  const supabase = createAdminClient()
  const id = computedPropsKey(sport, stat, direction, gameDate)

  const { data, error } = await supabase
    .from("computed_props")
    .select("payload, computed_at")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) return null

  if (maxAgeMs != null) {
    const age = Date.now() - new Date(data.computed_at as string).getTime()
    if (age > maxAgeMs) return null
  }

  return (data.payload as T) ?? null
}

/**
 * Upsert a precomputed slate. Overwrites the row for this (sport, stat,
 * direction, date) so re-running the cron within a day refreshes in place
 * rather than accumulating duplicates.
 */
export async function writePrecomputedProps(
  sport: string,
  stat: string,
  direction: string,
  gameDate: string,
  propCount: number,
  payload: unknown
): Promise<boolean> {
  const supabase = createAdminClient()
  const id = computedPropsKey(sport, stat, direction, gameDate)

  const { error } = await supabase.from("computed_props").upsert(
    {
      id,
      sport,
      stat,
      direction,
      game_date: gameDate,
      prop_count: propCount,
      payload,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  )

  if (error) {
    console.error(`[computed-props] write failed for ${id}:`, error.message)
    return false
  }
  return true
}

/**
 * Delete slates older than `keepDays` calendar days. Called after a successful
 * precompute run so the table never grows unbounded. Pruning by date (not a
 * full wipe) means a failed run never leaves the table empty — yesterday's
 * slate stays until today's is safely written.
 */
export async function prunePrecomputedProps(keepDays = 3): Promise<number> {
  const supabase = createAdminClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - keepDays)
  const cutoffStr = cutoff.toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("computed_props")
    .delete()
    .lt("game_date", cutoffStr)
    .select("id")

  if (error) {
    console.error("[computed-props] prune failed:", error.message)
    return 0
  }
  return data?.length ?? 0
}
