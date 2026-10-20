import "server-only"

/**
 * NBA default-slate precompute (stat=all / direction=all), shared by
 * /api/cron/precompute-props (every 3h) and /api/cron/ingest-novig-lines (right
 * after new Novig lines land, so the props page picks them up immediately).
 */
import { computeMatchupScopedProps } from "@/lib/analytics/engine-v2"
import { writePrecomputedProps } from "@/lib/data/computed-props"

/** Default stat set — must match the `stat=all` fan-out in /api/props. */
export const NBA_DEFAULT_STATS = ["pts", "trb", "ast", "tp", "stl", "blk"] as const

/**
 * Computes the six per-stat results and stores them in computed_props.
 * Exactly one of the fields is set: `written` (prop count), `skipped` (reason)
 * or `error` (message).
 */
export async function precomputeNbaDefaultSlate(
  todayDate: string
): Promise<{ written?: number; skipped?: string; error?: string }> {
  // The endpoint computes each stat with direction "over" (it filters
  // over/under downstream from a result that carries both), so we do the same
  // and store the per-stat results array under direction "all".
  try {
    const nbaResults = await Promise.all(
      NBA_DEFAULT_STATS.map((s) =>
        computeMatchupScopedProps("NBA", s, {
          direction: "over",
          todayDate,
        })
      )
    )
    const nbaCount = nbaResults.reduce((n, r) => n + r.props.length, 0)
    // Never store an EMPTY slate. The endpoint treats a precomputed row as
    // authoritative for up to 6 hours, so writing zero props — which is what
    // the engine legitimately returns on an off-day or mid-scrape — would pin
    // the props page to "no props" long after real data was available. Skipping
    // the write leaves the endpoint computing live, which self-corrects.
    if (nbaCount === 0) {
      return { skipped: "NBA:all:all (engine returned 0 props — off-day or no slate)" }
    }
    const ok = await writePrecomputedProps("NBA", "all", "all", todayDate, nbaCount, nbaResults)
    return ok ? { written: nbaCount } : { error: "NBA write failed" }
  } catch (e) {
    return { error: `NBA compute failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}
