/**
 * Daily Correlation Cron Job
 *
 * Enqueues pairwise Pearson correlation computation as a background job.
 * The actual heavy lifting happens in the job queue processor.
 *
 * Authorization: Requires CRON_SECRET in the Authorization header.
 *
 * Requirements: 5.3
 */

import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { enqueueJob } from "@/lib/queue"
import { JOB_TYPES } from "@/lib/queue/handlers"

// ─── Auth Verification ──────────────────────────────────────────────────────

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || !authHeader) {
    if (!cronSecret) {
      console.error("CRON_SECRET environment variable is not set")
    }
    return false
  }

  const expected = `Bearer ${cronSecret}`
  const expectedBuf = Buffer.from(expected, "utf8")
  const actualBuf = Buffer.from(authHeader, "utf8")

  if (expectedBuf.length !== actualBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf)
    return false
  }

  return timingSafeEqual(expectedBuf, actualBuf)
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
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
    console.error("Failed to enqueue correlation job:", error)
    return NextResponse.json(
      { error: "Failed to enqueue correlation computation" },
      { status: 500 }
    )
  }
}
