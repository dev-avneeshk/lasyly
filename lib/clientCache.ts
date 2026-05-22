/**
 * Client-side fetch cache for API responses.
 * Prevents redundant network requests when navigating between pages
 * or when components remount (e.g., filter changes causing re-renders).
 *
 * Uses a simple in-memory Map with TTL-based expiration.
 * Data persists for the lifetime of the browser tab/session.
 */

type CacheEntry<T> = {
  data: T
  timestamp: number
  ttl: number
}

const clientCache = new Map<string, CacheEntry<unknown>>()

/**
 * Synchronously read from cache without fetching.
 * Returns cached data if it exists and is within 2x TTL (stale-while-revalidate window).
 * Use this to initialize component state instantly on remount.
 *
 * @param url - The URL cache key
 * @param method - HTTP method (default: "GET")
 * @returns Cached data or null if not available
 */
export function readCache<T>(url: string, method: string = "GET"): T | null {
  const cacheKey = `${method}:${url}`
  const existing = clientCache.get(cacheKey) as CacheEntry<T> | undefined
  if (!existing) return null

  const now = Date.now()
  // Return data if within 5x TTL (generous window for instant display)
  if (now - existing.timestamp < existing.ttl * 5) {
    return existing.data
  }
  return null
}

/**
 * Fetch with client-side caching.
 * Returns cached data if fresh, otherwise fetches and caches the result.
 *
 * @param url - The URL to fetch
 * @param ttlMs - Cache TTL in milliseconds (default: 60 seconds)
 * @param options - Optional fetch options (method, headers, etc.)
 */
export async function cachedFetch<T>(
  url: string,
  ttlMs: number = 60_000,
  options?: RequestInit
): Promise<T> {
  const cacheKey = `${options?.method ?? "GET"}:${url}`
  const now = Date.now()
  const existing = clientCache.get(cacheKey) as CacheEntry<T> | undefined

  // Fresh cache hit — return immediately
  if (existing && now - existing.timestamp < existing.ttl) {
    return existing.data
  }

  // Stale but within grace period (3x TTL) — return stale, refresh in background
  if (existing && now - existing.timestamp < existing.ttl * 3) {
    // Background refresh
    fetch(url, options)
      .then((res) => res.json())
      .then((data) => {
        clientCache.set(cacheKey, { data, timestamp: Date.now(), ttl: ttlMs })
      })
      .catch(() => {})
    return existing.data
  }

  // No cache or expired — fetch fresh
  const res = await fetch(url, options)
  const data = await res.json()
  clientCache.set(cacheKey, { data, timestamp: now, ttl: ttlMs })
  return data
}

/**
 * Invalidate a specific cache entry.
 */
export function invalidateClientCache(url: string, method: string = "GET"): void {
  clientCache.delete(`${method}:${url}`)
}

/**
 * Invalidate all cache entries matching a URL prefix.
 */
export function invalidateClientCachePrefix(prefix: string): void {
  for (const key of clientCache.keys()) {
    if (key.includes(prefix)) {
      clientCache.delete(key)
    }
  }
}

/**
 * Clear the entire client cache.
 */
export function clearClientCache(): void {
  clientCache.clear()
}

// Cleanup expired entries every 60 seconds
if (typeof window !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of clientCache.entries()) {
      // Remove entries older than 3x TTL
      if (now - entry.timestamp > entry.ttl * 3) {
        clientCache.delete(key)
      }
    }
  }, 60_000)
}
