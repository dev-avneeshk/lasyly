/**
 * POST /api/jobs/generate-nfl-rankings
 *
 * Recomputes the daily NFL player rankings from nfl_player_stats box scores and
 * upserts them into nfl_player_rankings under a fixed version (default
 * `nfl-<season>-v1`). Idempotent — daily runs overwrite in place.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` or
 *       `x-rankings-secret: <RANKINGS_JOB_SECRET>` (see lib/security/cronAuth).
 *
 * Request body (JSON, all optional):
 *   { "season": "2026", "version": "nfl-2026-v1", "dry_run": false }
 *
 * GET /api/jobs/generate-nfl-rankings?season=2026
 *   Returns the recent NFL ranking versions.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { runDailyNflRankings } from "@/lib/rankings/nfl/pipeline"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { invalidateCachePrefix } from "@/lib/cache"

const CRON_OPTS = { altSecretEnv: "RANKINGS_JOB_SECRET" } as const

const seasonSchema = z.string().regex(/^\d{4}$/, 'NFL season must be a 4-digit year, e.g. "2026".')

const bodySchema = z.object({
  season: seasonSchema.optional(),
  version: z.string().max(64).optional(),
  dry_run: z.boolean().optional(),
})

export const POST = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request, CRON_OPTS)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const raw = await request.json().catch(() => ({}))
  const [body, validationError] = validateRequestBody(raw, bodySchema)
  if (validationError) return validationError

  const season = body.season ?? String(new Date().getUTCFullYear())
  const version = body.version ?? `nfl-${season}-v1`
  const dryRun = body.dry_run === true

  try {
    console.log(`[jobs/generate-nfl-rankings] season=${season} version=${version} dry=${dryRun}`)
    const result = await runDailyNflRankings({ season, version, dryRun })

    const hasErrors = result.errors.length > 0

    // Bust the rankings cache so fresh ranks are served immediately.
    if (!dryRun && !hasErrors) {
      await invalidateCachePrefix("rankings:nfl:")
    }

    return NextResponse.json(
      {
        success: !hasErrors,
        season,
        ranking_version: version,
        dry_run: dryRun,
        summary: {
          player_rankings_computed: result.player_rankings_computed,
          duration_ms: result.duration_ms,
          warnings: result.warnings,
          errors: result.errors,
        },
      },
      { status: hasErrors ? 500 : 200 }
    )
  } catch (err) {
    console.error("[jobs/generate-nfl-rankings] Fatal:", err)
    return NextResponse.json({ success: false, error: "NFL ranking pipeline failed" }, { status: 500 })
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

export const GET = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request, CRON_OPTS)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const seasonParam = searchParams.get("season") ?? String(new Date().getUTCFullYear())
  const parsed = seasonSchema.safeParse(seasonParam)
  if (!parsed.success) {
    return NextResponse.json({ error: 'NFL season must be a 4-digit year.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: versions, error } = await supabase
    .from("nfl_ranking_versions")
    .select("ranking_version, status, generated_at, published_at, player_count, algorithm_version, notes")
    .eq("season", parsed.data)
    .order("generated_at", { ascending: false })
    .limit(5)

  if (error) {
    console.error("[jobs/generate-nfl-rankings] version read failed:", error.message)
    return NextResponse.json({ error: "Failed to read NFL ranking versions." }, { status: 500 })
  }

  return NextResponse.json({ season: parsed.data, versions: versions ?? [] })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
