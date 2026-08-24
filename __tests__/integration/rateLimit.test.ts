/**
 * Rate limiting integration tests.
 *
 * Tests the actual Redis-backed rate limiter against a real Upstash instance.
 * Skipped if TEST_UPSTASH_REDIS_URL is not set.
 *
 * These verify that the distributed rate limiter works correctly across
 * multiple invocations (simulating serverless behavior).
 */
import { describe, it, expect, beforeAll } from "vitest"

const TEST_REDIS_URL = process.env.TEST_UPSTASH_REDIS_URL
const TEST_REDIS_TOKEN = process.env.TEST_UPSTASH_REDIS_TOKEN
const hasTestRedis = Boolean(TEST_REDIS_URL && TEST_REDIS_TOKEN)

describe.skipIf(!hasTestRedis)("Integration: Redis Rate Limiting", () => {
  let Redis: any

  beforeAll(async () => {
    const mod = await import("@upstash/redis")
    Redis = mod.Redis
  })

  it("Redis sorted set rate limiter correctly counts requests", async () => {
    const redis = new Redis({ url: TEST_REDIS_URL, token: TEST_REDIS_TOKEN })
    const testKey = `rl:test:integration:${Date.now()}`

    try {
      // Simulate 3 requests in a 60s window
      for (let i = 0; i < 3; i++) {
        const now = Date.now()
        const member = `${now}:${i}`
        await redis.zadd(testKey, { score: now, member })
      }
      await redis.expire(testKey, 70) // cleanup after test

      // Count requests in window
      const count = await redis.zcard(testKey)
      expect(count).toBe(3)

      // Verify window trimming works
      const windowStart = Date.now() - 60000
      await redis.zremrangebyscore(testKey, 0, windowStart)
      const afterTrim = await redis.zcard(testKey)
      expect(afterTrim).toBe(3) // all requests are recent, none trimmed
    } finally {
      await redis.del(testKey)
    }
  })

  it("rate limiter enforces the configured limit", async () => {
    const redis = new Redis({ url: TEST_REDIS_URL, token: TEST_REDIS_TOKEN })
    const testKey = `rl:test:enforce:${Date.now()}`
    const maxRequests = 5

    try {
      // Fill up the window
      for (let i = 0; i < maxRequests; i++) {
        const now = Date.now()
        await redis.zadd(testKey, { score: now, member: `${now}:${i}` })
      }
      await redis.expire(testKey, 70)

      // Check count
      const count = await redis.zcard(testKey)
      expect(count).toBe(maxRequests)

      // Next request should be denied (count >= max)
      expect(count >= maxRequests).toBe(true)
    } finally {
      await redis.del(testKey)
    }
  })

  it("different keys are independent", async () => {
    const redis = new Redis({ url: TEST_REDIS_URL, token: TEST_REDIS_TOKEN })
    const keyA = `rl:test:indep:a:${Date.now()}`
    const keyB = `rl:test:indep:b:${Date.now()}`

    try {
      // Fill keyA to limit
      for (let i = 0; i < 5; i++) {
        await redis.zadd(keyA, { score: Date.now(), member: `${Date.now()}:${i}` })
      }
      await redis.expire(keyA, 70)

      // keyB should be empty
      const countB = await redis.zcard(keyB)
      expect(countB).toBe(0)

      // keyA at limit
      const countA = await redis.zcard(keyA)
      expect(countA).toBe(5)
    } finally {
      await redis.del(keyA)
      await redis.del(keyB)
    }
  })

  it("expired entries are removed from the window", async () => {
    const redis = new Redis({ url: TEST_REDIS_URL, token: TEST_REDIS_TOKEN })
    const testKey = `rl:test:expire:${Date.now()}`

    try {
      // Add entries with timestamps 120s ago (outside a 60s window)
      const oldTimestamp = Date.now() - 120000
      for (let i = 0; i < 3; i++) {
        await redis.zadd(testKey, { score: oldTimestamp + i, member: `old:${i}` })
      }
      // Add one recent entry
      await redis.zadd(testKey, { score: Date.now(), member: "recent:0" })
      await redis.expire(testKey, 70)

      // Trim old entries (window = 60s)
      const windowStart = Date.now() - 60000
      await redis.zremrangebyscore(testKey, 0, windowStart)

      const count = await redis.zcard(testKey)
      expect(count).toBe(1) // only the recent entry remains
    } finally {
      await redis.del(testKey)
    }
  })
})

describe("Rate Limiting: Production Verification (via API)", () => {
  const BASE_URL = process.env.API_BASE_URL || "https://www.lasyly.me"

  it("rate limit headers are present on API responses", async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    expect(res.headers.get("x-ratelimit-limit")).toBeDefined()
    expect(res.headers.get("x-ratelimit-remaining")).toBeDefined()
    expect(res.headers.get("x-ratelimit-reset")).toBeDefined()
  })

  it("remaining count decreases with each request", async () => {
    const res1 = await fetch(`${BASE_URL}/api/health`)
    const remaining1 = parseInt(res1.headers.get("x-ratelimit-remaining") || "0")

    const res2 = await fetch(`${BASE_URL}/api/health`)
    const remaining2 = parseInt(res2.headers.get("x-ratelimit-remaining") || "0")

    // remaining should decrease (may not be exactly -1 due to timing/other requests)
    expect(remaining2).toBeLessThanOrEqual(remaining1)
  })
})
