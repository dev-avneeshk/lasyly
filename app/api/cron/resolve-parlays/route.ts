import { NextResponse } from "next/server"
import { enqueueJob, QueueFullError } from "@/lib/queue"
import { JOB_TYPES } from "@/lib/queue/handlers"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * POST /api/cron/resolve-parlays
 *
 * Enqueues parlay resolution as a background job.
 * Protected by CRON_SECRET (constant-time comparison, header only).
 *
 * The actual resolution logic runs asynchronously via the job queue,
 * preventing timeout issues on serverless functions.
 */
export const POST = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const jobId = await enqueueJob(JOB_TYPES.RESOLVE_PARLAYS, { limit: 100 })
    return NextResponse.json({
      success: true,
      message: "Parlay resolution enqueued",
      jobId,
      enqueuedAt: new Date().toISOString(),
    })
  } catch (err) {
    // A full queue is operationally meaningful (scheduled work is backing up),
    // so it gets its own status rather than being flattened into a 500.
    if (err instanceof QueueFullError) {
      console.error("[resolve-parlays] queue is full — resolution skipped")
      return NextResponse.json(
        { error: "Job queue is at capacity." },
        { status: 503, headers: { "Retry-After": "60" } }
      )
    }
    console.error("[resolve-parlays] enqueue failed:", err)
    return NextResponse.json(
      { error: "Failed to enqueue parlay resolution" },
      { status: 500 }
    )
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
