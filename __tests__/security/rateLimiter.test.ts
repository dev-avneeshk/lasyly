import { describe, it, expect, beforeEach, afterAll } from "vitest"
import {
  checkRateLimit,
  checkIPBlock,
  blockIP,
  trackIPRequest,
  applyRateLimitHeaders,
  _resetStores,
  _stopCleanup,
} from "@/lib/security/rateLimiter"
import type { RateLimitResult } from "@/lib/security/types"

afterAll(() => {
  _stopCleanup()
})

describe("rateLimiter", () => {
  beforeEach(() => {
    _resetStores()
  })

  describe("checkRateLimit", () => {
    it("allows requests within the limit", () => {
      const config = { maxRequests: 5, windowMs: 60_000 }
      const result = checkRateLimit("user:1", config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
      expect(result.limit).toBe(5)
      expect(result.retryAfterSeconds).toBe(0)
    })

    it("blocks requests exceeding the limit", () => {
      const config = { maxRequests: 3, windowMs: 60_000 }

      checkRateLimit("user:2", config)
      checkRateLimit("user:2", config)
      checkRateLimit("user:2", config)

      const result = checkRateLimit("user:2", config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfterSeconds).toBeGreaterThan(0)
    })

    it("tracks remaining count correctly", () => {
      const config = { maxRequests: 5, windowMs: 60_000 }

      const r1 = checkRateLimit("user:3", config)
      expect(r1.remaining).toBe(4)

      const r2 = checkRateLimit("user:3", config)
      expect(r2.remaining).toBe(3)

      const r3 = checkRateLimit("user:3", config)
      expect(r3.remaining).toBe(2)
    })

    it("isolates rate limits by key", () => {
      const config = { maxRequests: 2, windowMs: 60_000 }

      checkRateLimit("user:a", config)
      checkRateLimit("user:a", config)

      // user:a is now at limit
      const resultA = checkRateLimit("user:a", config)
      expect(resultA.allowed).toBe(false)

      // user:b should still be allowed
      const resultB = checkRateLimit("user:b", config)
      expect(resultB.allowed).toBe(true)
    })

    it("returns correct limit value", () => {
      const config = { maxRequests: 60, windowMs: 60_000 }
      const result = checkRateLimit("user:4", config)
      expect(result.limit).toBe(60)
    })

    it("provides resetAtSeconds based on window size", () => {
      const config = { maxRequests: 10, windowMs: 60_000 }
      const result = checkRateLimit("user:5", config)
      expect(result.resetAtSeconds).toBe(60)
    })
  })

  describe("checkIPBlock", () => {
    it("returns not blocked for unknown IPs", () => {
      const result = checkIPBlock("192.168.1.1")
      expect(result.blocked).toBe(false)
      expect(result.retryAfterSeconds).toBe(0)
    })

    it("returns blocked for a blocked IP", () => {
      blockIP("10.0.0.1", 900_000, "test block")
      const result = checkIPBlock("10.0.0.1")
      expect(result.blocked).toBe(true)
      expect(result.retryAfterSeconds).toBeGreaterThan(0)
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(900)
    })

    it("returns not blocked after block expires", () => {
      // Block for 0ms (already expired)
      blockIP("10.0.0.2", -1, "expired block")
      const result = checkIPBlock("10.0.0.2")
      expect(result.blocked).toBe(false)
    })
  })

  describe("blockIP", () => {
    it("blocks an IP for the specified duration", () => {
      blockIP("172.16.0.1", 60_000, "abuse detected")
      const result = checkIPBlock("172.16.0.1")
      expect(result.blocked).toBe(true)
    })

    it("stores the reason for the block", () => {
      blockIP("172.16.0.2", 60_000, "brute force attempt")
      // Verify block is active (reason is internal, but block should work)
      const result = checkIPBlock("172.16.0.2")
      expect(result.blocked).toBe(true)
    })
  })

  describe("trackIPRequest", () => {
    it("does not block IPs under the threshold", () => {
      // Standard limit is 60, threshold is 5× = 300
      for (let i = 0; i < 100; i++) {
        trackIPRequest("192.168.1.100")
      }
      const result = checkIPBlock("192.168.1.100")
      expect(result.blocked).toBe(false)
    })

    it("auto-blocks IPs exceeding 5× standard limit (300 req/min)", () => {
      // Exceed 300 requests
      for (let i = 0; i <= 300; i++) {
        trackIPRequest("192.168.1.200")
      }
      const result = checkIPBlock("192.168.1.200")
      expect(result.blocked).toBe(true)
      // Should be blocked for ~15 minutes
      expect(result.retryAfterSeconds).toBeGreaterThan(800)
      expect(result.retryAfterSeconds).toBeLessThanOrEqual(900)
    })

    it("returns true when auto-block is triggered", () => {
      for (let i = 0; i < 300; i++) {
        const blocked = trackIPRequest("192.168.1.201")
        expect(blocked).toBe(false)
      }
      // The 301st request should trigger the block
      const blocked = trackIPRequest("192.168.1.201")
      expect(blocked).toBe(true)
    })
  })

  describe("applyRateLimitHeaders", () => {
    it("sets all rate limit headers for allowed requests", () => {
      const headers = new Map<string, string>()
      const response = {
        headers: { set: (name: string, value: string) => headers.set(name, value) },
      }

      const result: RateLimitResult = {
        allowed: true,
        remaining: 55,
        limit: 60,
        retryAfterSeconds: 0,
        resetAtSeconds: 60,
      }

      applyRateLimitHeaders(response, result)

      expect(headers.get("X-RateLimit-Limit")).toBe("60")
      expect(headers.get("X-RateLimit-Remaining")).toBe("55")
      expect(headers.get("X-RateLimit-Reset")).toBe("60")
      expect(headers.has("Retry-After")).toBe(false)
    })

    it("sets Retry-After header for blocked requests", () => {
      const headers = new Map<string, string>()
      const response = {
        headers: { set: (name: string, value: string) => headers.set(name, value) },
      }

      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        limit: 60,
        retryAfterSeconds: 45,
        resetAtSeconds: 60,
      }

      applyRateLimitHeaders(response, result)

      expect(headers.get("X-RateLimit-Limit")).toBe("60")
      expect(headers.get("X-RateLimit-Remaining")).toBe("0")
      expect(headers.get("X-RateLimit-Reset")).toBe("60")
      expect(headers.get("Retry-After")).toBe("45")
    })
  })
})
