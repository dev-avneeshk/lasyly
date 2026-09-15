/**
 * POST /api/jobs/player-of-week
 *
 * Computes Player of the Week over a rolling 7-day window and upserts the
 * winner into nba_player_of_week.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` or
 *       `x-rankings-secret: <RANKINGS_JOB_SECRET>`.
 *
 * The previous version also accepted `?secret=…` in the query string and fell
 * back to allowing unsecured calls when NODE_ENV=development. Query strings are
 * written to access logs, proxy logs and Sentry breadcrumbs, and a preview build
 * running with NODE_ENV=development would have been open. Both are gone; see
 * lib/security/cronAuth.ts.
 *
 * Body (all optional):
 *   { "window_end": "2026-01-15", "season": "2025-26", "dry_run": false }
 *
 * GET /api/jobs/player-of-week?limit=10  → most recent computed winners.
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { runPlayerOfWeek } from "@/lib/rankings/potw/pipeline"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const CRON_OPTS = { altSecretEnv: "RANKINGS_JOB_SECRET" } as const

const bodySchema = z.object({
  window_end: z.string().max(32).optional(),
  season: z.string().max(16).optional(),
  dry_run: z.boolean().optional(),
})

export const POST = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request, CRON_OPTS)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const raw = await request.json().catch(() => ({}))
  const [body, validationError] = validateRequestBody(raw, bodySchema)
  if (validationError) return validationError

  try {
    const run = await runPlayerOfWeek({
      windowEnd: body.window_end,
      season: body.season,
      dryRun: body.dry_run === true,
    })

    if (run.error) {
      console.error("[player-of-week] pipeline reported an error:", run.error)
      return NextResponse.json({ success: false, error: "Pipeline failed" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      window: `${run.window_start} → ${run.window_end}`,
      season: run.season,
      players_considered: run.players_considered,
      dry_run: run.dry_run,
      winner: run.result?.winner ?? null,
      headline: run.result?.headline ?? null,
      runners_up: run.result?.runners_up ?? [],
    })
  } catch (err) {
    console.error("[player-of-week] failed:", err)
    return NextResponse.json({ success: false, error: "Pipeline failed" }, { status: 500 })
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

/**
 * Public read of recent winners. This is genuinely public data (it's rendered on
 * the rankings page), but it previously echoed `error.message` straight from
 * Postgres on failure.
 */
export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10))

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("nba_player_of_week")
    .select(
      "window_start, window_end, season, conference, player_name, team, potw_score, pts_per_g, trb_per_g, ast_per_g, ts_pct, headline, runners_up"
    )
    .eq("conference", "ALL")
    .order("window_end", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[player-of-week] read failed:", error.message)
    return NextResponse.json({ error: "Failed to load players of the week." }, { status: 500 })
  }

  return NextResponse.json({ players_of_week: data ?? [] })
}, { cacheControl: CACHE_CONTROL.PUBLIC_LONG })
