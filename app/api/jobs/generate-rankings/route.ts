/**
 * POST /api/jobs/generate-rankings
 *
 * Triggers the NBA ranking pipeline for a given season.
 * Protected by RANKINGS_JOB_SECRET header (set in env).
 *
 * Request body (JSON):
 *   {
 *     "season": "2026-27",        // optional, default: "2026-27"
 *     "historical_season": "2025-26", // optional
 *     "version": "2026-27-v1",    // optional, auto-generated if omitted
 *     "is_projection": true,      // optional, default: true
 *     "dry_run": false,           // optional, default: false
 *     "include_historical": false  // if true, ALSO runs 2025-26 historical first
 *   }
 *
 * GET /api/jobs/generate-rankings?secret=xxx
 *   Returns status of most recent pipeline run for the given season.
 */

import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { runRankingPipeline, runHistoricalSeasonRankings, runProjectionRankings } from "@/lib/rankings/pipeline"
import { buildDefaultConfig } from "@/lib/rankings/config"

function isAuthorized(request: NextRequest): boolean {
  const rankingsSecret = process.env.RANKINGS_JOB_SECRET
  const cronSecret = process.env.CRON_SECRET

  // Accept the dedicated rankings secret via header or query...
  if (rankingsSecret) {
    const authHeader = request.headers.get("x-rankings-secret")
    const querySecret = request.nextUrl.searchParams.get("secret")
    if (authHeader === rankingsSecret || querySecret === rankingsSecret) return true
  }

  // ...or the shared cron secret via Bearer token, so the daily GitHub Actions
  // cron can reuse the same CRON_SECRET as the other scheduled jobs.
  if (cronSecret) {
    const bearer = request.headers.get("authorization")
    if (bearer === `Bearer ${cronSecret}`) return true
  }

  // If NO secret is configured at all, only allow in development.
  if (!rankingsSecret && !cronSecret) {
    return process.env.NODE_ENV === "development"
  }

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
    // Empty body is fine — use defaults
  }

  const season = body.season ?? "2026-27"
  const historicalSeason = body.historical_season ?? "2025-26"
  const version = body.version ?? `${season}-v${new Date().getTime()}`
  const isProjection = body.is_projection !== false  // default true
  const dryRun = body.dry_run === true
  const includeHistorical = body.include_historical === true

  const results: any[] = []

  try {
    // Step 1: Optionally run historical 2025-26 first (seed pass)
    if (includeHistorical) {
      console.log("[jobs/generate-rankings] Running historical 2025-26 rankings...")
      const historicalResult = await runHistoricalSeasonRankings(historicalSeason, {
        dryRun,
        version: `${historicalSeason}-v1`,
      })
      results.push({ type: "historical", ...historicalResult })

      if (historicalResult.errors.length > 0) {
        return NextResponse.json({
          success: false,
          error: "Historical ranking failed — aborting",
          results,
        }, { status: 500 })
      }
    }

    // Step 2: Run the main projection/historical ranking
    const config = buildDefaultConfig(season, historicalSeason, version, isProjection ? "projected" : "historical", dryRun)
    console.log(`[jobs/generate-rankings] Running ${isProjection ? "projection" : "historical"} ranking for ${season}...`)
    const mainResult = await runRankingPipeline(config)
    results.push({ type: isProjection ? "projection" : "historical", ...mainResult })

    const hasErrors = results.some((r) => r.errors?.length > 0)
    const allWarnings = results.flatMap((r) => r.warnings ?? [])

    return NextResponse.json({
      success: !hasErrors,
      season,
      ranking_version: version,
      dry_run: dryRun,
      results,
      warnings: allWarnings,
      summary: {
        player_rankings_computed: mainResult.player_rankings_computed,
        team_rankings_computed: mainResult.team_rankings_computed,
        duration_ms: mainResult.duration_ms,
        errors: mainResult.errors,
      },
    }, { status: hasErrors ? 500 : 200 })

  } catch (err) {
    console.error("[jobs/generate-rankings] Fatal error:", err)
    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message,
        results,
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const season = request.nextUrl.searchParams.get("season") ?? "2026-27"
  const supabase = createAdminClient()

  // Return the most recent ranking versions for this season
  const { data: versions, error } = await supabase
    .from("nba_ranking_versions")
    .select("ranking_version, status, generated_at, published_at, player_count, team_count, algorithm_version, notes")
    .eq("season", season)
    .order("generated_at", { ascending: false })
    .limit(5)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    season,
    versions: versions ?? [],
  })
}
