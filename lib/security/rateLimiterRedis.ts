/**
 * Redis-backed rate limiter adapter for production (Vercel/serverless).
 *
 * Uses Upstash Redis for distributed rate limiting that works across
 * multiple serverless instances. Falls back to in-memory rate limiter
 * if UPSTASH_REDIS_REST_URL is not configured.
 *
 * Setup:
 * 1. Install: npm install @upstash/redis @upstash/ratelimit
 * 2. Add env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * 3. Import from this module instead of ./rateLimiter for production routes
 *
 * @see https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
 */

import type { RateLimitConfig, RateLimitResult } from "./types"
import {
  RATE_LIMIT_AUTH,
  RATE_LIMIT_SESSION_IP,
  RATE_LIMIT_STANDARD,
  RATE_LIMIT_UNAUTHENTICATED,
  SESSIONS_PER_IP,
} from "./constants"
import {
  checkRateLimit as checkRateLimitMemory,
  applyRateLimitHeaders,
} from "./rateLimiter"

// ─── Types ───────────────────────────────────────────────────────────────────

interface RedisRateLimiter {
  limit: (identifier: string) => Promise<{
    success: boolean
    remaining: number
    limit: number
    reset: number
  }>
}

export type RateLimitTier = "auth" | "standard" | "unauthenticated" | "sessionIp"

const TIERS: Record<RateLimitTier, { config: RateLimitConfig; prefix: string }> = {
  auth: { config: RATE_LIMIT_AUTH, prefix: "rl:auth" },
  standard: { config: RATE_LIMIT_STANDARD, prefix: "rl:standard" },
  unauthenticated: { config: RATE_LIMIT_UNAUTHENTICATED, prefix: "rl:unauth" },
  sessionIp: { config: RATE_LIMIT_SESSION_IP, prefix: "rl:sessip" },
}

// ─── Lazy Redis Initialization ───────────────────────────────────────────────

let _limiters: Partial<Record<RateLimitTier, RedisRateLimiter>> = {}
let _redis: import("@upstash/redis").Redis | null = null
let _initialized = false
let _useRedis = false

async function initRedis(): Promise<boolean> {
  if (_initialized) return _useRedis

  _initialized = true

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.warn(
      "[rate-limiter] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. " +
        "Falling back to in-memory rate limiter. This will NOT work correctly on serverless/multi-instance deployments."
    )
    _useRedis = false
    return false
  }

  try {
    // Dynamic import to avoid bundling if not used
    const { Redis } = await import("@upstash/redis")
    const { Ratelimit } = await import("@upstash/ratelimit")

    const redis = new Redis({ url, token })
    _redis = redis
    _limiters = Object.fromEntries(
      Object.entries(TIERS).map(([tier, { config, prefix }]) => [
        tier,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowMs}ms`),
          prefix,
        }),
      ])
    )

    _useRedis = true
    return true
  } catch (error) {
    console.error("[rate-limiter] Failed to initialize Redis rate limiter:", error)
    _useRedis = false
    return false
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check rate limit using Redis (production) or in-memory (development/fallback).
 *
 * @param identifier - Unique key (IP address, user ID, or composite)
 * @param tier - Which rate limit tier to apply
 * @returns RateLimitResult compatible with the existing interface
 */
export async function checkRateLimitDistributed(
  identifier: string,
  tier: RateLimitTier = "standard"
): Promise<RateLimitResult> {
  const limiter = (await initRedis()) ? _limiters[tier] : undefined
  if (!limiter) return checkRateLimitMemory(identifier, TIERS[tier].config)

  const result = await limiter.limit(identifier)
  const resetAtSeconds = Math.ceil((result.reset - Date.now()) / 1000)

  return {
    allowed: result.success,
    remaining: result.remaining,
    limit: result.limit,
    retryAfterSeconds: result.success ? 0 : Math.max(resetAtSeconds, 1),
    resetAtSeconds: Math.max(resetAtSeconds, 0),
  }
}

// Atomic: admit a session already in this IP's set for the minute, or a new one
// while the set is under the cap. The set never grows past the cap.
const ADMIT_SESSION_LUA = `
if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then return 1 end
if redis.call('SCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
redis.call('SADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], 120)
return 1`
const memorySessionSets = new Map<string, Set<string>>()

/**
 * Whether this session bucket is one of the first SESSIONS_PER_IP distinct
 * sessions seen from `ip` this minute. The proxy can't verify the cookie, so a
 * forged-cookie flood is told apart from a NAT/office IP by count: real users
 * behind one address are a handful, a flood is thousands. Fails open (the
 * per-IP flood guard still applies).
 */
export async function admitSessionBucket(ip: string, bucket: string): Promise<boolean> {
  const key = `rl:sessset:${ip}:${Math.floor(Date.now() / 60_000)}`
  if (await initRedis()) {
    try {
      return (await _redis!.eval(ADMIT_SESSION_LUA, [key], [bucket, SESSIONS_PER_IP])) === 1
    } catch {
      return true
    }
  }
  if (memorySessionSets.size > 10_000) memorySessionSets.clear()
  const set = memorySessionSets.get(key) ?? new Set<string>()
  memorySessionSets.set(key, set)
  if (set.has(bucket)) return true
  if (set.size >= SESSIONS_PER_IP) return false
  set.add(bucket)
  return true
}

// Re-export for convenience
export { applyRateLimitHeaders }
