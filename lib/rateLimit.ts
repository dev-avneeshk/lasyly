/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window approach. Suitable for single-instance deployments.
 * For multi-instance, replace with @upstash/ratelimit + Redis.
 */

type RateLimitEntry = {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Clean up old entries every 60 seconds
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60000)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}, 60000)

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

/**
 * Check if a request is allowed under the rate limit.
 * @param key - Unique identifier (e.g., userId, IP + route)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key) ?? { timestamps: [] }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < config.windowMs)

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = config.windowMs - (now - oldestInWindow)
    return { allowed: false, remaining: 0, retryAfterMs }
  }

  entry.timestamps.push(now)
  store.set(key, entry)

  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  }
}

// Preset configurations
export const RATE_LIMITS = {
  /** Chat: 1 message per 2 seconds per user */
  chat: { maxRequests: 1, windowMs: 2000 },
  /** Chat burst: max 10 messages per 30 seconds */
  chatBurst: { maxRequests: 10, windowMs: 30000 },
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
} as const
