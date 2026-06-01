/**
 * POST /api/jobs/process
 *
 * Background job processor endpoint. Pops pending jobs from the Redis queue
 * and executes their handlers. Protected by CRON_SECRET.
 *
 * Trigger this via:
 * - GitHub Actions cron (every 1-5 minutes)
 * - Vercel Cron
 * - Manual POST with Bearer token
 */

import { NextResponse } from "next/server"
import { processJobs } from "@/lib/queue"
import { jobHandlers } from "@/lib/queue/handlers"

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const summary = await processJobs(jobHandlers)

    return NextResponse.json({
      success: true,
      ...summary,
      durationMs: Date.now() - startTime,
    })
  } catch (err: any) {
    console.error("[jobs/process] Error:", err.message)
    return NextResponse.json(
      { error: "Job processing failed", details: err.message },
      { status: 500 }
    )
  }
}
