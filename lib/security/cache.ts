/**
 * Hardened cache layer with key validation, thundering herd protection,
 * stale-while-revalidate, and TTL jitter.
 *
 * Security features:
 * - Cache key allowlist validation (prevents cache poisoning)
 * - Sensitive data detection (prevents caching tokens/passwords)
 * - Single-flight thundering herd protection (shared Promise)
 * - Stale-while-revalidate with bounded staleness window
 * - TTL jitter to prevent coordinated cache stampedes
 */

import type { CacheConfig, CacheKeyPattern } from "./types"
import {
  DEFAULT_CACHE_JITTER_PERCENT,
  DEFAULT_STALE_WINDOW_MS,
  DEFAULT_THUNDERING_HERD_TIMEOUT_MS,
  SENSITIVE_DATA_MARKERS,
} from "./constants"

// ─── Cache Entry Data Model ──────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttlMs: number
  jitteredTtlMs: number
  refreshing: boolean
  refreshPromise?: Promise<T>
}

// ─── In-Memory Store ─────────────────────────────────────────────────────────

const store = new Map<string, CacheEntry<unknown>>()

// ─── Key Validation ──────────────────────────────────────────────────────────

/**
 * Validates a cache key against an allowlist of regex patterns.
 * Returns true if the key matches at least one allowed pattern.
 */
export function validateCacheKey(
  key: string,
  allowedPatterns: CacheKeyPattern[]
): boolean {
  if (!key || allowedPatterns.length === 0) {
    return false
  }
  return allowedPatterns.some((entry) => entry.pattern.test(key))
}

/**
 * Checks if a cache key contains a user identifier combined with a sensitive
 * data marker. Keys matching this pattern must never be cached.
 *
 * A user identifier is detected by patterns like:
 * - "user_<id>", "user:<id>", "userId:<id>"
 * - UUID-like segments (8-4-4-4-12 hex)
 *
 * Sensitive markers: token, password, secret, session
 */
export function containsSensitiveData(key: string): boolean {
  const lowerKey = key.toLowerCase()

  // Check for user identifier patterns
  const hasUserIdentifier =
    /user[_:\-]?\w+/i.test(key) ||
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(key)

  if (!hasUserIdentifier) {
    return false
  }

  // Check for sensitive data markers
  return SENSITIVE_DATA_MARKERS.some((marker) => lowerKey.includes(marker))
}

// ─── TTL Jitter ──────────────────────────────────────────────────────────────

/**
 * Applies random jitter to a TTL value.
 * Jitter adds 0–jitterPercent% to the base TTL.
 * Result is always in range [ttlMs, ttlMs * (1 + jitterPercent/100)].
 */
function applyJitter(ttlMs: number, jitterPercent: number): number {
  const clampedJitter = Math.max(0, Math.min(20, jitterPercent))
  const jitterFraction = (Math.random() * clampedJitter) / 100
  return Math.round(ttlMs * (1 + jitterFraction))
}

// ─── Core Cache Function ─────────────────────────────────────────────────────

/**
 * Secure caching with thundering herd protection, stale-while-revalidate,
 * and TTL jitter.
 *
 * Behavior:
 * 1. If entry is fresh (within jitteredTtlMs), return cached data.
 * 2. If entry is stale but within staleness window, return stale data and
 *    trigger a single background refresh (stale-while-revalidate).
 * 3. If entry is expired beyond staleness window or missing, fetch synchronously
 *    with thundering herd protection (single-flight shared Promise).
 * 4. If fetcher fails during thundering herd, all waiters receive the error.
 * 5. If background refresh fails, stale data continues to be served until
 *    staleness window expires.
 */
export async function cachedSecure<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: Partial<CacheConfig> & { ttlMs: number }
): Promise<T> {
  const fullConfig: CacheConfig = {
    ttlMs: config.ttlMs,
    jitterPercent: config.jitterPercent ?? DEFAULT_CACHE_JITTER_PERCENT,
    staleWindowMs: config.staleWindowMs ?? DEFAULT_STALE_WINDOW_MS,
    thunderingHerdTimeoutMs:
      config.thunderingHerdTimeoutMs ?? DEFAULT_THUNDERING_HERD_TIMEOUT_MS,
  }

  const now = Date.now()
  const existing = store.get(key) as CacheEntry<T> | undefined

  // Case 1: Fresh cache hit
  if (existing && now - existing.timestamp < existing.jitteredTtlMs) {
    return existing.data
  }

  // Case 2: Stale but within staleness window — serve stale, refresh in background
  if (
    existing &&
    now - existing.timestamp < existing.jitteredTtlMs + fullConfig.staleWindowMs
  ) {
    if (!existing.refreshing) {
      existing.refreshing = true
      existing.refreshPromise = fetcher()
        .then((data) => {
          const jitteredTtl = applyJitter(
            fullConfig.ttlMs,
            fullConfig.jitterPercent
          )
          store.set(key, {
            data,
            timestamp: Date.now(),
            ttlMs: fullConfig.ttlMs,
            jitteredTtlMs: jitteredTtl,
            refreshing: false,
          })
          return data
        })
        .catch(() => {
          // Background refresh failed — keep serving stale data
          existing.refreshing = false
          existing.refreshPromise = undefined
          return existing.data
        })
    }
    return existing.data
  }

  // Case 3: Expired beyond staleness window or cache miss
  // Thundering herd protection: if a refresh is already in flight, share it
  if (existing?.refreshing && existing.refreshPromise) {
    return withTimeout(existing.refreshPromise, fullConfig.thunderingHerdTimeoutMs)
  }

  // Start a new single-flight fetch
  const entry: CacheEntry<T> = {
    data: undefined as unknown as T,
    timestamp: 0,
    ttlMs: fullConfig.ttlMs,
    jitteredTtlMs: 0,
    refreshing: true,
    refreshPromise: undefined,
  }

  const fetchPromise = fetcher()
    .then((data) => {
      const jitteredTtl = applyJitter(fullConfig.ttlMs, fullConfig.jitterPercent)
      entry.data = data
      entry.timestamp = Date.now()
      entry.jitteredTtlMs = jitteredTtl
      entry.refreshing = false
      entry.refreshPromise = undefined
      store.set(key, entry)
      return data
    })
    .catch((error) => {
      // Fetcher failed — remove the in-flight entry, do NOT cache
      store.delete(key)
      throw error
    })

  entry.refreshPromise = fetchPromise
  store.set(key, entry)

  return withTimeout(fetchPromise, fullConfig.thunderingHerdTimeoutMs)
}

// ─── Cache Invalidation ──────────────────────────────────────────────────────

/**
 * Invalidate a specific cache key.
 */
export function invalidateCache(key: string): void {
  store.delete(key)
}

/**
 * Invalidate all cache keys matching a given prefix.
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key)
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Wraps a promise with a timeout. Rejects if the promise doesn't resolve
 * within the specified duration.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Cache fetch timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

// ─── Testing Utilities ───────────────────────────────────────────────────────

/**
 * Clears the entire cache store. For testing purposes only.
 * @internal
 */
export function _clearCacheStore(): void {
  store.clear()
}

/**
 * Returns the current size of the cache store. For testing purposes only.
 * @internal
 */
export function _getCacheStoreSize(): number {
  return store.size
}

/**
 * Returns a cache entry for inspection. For testing purposes only.
 * @internal
 */
export function _getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  return store.get(key) as CacheEntry<T> | undefined
}
