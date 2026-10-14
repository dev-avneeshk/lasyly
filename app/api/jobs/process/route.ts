/**
 * POST /api/jobs/process
 *
 * Background job processor endpoint. Claims ready jobs from the Redis queue and
 * executes their handlers. Protected by CRON_SECRET (constant-time, header only).
 *
 * Trigger this via:
 * - GitHub Actions cron (every 2 minutes — .github/workflows/process-jobs.yml)
 * - Vercel Cron
 * - Manual POST with Bearer token
 */
import { NextResponse } from "next/server"
import { processJobs } from "@/lib/queue"
import { jobHandlers } from "@/lib/queue/handlers"
import { drainPendingRefunds, sweepAbandonedLobbies } from "@/lib/arena/matchmaking"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

export const POST = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const [summary, lobbiesRefunded, pendingRefunds] = await Promise.all([
      processJobs(jobHandlers),
      // Refund 1v1 stakes for lobbies nobody joined (they were lost before).
      sweepAbandonedLobbies().catch((err) => {
        console.error("[jobs/process] lobby sweep failed:", err)
        return 0
      }),
      // Retry arena refunds whose first attempt failed (arena:refunds:pending).
      drainPendingRefunds().catch((err) => {
        console.error("[jobs/process] refund drain failed:", err)
        return 0
      }),
    ])
    return NextResponse.json({
      success: true,
      ...summary,
      lobbiesRefunded,
      pendingRefunds,
      durationMs: Date.now() - startTime,
    })
  } catch (err: unknown) {
    // Job handler errors carry payload fragments, Redis URLs and table names.
    console.error("[jobs/process] Error:", err)
    return NextResponse.json({ error: "Job processing failed" }, { status: 500 })
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
