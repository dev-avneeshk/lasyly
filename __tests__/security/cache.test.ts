/**
 * Unit tests for lib/security/cache.ts
 * Tests key validation, sensitive data detection, thundering herd protection,
 * stale-while-revalidate, TTL jitter, and cache invalidation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  validateCacheKey,
  containsSensitiveData,
  cachedSecure,
  invalidateCache,
  invalidateCachePrefix,
  _clearCacheStore,
  _getCacheStoreSize,
  _getCacheEntry,
} from "@/lib/security/cache"
import { DEFAULT_CACHE_KEY_PATTERNS } from "@/lib/security/constants"
import type { CacheKeyPattern } from "@/lib/security/types"

describe("Cache Layer", () => {
  beforeEach(() => {
    _clearCacheStore()
    vi.restoreAllMocks()
  })

  describe("validateCacheKey", () => {
    const patterns: CacheKeyPattern[] = [
      { pattern: /^explore:/, description: "Explore data" },
      { pattern: /^scores:/, description: "Scores" },
      { pattern: /^room:\w+$/, description: "Room details" },
    ]

    it("accepts keys matching an allowed pattern", () => {
      expect(validateCacheKey("explore:featured", patterns)).toBe(true)
      expect(validateCacheKey("scores:nba:today", patterns)).toBe(true)
      expect(validateCacheKey("room:abc123", patterns)).toBe(true)
    })

    it("rejects keys not matching any allowed pattern", () => {
      expect(validateCacheKey("admin:secrets", patterns)).toBe(false)
      expect(validateCacheKey("unknown:key", patterns)).toBe(false)
      expect(validateCacheKey("", patterns)).toBe(false)
    })

    it("rejects empty key", () => {
      expect(validateCacheKey("", patterns)).toBe(false)
    })

    it("rejects when no patterns provided", () => {
      expect(validateCacheKey("explore:test", [])).toBe(false)
    })

    it("works with default cache key patterns", () => {
      expect(validateCacheKey("explore:featured", DEFAULT_CACHE_KEY_PATTERNS)).toBe(true)
      expect(validateCacheKey("props:nba", DEFAULT_CACHE_KEY_PATTERNS)).toBe(true)
      expect(validateCacheKey("malicious:key", DEFAULT_CACHE_KEY_PATTERNS)).toBe(false)
    })
  })

  describe("containsSensitiveData", () => {
    it("detects user ID + token combination", () => {
      expect(containsSensitiveData("user:abc123:token")).toBe(true)
      expect(containsSensitiveData("user_123:token_refresh")).toBe(true)
    })

    it("detects user ID + password combination", () => {
      expect(containsSensitiveData("user:abc:password_hash")).toBe(true)
    })

    it("detects user ID + secret combination", () => {
      expect(containsSensitiveData("user_id:secret_key")).toBe(true)
    })

    it("detects user ID + session combination", () => {
      expect(containsSensitiveData("user:xyz:session_data")).toBe(true)
    })

    it("detects UUID-based user identifiers with sensitive markers", () => {
      expect(
        containsSensitiveData(
          "cache:550e8400-e29b-41d4-a716-446655440000:token"
        )
      ).toBe(true)
    })

    it("allows keys without user identifiers", () => {
      expect(containsSensitiveData("explore:featured")).toBe(false)
      expect(containsSensitiveData("scores:nba:token_count")).toBe(false)
    })

    it("allows keys with user identifiers but no sensitive markers", () => {
      expect(containsSensitiveData("user:abc:profile")).toBe(false)
      expect(containsSensitiveData("user_123:dashboard")).toBe(false)
    })
  })

  describe("cachedSecure - basic caching", () => {
    it("fetches and caches data on first call", async () => {
      const fetcher = vi.fn().mockResolvedValue({ name: "test" })

      const result = await cachedSecure("explore:test", fetcher, { ttlMs: 5000 })

      expect(result).toEqual({ name: "test" })
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it("returns cached data on subsequent calls within TTL", async () => {
      const fetcher = vi.fn().mockResolvedValue({ name: "test" })

      await cachedSecure("explore:test", fetcher, { ttlMs: 5000 })
      const result = await cachedSecure("explore:test", fetcher, { ttlMs: 5000 })

      expect(result).toEqual({ name: "test" })
      expect(fetcher).toHaveBeenCalledTimes(1)
    })
  })

  describe("cachedSecure - thundering herd protection", () => {
    it("calls fetcher only once for concurrent requests", async () => {
      let resolvePromise: (value: string) => void
      const fetcherPromise = new Promise<string>((resolve) => {
        resolvePromise = resolve
      })
      const fetcher = vi.fn().mockReturnValue(fetcherPromise)

      // Fire multiple concurrent requests
      const p1 = cachedSecure("explore:herd", fetcher, { ttlMs: 5000 })
      const p2 = cachedSecure("explore:herd", fetcher, { ttlMs: 5000 })
      const p3 = cachedSecure("explore:herd", fetcher, { ttlMs: 5000 })

      // Resolve the single fetch
      resolvePromise!("shared-result")

      const [r1, r2, r3] = await Promise.all([p1, p2, p3])

      expect(r1).toBe("shared-result")
      expect(r2).toBe("shared-result")
      expect(r3).toBe("shared-result")
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it("propagates errors to all waiting callers", async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error("fetch failed"))

      const p1 = cachedSecure("explore:fail", fetcher, { ttlMs: 5000 })
      const p2 = cachedSecure("explore:fail", fetcher, { ttlMs: 5000 })

      await expect(p1).rejects.toThrow("fetch failed")
      await expect(p2).rejects.toThrow("fetch failed")
      expect(fetcher).toHaveBeenCalledTimes(1)
    })
  })

  describe("cachedSecure - TTL jitter", () => {
    it("applies jitter within 0-20% range", async () => {
      const fetcher = vi.fn().mockResolvedValue("data")

      await cachedSecure("explore:jitter", fetcher, {
        ttlMs: 10000,
        jitterPercent: 20,
      })

      const entry = _getCacheEntry<string>("explore:jitter")
      expect(entry).toBeDefined()
      expect(entry!.jitteredTtlMs).toBeGreaterThanOrEqual(10000)
      expect(entry!.jitteredTtlMs).toBeLessThanOrEqual(12000)
    })

    it("clamps jitter to max 20%", async () => {
      const fetcher = vi.fn().mockResolvedValue("data")

      await cachedSecure("explore:clamp", fetcher, {
        ttlMs: 10000,
        jitterPercent: 50, // Should be clamped to 20
      })

      const entry = _getCacheEntry<string>("explore:clamp")
      expect(entry!.jitteredTtlMs).toBeLessThanOrEqual(12000)
    })
  })

  describe("invalidateCache", () => {
    it("removes a specific cache entry", async () => {
      const fetcher = vi.fn().mockResolvedValue("data")
      await cachedSecure("explore:inv", fetcher, { ttlMs: 5000 })

      expect(_getCacheStoreSize()).toBe(1)
      invalidateCache("explore:inv")
      expect(_getCacheStoreSize()).toBe(0)
    })

    it("does nothing for non-existent keys", () => {
      invalidateCache("nonexistent")
      expect(_getCacheStoreSize()).toBe(0)
    })
  })

  describe("invalidateCachePrefix", () => {
    it("removes all entries matching a prefix", async () => {
      const fetcher = vi.fn().mockResolvedValue("data")
      await cachedSecure("explore:a", fetcher, { ttlMs: 5000 })
      await cachedSecure("explore:b", fetcher, { ttlMs: 5000 })
      await cachedSecure("scores:c", fetcher, { ttlMs: 5000 })

      expect(_getCacheStoreSize()).toBe(3)
      invalidateCachePrefix("explore:")
      expect(_getCacheStoreSize()).toBe(1)
      expect(_getCacheEntry("scores:c")).toBeDefined()
    })
  })
})
