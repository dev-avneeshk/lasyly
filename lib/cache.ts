/**
 * Redis-backed response cache with in-memory fallback.
 *
 * Strategy: cache-aside with stale-while-revalidate.
 * - Check Redis first (shared across all serverless instances)
 * - Fall back to in-memory if Redis is unavailable
 * - Serve stale data instantly, refresh in background
 *
 * This eliminates redundant Supabase queries for:
 * - Explore page (same data for all users, changes slowly)
 * - Scores (polled every 10s by many clients)
 * - Room details (read-heavy, write-rare)
 * - Profile data (changes infrequently)
 * - Leaderboard (expensive aggregation, shared)
 * - News (changes infrequently)
 * - Tipsters (expensive multi-query aggregation)
 *
 * For Supabase cost optimization:
 * - Each cache hit = 0 DB queries
 * - Reduces row reads by 90%+ for hot paths
 * - Works across serverless instances (Redis is shared state)
 */

import { getRedisClient } from "./redis"

// ─── In-Memory Fallback Store ────────────────────────────────────────────────

type MemoryCacheEntry<T> = {
  data: T
  timestamp: number
  ttl: number
}

const memoryCache = new Map<string, MemoryCacheEntry<unknown>>()

// Cleanup expired entries every 30 seconds
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl * 2) {
        memoryCache.delete(key)
      }
    }
    // Keep the invalidation-epoch map from growing without bound. An epoch only
    // matters while a read for that key is in flight or its memo entry is live,
    // so anything in neither map is safe to forget. Dropping an epoch that a
    // pending read still remembers fails safe: the mismatch just skips that
    // read's memo write.
    for (const key of invalidationEpochs.keys()) {
      if (!memoryCache.has(key) && !inflightReads.has(key)) {
        invalidationEpochs.delete(key)
      }
    }
  }, 30_000)
}

// ─── Redis Cache Helpers ─────────────────────────────────────────────────────

const CACHE_PREFIX = "cache:"

async function redisGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient()
  if (!redis) return null

  try {
    const value = await redis.get<T>(`${CACHE_PREFIX}${key}`)
    return value
  } catch (error) {
    console.warn(`[cache] Redis GET failed for key "${key}":`, error)
    return null
  }
}

async function redisSet<T>(key: string, data: T, ttlMs: number): Promise<boolean> {
  const redis = getRedisClient()
  if (!redis) return false

  try {
    // px = milliseconds TTL; store with 2x TTL for stale-while-revalidate window
    await redis.set(`${CACHE_PREFIX}${key}`, data, { px: ttlMs * 2 })
    return true
  } catch (error) {
    console.warn(`[cache] Redis SET failed for key "${key}":`, error)
    return false
  }
}

async function redisDel(key: string): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.del(`${CACHE_PREFIX}${key}`)
  } catch {
    // Best-effort invalidation
  }
}

// ─── Timestamp tracking (for stale-while-revalidate in Redis) ────────────────

const TIMESTAMP_PREFIX = "cache_ts:"

async function redisGetTimestamp(key: string): Promise<number | null> {
  const redis = getRedisClient()
  if (!redis) return null

  try {
    const ts = await redis.get<number>(`${TIMESTAMP_PREFIX}${key}`)
    return ts
  } catch {
    return null
  }
}

async function redisSetTimestamp(key: string, ttlMs: number): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.set(`${TIMESTAMP_PREFIX}${key}`, Date.now(), { px: ttlMs * 2 })
  } catch {
    // Best-effort
  }
}

// ─── In-flight refresh tracking (thundering herd protection) ─────────────────

/**
 * Same-instance dedup. Necessary but nowhere near sufficient on serverless: this
 * Map lives inside one lambda, so at TTL expiry every warm instance independently
 * decided it was the one to refresh. For /api/scores that meant each instance
 * firing 54 outbound ESPN requests (18 leagues x 3 dates); with 50 warm instances
 * that is ~2,700 requests to an unofficial API in one second. For /api/props it
 * meant ~42 Supabase queries and up to 30k rows per instance.
 *
 * `withRefreshLease` below adds the cross-instance half.
 */
const inflightRefreshes = new Map<string, Promise<unknown>>()

