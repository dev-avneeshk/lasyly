/**
 * POST /api/jobs/enqueue
 *
 * Enqueue a background job from authenticated API routes.
 * Used by frontend or other API routes to offload heavy work.
 *
 * Body: { type: string, payload: object }
 *
 * Supported job types:
 * - "generate-ai-writeup" — generate and cache an AI prop analysis
 * - "submit-indexnow" — submit URLs to search engines
 * - "export-bets" — generate CSV export of user's bet history
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { enqueueJob } from "@/lib/queue"
import { JOB_TYPES } from "@/lib/queue/handlers"

const ALLOWED_USER_JOBS: Set<string> = new Set([
  JOB_TYPES.GENERATE_AI_WRITEUP,
  JOB_TYPES.EXPORT_BETS,
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  let body: { type: string; payload?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.type || typeof body.type !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'type' field" }, { status: 400 })
  }

  // Only allow specific job types from user-facing endpoints
  if (!ALLOWED_USER_JOBS.has(body.type)) {
    return NextResponse.json({ error: "Job type not allowed" }, { status: 403 })
  }

  try {
    const jobId = await enqueueJob(
      body.type,
      { ...body.payload, userId: user.id },
      { userId: user.id }
    )

    return NextResponse.json({
      success: true,
      jobId,
      message: "Job enqueued successfully",
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to enqueue job", details: err.message },
      { status: 500 }
    )
  }
}
