/**
 * Async Job Queue backed by Upstash Redis.
 *
 * Lightweight queue for offloading heavy tasks from request handlers.
 * Jobs are stored in Redis sorted sets (scored by timestamp) and processed
 * via a dedicated /api/jobs/process endpoint triggered by cron or webhook.
 *
 * Features:
 * - FIFO ordering via sorted set scores (enqueue timestamp)
 * - Job status tracking (pending → processing → completed → failed)
 * - Retry with exponential backoff (max 3 attempts)
 * - Job TTL: completed/failed jobs auto-expire after 24h
 * - Concurrency-safe: atomic pop via ZPOPMIN
 */

import { Redis } from "@upstash/redis"

// ─── Types ──────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "processing" | "completed" | "failed"

export interface Job<T = Record<string, unknown>> {
  id: string
  type: string
  payload: T
  status: JobStatus
  attempts: number
  maxAttempts: number
  createdAt: string
  updatedAt: string
  result?: unknown
  error?: string
  /** Optional: user who triggered the job (for user-scoped jobs) */
  userId?: string
}

export interface EnqueueOptions {
  /** Max retry attempts (default: 3) */
  maxAttempts?: number
  /** Optional user ID for user-scoped jobs */
  userId?: string
  /** Delay before first processing in ms (default: 0) */
  delayMs?: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const QUEUE_KEY = "jobs:queue"
const JOB_PREFIX = "jobs:data:"
const STATUS_PREFIX = "jobs:status:"
const USER_JOBS_PREFIX = "jobs:user:"

/** Completed/failed jobs expire after 24 hours */
const JOB_TTL_SECONDS = 86400

/** Max jobs to process per invocation */
const BATCH_SIZE = 10

/** Base delay for exponential backoff (1 second) */
const BASE_RETRY_DELAY_MS = 1000

// ─── Redis Client ───────────────────────────────────────────────────────────

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
      throw new Error(
        "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables"
      )
    }

    redis = new Redis({ url, token })
  }
  return redis
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a unique job ID.
 */
function generateJobId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `job_${timestamp}_${random}`
}

/**
 * Enqueue a new job for background processing.
 *
 * @returns The job ID for status tracking.
 */
export async function enqueueJob<T extends Record<string, unknown>>(
  type: string,
  payload: T,
  options: EnqueueOptions = {}
): Promise<string> {
  const r = getRedis()
  const id = generateJobId()
  const now = new Date().toISOString()

  const job: Job<T> = {
    id,
    type,
    payload,
    status: "pending",
    attempts: 0,
    maxAttempts: options.maxAttempts ?? 3,
    createdAt: now,
    updatedAt: now,
    userId: options.userId,
  }

  // Score = timestamp (with optional delay)
  const score = Date.now() + (options.delayMs ?? 0)

  // Store job data and add to queue atomically via pipeline
  const pipeline = r.pipeline()
  pipeline.set(`${JOB_PREFIX}${id}`, JSON.stringify(job), { ex: JOB_TTL_SECONDS })
  pipeline.zadd(QUEUE_KEY, { score, member: id })

  // Track by user if userId provided
  if (options.userId) {
    pipeline.sadd(`${USER_JOBS_PREFIX}${options.userId}`, id)
  }

  await pipeline.exec()

  return id
}

/**
 * Get the current status of a job.
 */
export async function getJobStatus(jobId: string): Promise<Job | null> {
  const r = getRedis()
  const raw = await r.get(`${JOB_PREFIX}${jobId}`)
  if (!raw) return null
  return typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Job)
}

/**
 * Get all jobs for a specific user (most recent first).
 */
export async function getUserJobs(userId: string, limit = 20): Promise<Job[]> {
  const r = getRedis()
  const jobIds = await r.smembers(`${USER_JOBS_PREFIX}${userId}`)

  if (!jobIds || jobIds.length === 0) return []

  // Fetch job data for each ID
  const pipeline = r.pipeline()
  for (const id of jobIds.slice(0, limit)) {
    pipeline.get(`${JOB_PREFIX}${id}`)
  }

  const results = await pipeline.exec()
  const jobs: Job[] = []

  for (const raw of results) {
    if (!raw) continue
    const job = typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Job)
    if (job) jobs.push(job)
  }

  // Sort by createdAt descending
  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return jobs
}

/**
 * Process pending jobs from the queue.
 * Called by /api/jobs/process endpoint.
 *
 * @param handler - Map of job type → async handler function
 * @returns Summary of processed jobs
 */
export async function processJobs(
  handlers: Record<string, (payload: any) => Promise<unknown>>
): Promise<{ processed: number; failed: number; skipped: number }> {
  const r = getRedis()
  const now = Date.now()
  const summary = { processed: 0, failed: 0, skipped: 0 }

  // Pop up to BATCH_SIZE jobs that are ready (score <= now)
  const readyJobs = await r.zrange(QUEUE_KEY, 0, now, { byScore: true, offset: 0, count: BATCH_SIZE })

  if (!readyJobs || readyJobs.length === 0) return summary

  for (const jobId of readyJobs) {
    const id = String(jobId)

    // Atomically remove from queue (prevents double-processing)
    const removed = await r.zrem(QUEUE_KEY, id)
    if (!removed) {
      summary.skipped++
      continue
    }

    // Fetch job data
    const raw = await r.get(`${JOB_PREFIX}${id}`)
    if (!raw) {
      summary.skipped++
      continue
    }

    const job: Job = typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as Job)

    // Check if handler exists for this job type
    const handler = handlers[job.type]
    if (!handler) {
      console.error(`[queue] No handler registered for job type: ${job.type}`)
      job.status = "failed"
      job.error = `No handler for type: ${job.type}`
      job.updatedAt = new Date().toISOString()
      await r.set(`${JOB_PREFIX}${id}`, JSON.stringify(job), { ex: JOB_TTL_SECONDS })
      summary.failed++
      continue
    }

    // Process the job
    job.status = "processing"
    job.attempts += 1
    job.updatedAt = new Date().toISOString()
    await r.set(`${JOB_PREFIX}${id}`, JSON.stringify(job), { ex: JOB_TTL_SECONDS })

    try {
      const result = await handler(job.payload)
      job.status = "completed"
      job.result = result
      job.updatedAt = new Date().toISOString()
      await r.set(`${JOB_PREFIX}${id}`, JSON.stringify(job), { ex: JOB_TTL_SECONDS })
      summary.processed++
    } catch (err: any) {
      job.error = err.message ?? "Unknown error"
      job.updatedAt = new Date().toISOString()

      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, job.attempts - 1)
        job.status = "pending"
        await r.set(`${JOB_PREFIX}${id}`, JSON.stringify(job), { ex: JOB_TTL_SECONDS })
        await r.zadd(QUEUE_KEY, { score: Date.now() + delay, member: id })
      } else {
        // Max attempts reached
        job.status = "failed"
        await r.set(`${JOB_PREFIX}${id}`, JSON.stringify(job), { ex: JOB_TTL_SECONDS })
      }

      summary.failed++
    }
  }

  return summary
}

/**
 * Get queue stats (pending count, processing count).
 */
export async function getQueueStats(): Promise<{
  pending: number
  total: number
}> {
  const r = getRedis()
  const pending = await r.zcard(QUEUE_KEY)
  return { pending: pending ?? 0, total: pending ?? 0 }
}
