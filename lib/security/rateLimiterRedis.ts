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
  RATE_LIMIT_STANDARD,
  RATE_LIMIT_UNAUTHENTICATED,
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

// ─── Lazy Redis Initialization ───────────────────────────────────────────────

let _authLimiter: RedisRateLimiter | null = null
let _standardLimiter: RedisRateLimiter | null = null
let _unauthLimiter: RedisRateLimiter | null = null
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

    _authLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT_AUTH.maxRequests,
        `${RATE_LIMIT_AUTH.windowMs}ms`
      ),
      prefix: "rl:auth",
    })

    _standardLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT_STANDARD.maxRequests,
        `${RATE_LIMIT_STANDARD.windowMs}ms`
      ),
      prefix: "rl:standard",
    })

    _unauthLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT_UNAUTHENTICATED.maxRequests,
        `${RATE_LIMIT_UNAUTHENTICATED.windowMs}ms`
      ),
      prefix: "rl:unauth",
    })

    _useRedis = true
    return true
  } catch (error) {
    console.error("[rate-limiter] Failed to initialize Redis rate limiter:", error)
    _useRedis = false
    return false
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type RateLimitTier = "auth" | "standard" | "unauthenticated"

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
  const redisAvailable = await initRedis()

  if (!redisAvailable) {
    // Fallback to in-memory
    const config = getTierConfig(tier)
    return checkRateLimitMemory(identifier, config)
  }

  const limiter = getLimiterForTier(tier)
  if (!limiter) {
    const config = getTierConfig(tier)
    return checkRateLimitMemory(identifier, config)
  }

  const result = await limiter.limit(identifier)
  const config = getTierConfig(tier)
  const resetAtSeconds = Math.ceil((result.reset - Date.now()) / 1000)

  return {
    allowed: result.success,
    remaining: result.remaining,
    limit: result.limit,
    retryAfterSeconds: result.success ? 0 : Math.max(resetAtSeconds, 1),
    resetAtSeconds: Math.max(resetAtSeconds, 0),
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTierConfig(tier: RateLimitTier): RateLimitConfig {
  switch (tier) {
    case "auth":
      return RATE_LIMIT_AUTH
    case "unauthenticated":
      return RATE_LIMIT_UNAUTHENTICATED
    case "standard":
    default:
      return RATE_LIMIT_STANDARD
  }
}

function getLimiterForTier(tier: RateLimitTier): RedisRateLimiter | null {
  switch (tier) {
    case "auth":
      return _authLimiter
    case "unauthenticated":
      return _unauthLimiter
    case "standard":
    default:
      return _standardLimiter
  }
}

// Re-export for convenience
export { applyRateLimitHeaders }
