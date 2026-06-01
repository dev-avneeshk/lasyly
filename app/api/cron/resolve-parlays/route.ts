import { NextResponse } from "next/server"
import { enqueueJob } from "@/lib/queue"
import { JOB_TYPES } from "@/lib/queue/handlers"

/**
 * POST /api/cron/resolve-parlays
 *
 * Enqueues parlay resolution as a background job.
 * Protected by CRON_SECRET header check.
 *
 * The actual resolution logic runs asynchronously via the job queue,
 * preventing timeout issues on serverless functions.
 */
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to enqueue parlay resolution", details: err.message },
      { status: 500 }
    )
  }
}
