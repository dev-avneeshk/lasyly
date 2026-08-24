/**
 * Tests for the distributed rate limiter (lib/rateLimit.ts).
 *
 * Since Redis isn't available in the test environment, these tests exercise
 * the in-memory fallback path. The Redis path uses the same sliding window
 * algorithm but backed by sorted sets — the business logic (allow/deny
 * decisions, remaining count, retryAfterMs) is identical.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock getRedisClient to return null (forces in-memory path)
vi.mock("@/lib/redis", () => ({
  getRedisClient: () => null,
}))

// Dynamic import after mock is set up
const { checkRateLimit, checkRateLimitSync, RATE_LIMITS } = await import("@/lib/rateLimit")

describe("Distributed Rate Limiter (in-memory fallback)", () => {
  describe("checkRateLimit (async)", () => {
    it("allows requests within the limit", async () => {
      const config = { maxRequests: 5, windowMs: 60_000 }
      const result = await checkRateLimit(`test:async:${Date.now()}`, config)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
      expect(result.retryAfterMs).toBe(0)
    })

    it("blocks requests exceeding the limit", async () => {
      const key = `test:block:${Date.now()}`
      const config = { maxRequests: 3, windowMs: 60_000 }

      await checkRateLimit(key, config)
      await checkRateLimit(key, config)
      await checkRateLimit(key, config)

      const result = await checkRateLimit(key, config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfterMs).toBeGreaterThan(0)
    })

    it("tracks remaining count correctly", async () => {
      const key = `test:remaining:${Date.now()}`
      const config = { maxRequests: 5, windowMs: 60_000 }

      const r1 = await checkRateLimit(key, config)
      expect(r1.remaining).toBe(4)

      const r2 = await checkRateLimit(key, config)
      expect(r2.remaining).toBe(3)

      const r3 = await checkRateLimit(key, config)
      expect(r3.remaining).toBe(2)
    })

    it("uses different buckets for different keys", async () => {
      const config = { maxRequests: 2, windowMs: 60_000 }
      const ts = Date.now()

      await checkRateLimit(`user:a:${ts}`, config)
      await checkRateLimit(`user:a:${ts}`, config)

      // user:a is now at limit
      const blocked = await checkRateLimit(`user:a:${ts}`, config)
      expect(blocked.allowed).toBe(false)

      // user:b is unaffected
      const allowed = await checkRateLimit(`user:b:${ts}`, config)
      expect(allowed.allowed).toBe(true)
    })
  })

  describe("checkRateLimitSync", () => {
    it("allows requests within the limit", () => {
      const config = { maxRequests: 3, windowMs: 60_000 }
      const key = `test:sync:${Date.now()}`
      const result = checkRateLimitSync(key, config)
      expect(result.allowed).toBe(true)
    })

    it("blocks requests exceeding the limit", () => {
      const key = `test:sync-block:${Date.now()}`
      const config = { maxRequests: 2, windowMs: 60_000 }

      checkRateLimitSync(key, config)
      checkRateLimitSync(key, config)

      const result = checkRateLimitSync(key, config)
      expect(result.allowed).toBe(false)
    })
  })

  describe("RATE_LIMITS presets", () => {
    it("chat limit is 1 per 2 seconds", () => {
      expect(RATE_LIMITS.chat.maxRequests).toBe(1)
      expect(RATE_LIMITS.chat.windowMs).toBe(2000)
    })

    it("wallet limit is 3 per minute", () => {
      expect(RATE_LIMITS.wallet.maxRequests).toBe(3)
      expect(RATE_LIMITS.wallet.windowMs).toBe(60000)
    })

    it("auth limit is 5 per minute", () => {
      expect(RATE_LIMITS.auth.maxRequests).toBe(5)
      expect(RATE_LIMITS.auth.windowMs).toBe(60000)
    })

    it("room create limit is 5 per hour", () => {
      expect(RATE_LIMITS.roomCreate.maxRequests).toBe(5)
      expect(RATE_LIMITS.roomCreate.windowMs).toBe(3600000)
    })
  })

  describe("Business-level rate limit scenarios", () => {
    it("chat: blocks rapid messages from same user in same room", async () => {
      const key = `chat:user123:room456:${Date.now()}`
      const config = RATE_LIMITS.chat

      const first = await checkRateLimit(key, config)
      expect(first.allowed).toBe(true)

      const second = await checkRateLimit(key, config)
      expect(second.allowed).toBe(false)
    })

    it("wallet: allows 3 operations then blocks", async () => {
      const key = `wallet:user789:${Date.now()}`
      const config = RATE_LIMITS.wallet

      expect((await checkRateLimit(key, config)).allowed).toBe(true)
      expect((await checkRateLimit(key, config)).allowed).toBe(true)
      expect((await checkRateLimit(key, config)).allowed).toBe(true)
      expect((await checkRateLimit(key, config)).allowed).toBe(false)
    })

    it("signup: allows 5 attempts then blocks", async () => {
      const key = `signup:192.168.1.1:${Date.now()}`
      const config = RATE_LIMITS.auth

      for (let i = 0; i < 5; i++) {
        expect((await checkRateLimit(key, config)).allowed).toBe(true)
      }
      expect((await checkRateLimit(key, config)).allowed).toBe(false)
    })
  })
})
