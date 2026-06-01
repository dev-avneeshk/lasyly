/**
 * GET /api/jobs/[jobId]
 *
 * Returns the current status of a background job.
 * Used by clients to poll for completion after enqueuing a job.
 */

import { NextResponse } from "next/server"
import { getJobStatus } from "@/lib/queue"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 })
  }

  const job = await getJobStatus(jobId)

  if (!job) {
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
}