/**
 * Concurrent-READ coalescing, which is a different problem from refresh dedup
 * above and was the dominant cost of the props page.
 *
 * `inflightRefreshes` only covers misses and background refreshes. A plain cache
 * HIT went straight to Redis every time, so N concurrent callers asking for the
 * same key produced N round trips. `/api/props?sport=NFL&stat=all` fans out to
 * four parallel `computeNFLProps` calls that each read the same slate, the same
 * 1.9MB player-history blob and the same headshot map, and the defense layer
 * asked for one league table per (opponent, position) pair. Measured on the live
 * data set: **360 Redis GETs and 10.4MB transferred for a single fully warm
 * request**, which is where the ~17s `computeTimeMs` came from — not compute. The
 * engine's own CPU work is ~36ms.
 *
 * Keyed by cache key, holding the in-flight `[value, timestamp]` read so every
 * concurrent caller awaits one Redis round trip instead of issuing its own.
 */
const inflightReads = new Map<string, Promise<readonly [unknown, number | null]>>()

/**
 * Upper bound on how long this instance may serve a value out of local memory
 * without re-checking Redis.
 *
 * The window is `ttlMs / 10` capped here, so it is always proportional to the
 * freshness the caller asked for: live scores (10s TTL) memoize for 1s, prop
 * slates (3-10min) for the full 10s. That bounds the extra staleness this adds
 * to 10% of the declared TTL while still collapsing the hundreds of same-key
 * reads a single request makes.
 */
const LOCAL_MEMO_MAX_MS = 10_000

/** How long `key` may be served from local memory, given its declared TTL. */
function memoWindowFor(ttlMs: number): number {
  return Math.min(ttlMs / 10, LOCAL_MEMO_MAX_MS)
}

/**
 * Per-key invalidation counter, guarding a race the local memo would otherwise
 * introduce.
 *
 * Without it: a read fetches value V from Redis, an `invalidateCache(key)` lands
 * while that read is still in flight, and the read then resolves and writes V
 * into the memo — where it is served for the whole memo window despite having
 * been explicitly invalidated. Dropping the key from `inflightReads` does not
 * help, because the caller already holds the promise.
 *
 * So every read records the epoch it started in and refuses to populate the memo
 * if an invalidation bumped it in the meantime. The caller still receives V for
 * its own response (unchanged from the pre-memo behaviour); it just no longer
 * persists it for anyone else.
 */
const invalidationEpochs = new Map<string, number>()

function epochOf(key: string): number {
  return invalidationEpochs.get(key) ?? 0
}

function bumpEpoch(key: string): void {
  invalidationEpochs.set(key, epochOf(key) + 1)
}

/** Lease key namespace for cross-instance refresh coordination. */
const LEASE_PREFIX = "cache_lock:"

/**
 * How long a refresh lease is held. Long enough for the slowest fetcher
 * (~42 Supabase queries, or 54 ESPN calls at a 5s timeout each), short enough
 * that a crashed holder doesn't block refreshes for long.
 */
const LEASE_TTL_MS = 30_000

/**
 * Try to become the single instance responsible for refreshing `key`.
 *
 * Returns a release function on success, or null if someone else holds it.
 * Fails OPEN (grants the lease) when Redis is unavailable: this is a cache, and
 * a duplicated recomputation is a cost problem, not a correctness one. That is
 * the opposite of the game store's lock, which fails closed because there
 * correctness is at stake.
 */
