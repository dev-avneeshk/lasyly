/**
 * POST /api/jobs/generate-rankings
 *
 * Triggers the NBA ranking pipeline for a given season.
 *
 * Auth: `x-rankings-secret: <RANKINGS_JOB_SECRET>` or
 *       `Authorization: Bearer <CRON_SECRET>`.
 *
 * The previous version also accepted `?secret=…` in the query string and fell
 * back to allowing unsecured calls when NODE_ENV=development. This endpoint
 * rewrites the entire rankings table, so both were removed — see
 * lib/security/cronAuth.ts for the reasoning.
 *
 * Request body (JSON, all optional):
 *   {
 *     "season": "2026-27",
 *     "historical_season": "2025-26",
 *     "version": "2026-27-v1",       // auto-generated if omitted
 *     "is_projection": true,
 *     "dry_run": false,
 *     "include_historical": false     // if true, ALSO runs the historical pass first
 *   }
 *
 * GET /api/jobs/generate-rankings?season=2026-27
 *   Returns status of recent pipeline runs for the given season.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  runRankingPipeline,
  runHistoricalSeasonRankings,
} from "@/lib/rankings/pipeline"
import { buildDefaultConfig } from "@/lib/rankings/config"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const CRON_OPTS = { altSecretEnv: "RANKINGS_JOB_SECRET" } as const

/** Season identifiers look like "2026-27". Bounded so they can't reach a query raw. */
const seasonSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Season must look like "2026-27".')

const bodySchema = z.object({
  season: seasonSchema.optional(),
  historical_season: seasonSchema.optional(),
  version: z.string().max(64).optional(),
  is_projection: z.boolean().optional(),
  dry_run: z.boolean().optional(),
  include_historical: z.boolean().optional(),
})

interface PipelineRunSummary {
  type: string
  errors?: string[]
  warnings?: string[]
  [key: string]: unknown
}

export const POST = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request, CRON_OPTS)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const raw = await request.json().catch(() => ({}))
  const [body, validationError] = validateRequestBody(raw, bodySchema)
  if (validationError) return validationError

  const season = body.season ?? "2026-27"
  const historicalSeason = body.historical_season ?? "2025-26"
  const version = body.version ?? `${season}-v${Date.now()}`
  const isProjection = body.is_projection !== false // default true
  const dryRun = body.dry_run === true
  const includeHistorical = body.include_historical === true

  const results: PipelineRunSummary[] = []

  try {
    // Step 1: Optionally run historical rankings first (seed pass)
    if (includeHistorical) {
      console.log("[jobs/generate-rankings] Running historical rankings...")
      const historicalResult = await runHistoricalSeasonRankings(historicalSeason, {
        dryRun,
        version: `${historicalSeason}-v1`,
      })
      results.push({ type: "historical", ...historicalResult })

      if (historicalResult.errors.length > 0) {
        console.error(
          "[jobs/generate-rankings] historical pass failed:",
          historicalResult.errors
        )
        return NextResponse.json(
          { success: false, error: "Historical ranking failed — aborting" },
          { status: 500 }
        )
      }
    }

    // Step 2: Run the main projection/historical ranking
    const config = buildDefaultConfig(
      season,
      historicalSeason,
      version,
      isProjection ? "projected" : "historical",
      dryRun
    )
    console.log(
      `[jobs/generate-rankings] Running ${isProjection ? "projection" : "historical"} ranking for ${season}...`
    )
    const mainResult = await runRankingPipeline(config)
    results.push({ type: isProjection ? "projection" : "historical", ...mainResult })

    const hasErrors = results.some((r) => (r.errors?.length ?? 0) > 0)
    const allWarnings = results.flatMap((r) => r.warnings ?? [])

    return NextResponse.json(
      {
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
      },
      { status: hasErrors ? 500 : 200 }
    )
  } catch (err) {
    // Detail to the log only: pipeline failures surface Supabase errors with
    // table and column names.
    console.error("[jobs/generate-rankings] Fatal error:", err)
    return NextResponse.json(
      { success: false, error: "Ranking pipeline failed" },
      { status: 500 }
    )
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

export const GET = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request, CRON_OPTS)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const seasonParam = searchParams.get("season") ?? "2026-27"
  const parsedSeason = seasonSchema.safeParse(seasonParam)
  if (!parsedSeason.success) {
    return NextResponse.json(
      { error: 'Season must look like "2026-27".' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data: versions, error } = await supabase
    .from("nba_ranking_versions")
    .select(
      "ranking_version, status, generated_at, published_at, player_count, team_count, algorithm_version, notes"
    )
    .eq("season", parsedSeason.data)
    .order("generated_at", { ascending: false })
    .limit(5)

  if (error) {
    console.error("[jobs/generate-rankings] version read failed:", error.message)
    return NextResponse.json({ error: "Failed to read ranking versions." }, { status: 500 })
  }

  return NextResponse.json({
    season: parsedSeason.data,
    versions: versions ?? [],
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
