/**
 * Daily Correlation Cron Job
 *
 * Enqueues pairwise Pearson correlation computation as a background job.
 * The actual heavy lifting happens in the job queue processor.
 *
 * Authorization: Requires CRON_SECRET in the Authorization header.
 *
 * (The constant-time comparison this route pioneered now lives in
 * lib/security/cronAuth.ts and is shared by every scheduled endpoint — the
 * others were using a plain `!==` string compare.)
 */
import { NextResponse } from "next/server"
import { enqueueJob, QueueFullError } from "@/lib/queue"
import { JOB_TYPES } from "@/lib/queue/handlers"
import { isAuthorizedCron } from "@/lib/security/cronAuth"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

export const GET = withSecurity(async (request: Request) => {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const jobId = await enqueueJob(JOB_TYPES.COMPUTE_CORRELATIONS, {
      sports: ["NBA", "Tennis"],
    })
    return NextResponse.json({
      success: true,
      message: "Correlation computation enqueued",
      jobId,
      enqueuedAt: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof QueueFullError) {
      console.error("[correlations] queue is full — computation skipped")
      return NextResponse.json(
        { error: "Job queue is at capacity." },
        { status: 503, headers: { "Retry-After": "60" } }
      )
    }
    console.error("Failed to enqueue correlation job:", error)
    return NextResponse.json(
      { error: "Failed to enqueue correlation computation" },
      { status: 500 }
    )
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