async function acquireRefreshLease(key: string): Promise<(() => Promise<void>) | null> {
  const redis = getRedisClient()
  if (!redis) return async () => {}

  try {
    const res = await redis.set(`${LEASE_PREFIX}${key}`, "1", {
      nx: true,
      px: LEASE_TTL_MS,
    })
    if (res !== "OK") return null
    return async () => {
      try {
        await redis.del(`${LEASE_PREFIX}${key}`)
      } catch {
        // Expires on its own.
      }
    }
  } catch {
    return async () => {}
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ─── Core Cache Function ─────────────────────────────────────────────────────

/**
 * Get cached data or execute the fetcher.
 *
 * Flow:
 * 1. Check Redis for cached value
 * 2. If fresh (within TTL), return immediately
 * 3. If stale (within 2x TTL), return stale + refresh in background
 * 4. If miss, fetch synchronously and populate cache
 * 5. Falls back to in-memory if Redis is unavailable
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number
): Promise<T> {
  const redis = getRedisClient()

  // ── Redis path ──────────────────────────────────────────────────────────────
  if (redis) {
    try {
      // Local memo: skip Redis entirely for a key this instance just read.
      // Bounded by `memoWindowFor`, so it never exceeds the caller's freshness
      // budget by more than 10%.
      const memo = memoryCache.get(key) as MemoryCacheEntry<T> | undefined
      if (memo && Date.now() - memo.timestamp < memoWindowFor(ttlMs)) {
        return memo.data
      }

      // Epoch at the moment this read starts. Compared again before writing to
      // the memo, so an invalidation that lands mid-read wins.
      const startEpoch = epochOf(key)
      const memoize = (data: T, at: number) => {
        if (epochOf(key) !== startEpoch) return
        memoryCache.set(key, { data, timestamp: at, ttl: ttlMs })
      }

      // Coalesce concurrent reads of the same key into one round trip. Without
      // this, the four parallel stat computations behind `stat=all` each fetch
      // the same multi-megabyte blob.
      let read = inflightReads.get(key)
      if (!read) {
        read = (async () => {
          const [value, ts] = await Promise.all([redisGet<T>(key), redisGetTimestamp(key)])
          return [value, ts] as const
        })().finally(() => {
          inflightReads.delete(key)
        })
        inflightReads.set(key, read)
      }
      const [cachedData, timestamp] = (await read) as readonly [T | null, number | null]

      const now = Date.now()

      // Fresh hit
      if (cachedData !== null && timestamp !== null && now - timestamp < ttlMs) {
        // Memoize so the rest of this request (and the next few seconds of
        // requests on this instance) costs nothing.
        memoize(cachedData, now)
        return cachedData
      }

      // Stale hit — serve stale, refresh in background.
      // Only ONE instance across the whole fleet does the refresh; the rest just
      // serve the stale value they already have, which is exactly the right
      // outcome and costs them nothing.
      if (cachedData !== null && timestamp !== null && now - timestamp < ttlMs * 2) {
        if (!inflightRefreshes.has(key)) {
          const refreshPromise = (async () => {
            const release = await acquireRefreshLease(key)
            if (!release) return // another instance is on it
            try {
              const data = await fetcher()
              await Promise.all([
                redisSet(key, data, ttlMs),
                redisSetTimestamp(key, ttlMs),
              ])
              return data
            } finally {
              await release()
            }
          })()
            .catch(() => {})
            .finally(() => {
              inflightRefreshes.delete(key)
            })
          inflightRefreshes.set(key, refreshPromise)
        }
        // Memoize the stale value too. Otherwise a key sitting in its
        // stale-while-revalidate window — the common state for a slate whose
        // TTL just lapsed — keeps paying full Redis round trips for every one
        // of the hundreds of same-key reads a request makes.
        memoize(cachedData, now)
        return cachedData
      }

      // Hard miss — nothing to serve, so someone must compute synchronously.
      const existing = inflightRefreshes.get(key)
      if (existing) {
        return (await existing) as T
      }

      const fetchPromise = (async (): Promise<T> => {
        const release = await acquireRefreshLease(key)

        if (!release) {
          // Another instance is already computing this. Give it a moment and
          // read its result rather than duplicating the work — this is what
          // collapses a cold-cache stampede into a single computation.
          for (let attempt = 0; attempt < 5; attempt++) {
            await sleep(200)
            const [data, ts] = await Promise.all([
              redisGet<T>(key),
              redisGetTimestamp(key),
            ])
            if (data !== null && ts !== null) return data
          }
          // The holder died or is slower than we're willing to wait. Compute
          // without the lease rather than failing the request.
          const data = await fetcher()
          await Promise.all([redisSet(key, data, ttlMs), redisSetTimestamp(key, ttlMs)])
          return data
        }

        try {
          const data = await fetcher()
          await Promise.all([redisSet(key, data, ttlMs), redisSetTimestamp(key, ttlMs)])
          return data
        } finally {
          await release()
        }
      })()

      inflightRefreshes.set(key, fetchPromise)

      try {
        const data = await fetchPromise
        memoize(data, Date.now())
        return data
      } finally {
        inflightRefreshes.delete(key)
      }
    } catch (error) {
      // Redis failed entirely — fall through to in-memory
      console.warn("[cache] Redis path failed, falling back to memory:", error)
    }
  }

  // ── In-memory fallback path ─────────────────────────────────────────────────
  const now = Date.now()
  const existing = memoryCache.get(key) as MemoryCacheEntry<T> | undefined

  // Fresh cache hit
  if (existing && now - existing.timestamp < existing.ttl) {
    return existing.data
  }

  // Stale cache — return stale data but refresh in background
  if (existing && now - existing.timestamp < existing.ttl * 2) {
    if (!inflightRefreshes.has(key)) {
      const refreshPromise = fetcher()
        .then((data) => {
          memoryCache.set(key, { data, timestamp: Date.now(), ttl: ttlMs })
          return data
        })
        .catch(() => {})
        .finally(() => {
          inflightRefreshes.delete(key)
        })
      inflightRefreshes.set(key, refreshPromise)
    }
    return existing.data
  }

  // No cache — fetch fresh
  const data = await fetcher()
  memoryCache.set(key, { data, timestamp: now, ttl: ttlMs })
  return data
}

// ─── Cache Invalidation ──────────────────────────────────────────────────────

/**
 * Invalidate a specific cache key (both Redis and in-memory).
 */
export async function invalidateCache(key: string): Promise<void> {
  memoryCache.delete(key)
  // Bump the epoch and drop any in-flight read: the epoch stops a read that is
  // already pending from writing its now-invalidated value into the memo once it
  // resolves, and the delete stops new callers from joining that read.
  bumpEpoch(key)
  inflightReads.delete(key)
  await redisDel(key)
}

/**
 * Invalidate all cache keys matching a prefix.
 * Note: For Redis, this uses SCAN which is safe for production.
 */
export async function invalidateCachePrefix(prefix: string): Promise<void> {
  // In-memory: clear the local memo and bump the epoch of every matching key,
  // for the same reason as invalidateCache above. Epochs are bumped for keys
  // seen in either map, so a read already in flight cannot repopulate the memo
  // after this returns.
  const matching = new Set<string>()
  for (const key of memoryCache.keys()) if (key.startsWith(prefix)) matching.add(key)
  for (const key of inflightReads.keys()) if (key.startsWith(prefix)) matching.add(key)
  for (const key of matching) {
    memoryCache.delete(key)
    inflightReads.delete(key)
    bumpEpoch(key)
  }

  // Redis — scan and delete matching keys
  const redis = getRedisClient()
  if (!redis) return

  try {
    let cursor = 0
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: `${CACHE_PREFIX}${prefix}*`,
        count: 100,
      })
      cursor = Number(nextCursor)

      if (keys.length > 0) {
        const pipeline = redis.pipeline()
        for (const k of keys) {
          pipeline.del(k)
        }
        // Also delete timestamps
        for (const k of keys) {
          const rawKey = (k as string).replace(CACHE_PREFIX, "")
          pipeline.del(`${TIMESTAMP_PREFIX}${rawKey}`)
        }
        await pipeline.exec()
      }
    } while (cursor !== 0)
  } catch (error) {
    console.warn("[cache] Redis prefix invalidation failed:", error)
  }
}

// ─── TTL Presets (in milliseconds) ───────────────────────────────────────────

export const CACHE_TTL = {
  /** Explore page: 60 seconds (same for all users) */
  explore: 60_000,
  /** Scores: 10 seconds (matches the polling interval) */
  scores: 10_000,
  /** Room detail: 30 seconds */
  roomDetail: 30_000,
  /** Profile: 60 seconds */
  profile: 60_000,
  /** Dashboard stats: 120 seconds (expensive aggregations) */
  dashboard: 120_000,
  /** Feed: 15 seconds per user */
  feed: 15_000,
  /** Leaderboard: 5 minutes (expensive, shared across all users) */
  leaderboard: 300_000,
  /** Tipsters: 5 minutes (expensive multi-query aggregation) */
  tipsters: 300_000,
  /** News: 5 minutes (changes infrequently) */
  news: 300_000,
  /** Props/analytics: 2 minutes */
  props: 120_000,
  /** Player stats: 3 minutes */
  playerStats: 180_000,
} as const
