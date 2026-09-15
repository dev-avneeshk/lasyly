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
 * - "export-bets" — generate CSV export of user's bet history
 *
 * ── Bounds ──────────────────────────────────────────────────────────────────
 * This route had no rate limit, no body-size limit (it skipped withSecurity) and
 * no schema, while writing an arbitrary caller-supplied object into Redis. Three
 * consequences: a user could flood the queue faster than the 2-minute cron could
 * drain it (starving scheduled work like parlay resolution), push megabytes of
 * junk into Redis, and pass unvalidated payload shapes into job handlers.
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { enqueueJob, QueueFullError } from "@/lib/queue"
import { JOB_TYPES } from "@/lib/queue/handlers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const ALLOWED_USER_JOBS: Set<string> = new Set([
  JOB_TYPES.GENERATE_AI_WRITEUP,
  JOB_TYPES.EXPORT_BETS,
])

/** 8KB of JSON is far more than any user-triggerable job payload needs. */
const MAX_PAYLOAD_BYTES = 8 * 1024

const enqueueSchema = z.object({
  type: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const rate = await checkRateLimit(`job-enqueue:${user.id}`, RATE_LIMITS.jobEnqueue)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many background jobs queued. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

  const body = await request.json().catch(() => null)
  if (body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const [data, validationError] = validateRequestBody(body, enqueueSchema)
  if (validationError) return validationError

  // Only allow specific job types from user-facing endpoints
  if (!ALLOWED_USER_JOBS.has(data.type)) {
    return NextResponse.json({ error: "Job type not allowed" }, { status: 403 })
  }

  // The payload is persisted verbatim into Redis, so bound it independently of
  // the (much larger) whole-request limit.
  const payload = data.payload ?? {}
  if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Job payload is too large." }, { status: 413 })
  }

  try {
    const jobId = await enqueueJob(
      data.type,
      { ...payload, userId: user.id },
      { userId: user.id }
    )
    return NextResponse.json({
      success: true,
      jobId,
      message: "Job enqueued successfully",
    })
  } catch (err) {
    if (err instanceof QueueFullError) {
      return NextResponse.json(
        { error: err.message },
        { status: 503, headers: { "Retry-After": "30" } }
      )
    }
    // Never echo the underlying error: it can carry Redis URLs and payload
    // fragments.
    console.error("[jobs/enqueue] failed:", err)
    return NextResponse.json({ error: "Failed to enqueue job" }, { status: 500 })
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
