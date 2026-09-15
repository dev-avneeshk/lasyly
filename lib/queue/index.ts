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

/**
 * Max jobs to process per invocation.
 *
 * Was 10. The processor is triggered by a GitHub Actions cron every 2 minutes
 * (.github/workflows/process-jobs.yml), so 10 per run is a drain rate of 5
 * jobs/minute. Combined with an unbounded enqueue endpoint, one user could
 * queue 10,000 jobs and delay parlay resolution for everyone by ~33 hours.
 */
const BATCH_SIZE = 50

/** Base delay for exponential backoff (1 second) */
const BASE_RETRY_DELAY_MS = 1000

/**
 * Hard ceiling on pending jobs.
 *
 * A full queue rejects new work loudly instead of silently accumulating a
 * backlog that the 2-minute cron can never drain.
 */
const MAX_QUEUE_DEPTH = 5_000

/** Max job ids tracked per user (the index set had no bound and no TTL). */
const MAX_USER_JOB_IDS = 100

/** How long a claimed job may run before it becomes visible again. */
const LEASE_MS = 5 * 60 * 1000

/** Raised when the queue is at capacity. */
export class QueueFullError extends Error {
  readonly code = "QUEUE_FULL"
  constructor(message = "The job queue is at capacity. Please try again later.") {
    super(message)
    this.name = "QueueFullError"
  }
}

/**
 * Claim a job by extending its score into the future (a lease) rather than
 * removing it from the queue.
 *
 * The previous claim was `ZREM` + set status "processing". If the serverless
 * function then timed out — which is the normal failure mode for the slow jobs
 * in this queue — the job was already gone from the sorted set and stayed
 * "processing" forever. It was neither retried nor visible: silently lost.
 *
 * Leasing makes the claim recoverable. The CAS (`score > now` → refuse) is what
 * keeps two concurrent processors from claiming the same job.
 *
 * KEYS[1] = queue key
 * ARGV[1] = job id, ARGV[2] = now, ARGV[3] = lease expiry score
 */
const CLAIM_JOB_LUA = `
local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
if not score then return 0 end
if tonumber(score) > tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1])
return 1
`

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

  // Refuse work we can't drain. Without this the queue was unbounded: a single
  // authenticated caller hitting POST /api/jobs/enqueue in a loop could grow it
  // indefinitely, starving scheduled work like parlay resolution.
  const pending = await r.zcard(QUEUE_KEY)
  if ((pending ?? 0) >= MAX_QUEUE_DEPTH) {
    throw new QueueFullError()
  }

  // Score = timestamp (with optional delay)
  const score = Date.now() + (options.delayMs ?? 0)

  // Store job data and add to queue atomically via pipeline
  const pipeline = r.pipeline()
  pipeline.set(`${JOB_PREFIX}${id}`, JSON.stringify(job), { ex: JOB_TTL_SECONDS })
  pipeline.zadd(QUEUE_KEY, { score, member: id })

  // Track by user if userId provided. The set now expires — it previously grew
  // forever, one id per job, with no TTL and no cap.
  if (options.userId) {
    const userKey = `${USER_JOBS_PREFIX}${options.userId}`
    pipeline.sadd(userKey, id)
    pipeline.expire(userKey, JOB_TTL_SECONDS)
  }

  await pipeline.exec()

  // Opportunistically trim the user's index set. Job data expires after 24h, so
  // ids beyond the cap point at nothing useful anyway.
  if (options.userId) {
    void trimUserJobs(options.userId).catch(() => {})
  }

  return id
}

/** Keep a user's job index bounded; ids are dropped oldest-first by id order. */
async function trimUserJobs(userId: string): Promise<void> {
  const r = getRedis()
  const userKey = `${USER_JOBS_PREFIX}${userId}`
  const ids = await r.smembers(userKey)
  if (!ids || ids.length <= MAX_USER_JOB_IDS) return
  // Job ids embed a base36 timestamp, so lexical order is chronological.
  const surplus = ids.sort().slice(0, ids.length - MAX_USER_JOB_IDS)
  if (surplus.length > 0) await r.srem(userKey, ...surplus)
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

    // Claim by LEASING, not removing. If this invocation dies mid-job (the
    // normal serverless failure mode for slow work), the lease expires and the
    // job becomes visible again instead of being silently lost. The CAS inside
    // the script is what prevents two concurrent processors claiming the same
    // job — the same guarantee the old `zrem` provided.
    let claimed = 0
    try {
      claimed = Number(
        await r.eval(CLAIM_JOB_LUA, [QUEUE_KEY], [id, String(now), String(now + LEASE_MS)])
      )
    } catch (err) {
      console.error("[queue] claim failed:", err)
      summary.skipped++
      continue
    }
    if (claimed !== 1) {
      summary.skipped++
      continue
    }

    // Fetch job data
    const raw = await r.get(`${JOB_PREFIX}${id}`)
    if (!raw) {
      // Payload expired; drop the orphaned queue entry.
      await r.zrem(QUEUE_KEY, id)
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
      await r.zrem(QUEUE_KEY, id) // terminal — release the lease
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
      await r.zrem(QUEUE_KEY, id) // terminal — release the lease
      summary.processed++
    } catch (err: unknown) {
      job.error = err instanceof Error ? err.message : "Unknown error"
      job.updatedAt = new Date().toISOString()

      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff. Re-scoring replaces the lease.
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, job.attempts - 1)
        job.status = "pending"
        await r.set(`${JOB_PREFIX}${id}`, JSON.stringify(job), { ex: JOB_TTL_SECONDS })
        await r.zadd(QUEUE_KEY, { score: Date.now() + delay, member: id })
      } else {
        // Max attempts reached — terminal, release the lease.
        job.status = "failed"
        await r.set(`${JOB_PREFIX}${id}`, JSON.stringify(job), { ex: JOB_TTL_SECONDS })
        await r.zrem(QUEUE_KEY, id)
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
