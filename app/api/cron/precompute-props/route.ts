/**
 * Precompute Props Cron Job
 *
 * Runs the props engines for the DEFAULT NBA + NFL slates and stores the
 * finished results in `computed_props`, turning the app's most expensive
 * read-time compute into a scheduled write. The /api/props endpoint reads these
 * rows instead of recomputing, falling back to live compute only for slates
 * this job doesn't cover (custom filters, search, non-default stats) or when a
 * row is missing/stale.
 *
 * What it precomputes (exactly the default slate the Props page and keep-warm
 * cron request — sport with stat=all, direction=all):
 *   - NBA: the six per-stat MatchupScopedResults (pts, trb, ast, tp, stl, blk)
 *   - NFL: the four per-stat NFLPropsResults (YDS, TD, REC, CAR)
 * Each is stored as the per-stat results ARRAY, i.e. the exact value the
 * endpoint used to wrap in `cached(...)`, so the read path is a drop-in swap and
 * all downstream filtering/sorting/headshot logic stays identical.
 *
 * Authorization: requires CRON_SECRET in the Authorization header.
 */
import { NextResponse } from "next/server"
import { computeNFLProps } from "@/lib/analytics/engine-nfl"
import { writePrecomputedProps, prunePrecomputedProps } from "@/lib/data/computed-props"
import { precomputeNbaDefaultSlate } from "@/lib/data/precompute-nba"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// This job runs the full slate compute for two sports; give it headroom.
export const maxDuration = 300

/** Default stat set — must match the `stat=all` fan-out in /api/props (NBA's lives in lib/data/precompute-nba.ts). */
const NFL_DEFAULT_STATS = ["YDS", "TD", "REC", "CAR"] as const

/** ET slate date (matches getTodayET in /api/props). */
function getTodayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })
}

export const GET = withSecurity(
  async (request: Request) => {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const startedAt = Date.now()
    const todayDate = getTodayET()
    const written: Record<string, number> = {}
    const errors: string[] = []
    const skipped: string[] = []

    // ─── NBA: default stat=all / direction=all slate ─────────────────────────
    // Shared with /api/cron/ingest-novig-lines (lib/data/precompute-nba.ts).
    const nba = await precomputeNbaDefaultSlate(todayDate)
    if (nba.written !== undefined) written["NBA:all:all"] = nba.written
    if (nba.skipped) skipped.push(nba.skipped)
    if (nba.error) errors.push(nba.error)

    // ─── NFL: default stat=all / direction=all slate ─────────────────────────
    try {
      const nflResults = await Promise.all(
        NFL_DEFAULT_STATS.map((s) =>
          computeNFLProps(s, todayDate, {
            direction: "all",
            search: "",
            limit: 200,
          })
        )
      )
      const nflCount = nflResults.reduce((n, r) => n + r.props.length, 0)
      if (nflCount === 0) {
        skipped.push("NFL:all:all (engine returned 0 props — no slate in the window)")
      } else {
        const ok = await writePrecomputedProps("NFL", "all", "all", todayDate, nflCount, nflResults)
        if (ok) written["NFL:all:all"] = nflCount
        else errors.push("NFL write failed")
      }
    } catch (e) {
      errors.push(`NFL compute failed: ${e instanceof Error ? e.message : String(e)}`)
    }

    // ─── Prune old slates (never wipes today's) ──────────────────────────────
    let pruned = 0
    try {
      pruned = await prunePrecomputedProps(3)
    } catch (e) {
      errors.push(`prune failed: ${e instanceof Error ? e.message : String(e)}`)
    }

    return NextResponse.json({
      success: errors.length === 0,
      date: todayDate,
      written,
      skipped,
      pruned,
      errors,
      durationMs: Date.now() - startedAt,
    })
  },
  { cacheControl: CACHE_CONTROL.SENSITIVE }
)
