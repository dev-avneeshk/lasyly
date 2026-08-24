/**
 * Distributed rate limiter for API routes.
 *
 * Uses Upstash Redis (via @upstash/ratelimit) for production deployments on
 * Vercel serverless where in-memory stores are useless (each invocation is
 * a fresh process). Falls back to a lightweight in-memory store ONLY for
 * local development / environments without Redis configured.
 *
 * Business-level rate limits (per-user, per-action) that complement the
 * global IP-based limits enforced in proxy.ts.
 */
import { getRedisClient } from "./redis"

// ─── Types ───────────────────────────────────────────────────────────────────

type RateLimitConfig = {
  /** Max requests allowed in the window */
  maxRequests: number
  /** Window size in milliseconds */
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

// ─── Redis-backed rate limiting ──────────────────────────────────────────────

/**
 * Check if a request is allowed under the rate limit.
 * Uses Redis sliding window when available; falls back to in-memory for local dev.
 *
 * @param key - Unique identifier (e.g., `chat:${userId}:${roomId}`)
 * @param config - Rate limit configuration
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient()

  if (redis) {
    return checkRateLimitRedis(key, config)
  }

  // Fallback: in-memory for local development only
  return checkRateLimitMemory(key, config)
}

/**
 * Synchronous rate limit check using in-memory store.
 * Only reliable on single-instance deployments (local dev, Docker).
 * On serverless (Vercel), this resets on every cold start — use Redis.
 *
 * @deprecated Use the async `checkRateLimit` which auto-selects Redis/memory.
 */
export function checkRateLimitSync(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  return checkRateLimitMemory(key, config)
}

// ─── Redis Implementation ────────────────────────────────────────────────────

async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient()!
  const redisKey = `rl:biz:${key}`
  const now = Date.now()
  const windowStart = now - config.windowMs

  try {
    // Sliding window using a sorted set:
    // - Score = timestamp of request
    // - Member = unique request ID (timestamp + random suffix to avoid collisions)
    const pipeline = redis.pipeline()

    // Remove entries outside the window
    pipeline.zremrangebyscore(redisKey, 0, windowStart)
    // Count entries in the window
    pipeline.zcard(redisKey)

    const results = await pipeline.exec()

    // zcard result is at index 1
    const currentCount = (results[1] as number) ?? 0

    if (currentCount >= config.maxRequests) {
      // Over limit — find the oldest entry to compute retry time
      const oldest = await redis.zrange(redisKey, 0, 0, { withScores: true })
      const oldestScore = oldest.length >= 2 ? Number(oldest[1]) : now
      const retryAfterMs = Math.max(0, config.windowMs - (now - oldestScore))

      return { allowed: false, remaining: 0, retryAfterMs }
    }

    // Under limit — add this request
    const member = `${now}:${Math.random().toString(36).slice(2, 8)}`
    await redis.zadd(redisKey, { score: now, member })
    // Set TTL to auto-cleanup (window + buffer)
    await redis.expire(redisKey, Math.ceil(config.windowMs / 1000) + 10)

    return {
      allowed: true,
      remaining: config.maxRequests - currentCount - 1,
      retryAfterMs: 0,
    }
  } catch (error) {
    // Redis failure: fail-open for non-critical routes.
    // The proxy-level Redis rate limiter is the primary protection;
    // this is a secondary business-logic limiter.
    console.warn("[rateLimit] Redis rate limit check failed, allowing request:", error)
    return { allowed: true, remaining: config.maxRequests, retryAfterMs: 0 }
  }
}

// ─── In-Memory Fallback ──────────────────────────────────────────────────────

type MemoryEntry = { timestamps: number[] }
const memoryStore = new Map<string, MemoryEntry>()

// Clean up expired entries every 60 seconds
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [k, entry] of memoryStore.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 300_000)
      if (entry.timestamps.length === 0) memoryStore.delete(k)
    }
  }, 60_000)
  if (timer && typeof timer === "object" && "unref" in timer) {
    timer.unref()
  }
}

function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(key) ?? { timestamps: [] }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < config.windowMs)

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = config.windowMs - (now - oldestInWindow)
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  entry.timestamps.push(now)
  memoryStore.set(key, entry)

  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  }
}

// ─── Preset Configurations ───────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** Chat: 1 message per 2 seconds per user */
  chat: { maxRequests: 1, windowMs: 2000 },
  /** Chat burst: max 10 messages per 30 seconds */
  chatBurst: { maxRequests: 10, windowMs: 30000 },
  /** Chat flood: max 30 messages per 5 minutes (global across all rooms) */
  chatFlood: { maxRequests: 30, windowMs: 300000 },
  /** API general: 60 requests per minute */
  general: { maxRequests: 60, windowMs: 60000 },
  /** Auth: 5 attempts per minute */
  auth: { maxRequests: 5, windowMs: 60000 },
  /** Wallet: 3 operations per minute */
  wallet: { maxRequests: 3, windowMs: 60000 },
  /** Follow: 30 per minute */
  follow: { maxRequests: 30, windowMs: 60000 },
  /** Room create: 5 per hour */
  roomCreate: { maxRequests: 5, windowMs: 3600000 },
  /** Admin actions: 20 per minute (kick/ban/mute/role) */
  adminAction: { maxRequests: 20, windowMs: 60000 },
} as const
