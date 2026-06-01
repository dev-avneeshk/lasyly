import { Redis } from "@upstash/redis"

/**
 * Singleton Upstash Redis client.
 *
 * Used for:
 * - Response caching (cache-aside pattern)
 * - Rate limiting (via @upstash/ratelimit)
 *
 * Falls back gracefully — callers should handle null when env vars are missing.
 */

let _redis: Redis | null = null
let _initialized = false

export function getRedisClient(): Redis | null {
  if (_initialized) return _redis

  _initialized = true

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.warn(
      "[redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set. " +
        "Caching will use in-memory fallback."
    )
    return null
  }

  try {
    _redis = new Redis({ url, token })
    return _redis
  } catch (error) {
    console.error("[redis] Failed to initialize Redis client:", error)
    return null
  }
}
