/**
 * POST /api/jobs/player-of-week
 *
 * Computes Player of the Week over a rolling 7-day window and upserts the
 * winner into nba_player_of_week.
 *
 * Auth: Authorization: Bearer CRON_SECRET (shared with the other cron jobs),
 * or x-rankings-secret: RANKINGS_JOB_SECRET. Dev allows unsecured calls.
 *
 * Body (all optional):
 *   { "window_end": "2026-01-15", "season": "2025-26", "dry_run": false }
 *
 * GET /api/jobs/player-of-week?limit=10  → most recent computed winners.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runPlayerOfWeek } from "@/lib/rankings/potw/pipeline"

function isAuthorized(request: NextRequest): boolean {
  const rankingsSecret = process.env.RANKINGS_JOB_SECRET
  const cronSecret = process.env.CRON_SECRET

  if (rankingsSecret) {
    const header = request.headers.get("x-rankings-secret")
    const query = request.nextUrl.searchParams.get("secret")
    if (header === rankingsSecret || query === rankingsSecret) return true
  }
  if (cronSecret) {
    if (request.headers.get("authorization") === `Bearer ${cronSecret}`) return true
  }
  if (!rankingsSecret && !cronSecret) return process.env.NODE_ENV === "development"
  return false
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    // empty body → defaults
  }

  try {
    const run = await runPlayerOfWeek({
      windowEnd: body.window_end,
      season: body.season,
      dryRun: body.dry_run === true,
    })

    if (run.error) {
      return NextResponse.json({ success: false, ...run }, { status: 500 })
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
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limit = Math.min(50, Number(request.nextUrl.searchParams.get("limit")) || 10)
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("nba_player_of_week")
    .select("window_start, window_end, season, conference, player_name, team, potw_score, pts_per_g, trb_per_g, ast_per_g, ts_pct, headline, runners_up")
    .eq("conference", "ALL")
    .order("window_end", { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ players_of_week: data ?? [] })
}
