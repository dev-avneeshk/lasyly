/**
 * Production-grade rate limiter with sliding window algorithm, IP blocking,
 * and rate limit response headers.
 *
 * ⚠️  WARNING: This module uses in-memory stores. It will NOT work correctly
 * on serverless platforms (Vercel, AWS Lambda) where each request may hit a
 * different instance. For production deployments on serverless infrastructure,
 * use `rateLimiterRedis.ts` which provides a distributed rate limiter backed
 * by Upstash Redis.
 *
 * This in-memory implementation is suitable for:
 * - Local development
 * - Single-instance deployments (Docker, VPS)
 * - Testing
 *
 * For multi-instance/serverless production, use:
 *   import { checkRateLimitDistributed } from "@/lib/security/rateLimiterRedis"
 */

import type { RateLimitConfig, RateLimitResult, IPBlockEntry } from "./types"
import {
  RATE_LIMIT_STANDARD,
  IP_BLOCK_THRESHOLD_MULTIPLIER,
  IP_BLOCK_DURATION_MS,
  IP_BLOCK_WINDOW_MS,
} from "./constants"

// ─── In-Memory Stores ────────────────────────────────────────────────────────

/** Sliding window entries per key */
const rateLimitStore = new Map<string, { timestamps: number[] }>()

/** IP block list */
const ipBlockStore = new Map<string, IPBlockEntry>()

/** IP request tracking for auto-block detection (separate from per-route rate limits) */
const ipRequestStore = new Map<string, { timestamps: number[] }>()

// ─── Cleanup Interval ────────────────────────────────────────────────────────

/** Periodic cleanup of expired entries (every 60 seconds) */
const CLEANUP_INTERVAL_MS = 60_000

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function startCleanup(): void {
  if (cleanupTimer !== null) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()

    // Clean rate limit store
    for (const [key, entry] of rateLimitStore.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000)
      if (entry.timestamps.length === 0) rateLimitStore.delete(key)
    }

    // Clean expired IP blocks
    for (const [ip, block] of ipBlockStore.entries()) {
      if (now >= block.blockedUntil) ipBlockStore.delete(ip)
    }

    // Clean IP request tracking
    for (const [ip, entry] of ipRequestStore.entries()) {
      entry.timestamps = entry.timestamps.filter(
        (t) => now - t < IP_BLOCK_WINDOW_MS
      )
      if (entry.timestamps.length === 0) ipRequestStore.delete(ip)
    }
  }, CLEANUP_INTERVAL_MS)

  // Allow the process to exit without waiting for this timer
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref()
  }
}

// Start cleanup on module load
startCleanup()

// ─── Rate Limiting ───────────────────────────────────────────────────────────

/**
 * Check if a request is allowed under the configured rate limit using a sliding window.
 * Prunes expired timestamps and tracks the request if allowed.
 *
 * @param key - Unique identifier (e.g., IP address, user ID, or composite key)
 * @param config - Rate limit configuration (maxRequests, windowMs)
 * @returns RateLimitResult with allowed status, remaining count, and timing info
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(key) ?? { timestamps: [] }

  // Prune timestamps outside the current sliding window
  entry.timestamps = entry.timestamps.filter(
    (t) => now - t < config.windowMs
  )

  const windowStartMs = now
  const resetAtMs = now + config.windowMs
  const resetAtSeconds = Math.ceil(config.windowMs / 1000)

  if (entry.timestamps.length >= config.maxRequests) {
    // Rate limit exceeded
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = config.windowMs - (now - oldestInWindow)
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)

    rateLimitStore.set(key, entry)

    return {
      allowed: false,
      remaining: 0,
      limit: config.maxRequests,
      retryAfterSeconds,
      resetAtSeconds,
    }
  }

  // Request is allowed — record the timestamp
  entry.timestamps.push(now)
  rateLimitStore.set(key, entry)

  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    limit: config.maxRequests,
    retryAfterSeconds: 0,
    resetAtSeconds,
  }
}

// ─── IP Blocking ─────────────────────────────────────────────────────────────

/**
 * Check if an IP address is currently blocked.
 *
 * @param ip - The IP address to check
 * @returns Object with blocked status and retry-after seconds (0 if not blocked)
 */
export function checkIPBlock(ip: string): {
  blocked: boolean
  retryAfterSeconds: number
} {
  const now = Date.now()
  const block = ipBlockStore.get(ip)

  if (!block) {
    return { blocked: false, retryAfterSeconds: 0 }
  }

  if (now >= block.blockedUntil) {
    // Block has expired — remove it
    ipBlockStore.delete(ip)
    return { blocked: false, retryAfterSeconds: 0 }
  }

  const retryAfterSeconds = Math.ceil((block.blockedUntil - now) / 1000)
  return { blocked: true, retryAfterSeconds }
}

/**
 * Block an IP address for a specified duration.
 *
 * @param ip - The IP address to block
 * @param durationMs - How long to block in milliseconds
 * @param reason - Reason for the block (for logging/auditing)
 */
export function blockIP(ip: string, durationMs: number, reason: string): void {
  const now = Date.now()
  ipBlockStore.set(ip, {
    blockedUntil: now + durationMs,
    reason,
  })
}

/**
 * Track an IP request and auto-block if the IP exceeds the threshold.
 * The threshold is 5× the standard rate limit (300 requests) within 1 minute.
 * If exceeded, the IP is blocked for 15 minutes.
 *
 * @param ip - The IP address to track
 * @returns true if the IP was auto-blocked as a result of this call
 */
export function trackIPRequest(ip: string): boolean {
  const now = Date.now()
  const entry = ipRequestStore.get(ip) ?? { timestamps: [] }

  // Prune timestamps outside the detection window
  entry.timestamps = entry.timestamps.filter(
    (t) => now - t < IP_BLOCK_WINDOW_MS
  )

  entry.timestamps.push(now)
  ipRequestStore.set(ip, entry)

  // Check if threshold exceeded: 5× standard limit (5 × 60 = 300 req/min)
  const threshold =
    RATE_LIMIT_STANDARD.maxRequests * IP_BLOCK_THRESHOLD_MULTIPLIER

  if (entry.timestamps.length > threshold) {
    blockIP(
      ip,
      IP_BLOCK_DURATION_MS,
      `Auto-blocked: exceeded ${threshold} requests in ${IP_BLOCK_WINDOW_MS / 1000}s`
    )
    return true
  }

  return false
}

// ─── Rate Limit Headers ──────────────────────────────────────────────────────

/**
 * Apply rate limit headers to a response object.
 * Sets X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, and Retry-After.
 *
 * @param response - The response object with a headers.set method
 * @param result - The rate limit result from checkRateLimit
 */
export function applyRateLimitHeaders(
  response: { headers: { set: (name: string, value: string) => void } },
  result: RateLimitResult
): void {
  response.headers.set("X-RateLimit-Limit", String(result.limit))
  response.headers.set("X-RateLimit-Remaining", String(result.remaining))
  response.headers.set("X-RateLimit-Reset", String(result.resetAtSeconds))

  if (!result.allowed && result.retryAfterSeconds > 0) {
    response.headers.set("Retry-After", String(result.retryAfterSeconds))
  }
}

// ─── Testing Utilities ───────────────────────────────────────────────────────

/**
 * Reset all stores. Only for use in tests.
 */
export function _resetStores(): void {
  rateLimitStore.clear()
  ipBlockStore.clear()
  ipRequestStore.clear()
}

/**
 * Stop the cleanup interval. Only for use in tests.
 */
export function _stopCleanup(): void {
  if (cleanupTimer !== null) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}
