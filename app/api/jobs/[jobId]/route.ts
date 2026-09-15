/**
 * GET /api/jobs/[jobId]
 *
 * Returns the current status of a background job.
 * Used by clients to poll for completion after enqueuing a job.
 *
 * ── Authorization ───────────────────────────────────────────────────────────
 * This route had NO authentication and returned `job.result` verbatim. Job
 * payloads are user-scoped — `export-bets` resolves to that user's full betting
 * history, and `generate-ai-writeup` to paid analysis — so anyone holding or
 * guessing a job id could read another user's data. Job ids are
 * `job_<base36 time>_<8 base36 chars>`, i.e. partially predictable from the
 * enqueue timestamp, which makes that more than theoretical.
 *
 * Jobs are now readable only by the user who enqueued them (or the service
 * role). A job with no `userId` is a system job and is never exposed here.
 */
import { NextResponse } from "next/server"
import { getJobStatus } from "@/lib/queue"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"

export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<{ jobId: string }> }
) => {
  const { jobId } = await context!.params
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  // Polling endpoint — bound it so a client that never stops polling (or an id
  // enumeration attempt) can't run unmetered against Redis.
  const rate = await checkRateLimit(`job-status:${user.id}`, RATE_LIMITS.arenaPoll)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Polling too fast." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
    )
  }

  const job = await getJobStatus(jobId)

  // Deliberately identical response for "no such job" and "not your job": a
  // distinguishable 403 would confirm which ids exist.
  if (!job || !job.userId || job.userId !== user.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  return NextResponse.json({
    id: job.id,
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    result: job.status === "completed" ? job.result : undefined,
    error: job.status === "failed" ? job.error : undefined,
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
