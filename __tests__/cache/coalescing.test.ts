/**
 * Regression tests for the read-coalescing + local-memo layer in lib/cache.ts.
 *
 * These exist because of a concrete production failure: a single warm
 * /api/props?sport=NFL&stat=all request issued 360 Redis GETs and pulled 10.4MB
 * over the wire, because every same-key read went to Redis independently. The
 * four parallel stat computations each re-read the same 1.9MB player-history
 * blob, and the defense layer asked for the same league table once per
 * (opponent, position) pair. The engine's own CPU work was ~36ms; the rest was
 * round trips.
 *
 * What must hold:
 *  1. Concurrent reads of one key collapse into a single Redis round trip.
 *  2. A key just read is served from local memory for a bounded window.
 *  3. That window never exceeds 10% of the caller's declared TTL, so the memo
 *     cannot make data staler than the TTL already allows.
 *  4. Invalidation clears the memo — otherwise a write would not be visible.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Countable in-process Redis stub ─────────────────────────────────────────

const counts = { get: 0, set: 0, del: 0 }
const store = new Map<string, unknown>()

vi.mock("@/lib/redis", () => ({
  getRedisClient: () => ({
    async get(key: string) {
      counts.get++
      // Snapshot before yielding, the way a real network read works: the server
      // has already answered with this value and the response is in flight. This
      // is what makes the "invalidation lands mid-read" race reproducible.
      const snapshot = store.get(key) ?? null
      // Yield a macrotask so concurrent callers genuinely overlap.
      await new Promise((r) => setTimeout(r, 5))
      return snapshot
    },
    async set(key: string, val: unknown, opts?: { nx?: boolean }) {
      counts.set++
      await new Promise((r) => setTimeout(r, 5))
      if (opts?.nx && store.has(key)) return null
      store.set(key, val)
      return "OK"
    },
    async del(key: string) {
      counts.del++
      store.delete(key)
      return 1
    },
    async scan() {
      return [0, []] as [number, string[]]
    },
    pipeline: () => ({ del() {}, async exec() {} }),
  }),
}))

const { cached, invalidateCache } = await import("@/lib/cache")

beforeEach(() => {
  counts.get = 0
  counts.set = 0
  counts.del = 0
  store.clear()
})

describe("cached() read coalescing", () => {
  it("collapses N concurrent reads of the same key into one Redis round trip", async () => {
    const key = `coalesce-${Math.random()}`
    let fetcherCalls = 0
    const fetcher = async () => {
      fetcherCalls++
      return { value: 42 }
    }

    // Prime the entry.
    await cached(key, fetcher, 60_000)
    const getsAfterPrime = counts.get

    // 50 concurrent readers, memo bypassed by using a key we then invalidate
    // from memory only — so this measures the coalescing path specifically.
    await invalidateCache(key)
    store.set(`cache:${key}`, { value: 42 })
    store.set(`cache_ts:${key}`, Date.now())

    const results = await Promise.all(
      Array.from({ length: 50 }, () => cached(key, fetcher, 60_000))
    )

    expect(results).toHaveLength(50)
    expect(results.every((r) => r.value === 42)).toBe(true)
    // One value GET + one timestamp GET for all 50 callers, not 100.
    expect(counts.get - getsAfterPrime).toBe(2)
    // And the fetcher was never re-run, since the entry was fresh.
    expect(fetcherCalls).toBe(1)
  })

  it("runs the fetcher once when many callers miss concurrently", async () => {
    const key = `miss-${Math.random()}`
    let fetcherCalls = 0
    const fetcher = async () => {
      fetcherCalls++
      await new Promise((r) => setTimeout(r, 20))
      return { n: fetcherCalls }
    }

    const results = await Promise.all(
      Array.from({ length: 25 }, () => cached(key, fetcher, 60_000))
    )

    expect(fetcherCalls).toBe(1)
    expect(results.every((r) => r.n === 1)).toBe(true)
  })
})

describe("cached() local memo", () => {
  it("serves a just-read key from memory without touching Redis", async () => {
    const key = `memo-${Math.random()}`
    await cached(key, async () => ({ v: 1 }), 60_000) // TTL 60s -> 6s memo
    const getsAfterFirst = counts.get

    for (let i = 0; i < 20; i++) {
      const r = await cached(key, async () => ({ v: 1 }), 60_000)
      expect(r.v).toBe(1)
    }

    expect(counts.get - getsAfterFirst).toBe(0)
  })

  it("keeps the memo window within 10% of the declared TTL", async () => {
    // TTL 100ms -> memo window 10ms. After 40ms the memo must have lapsed and
    // the value must be re-read from Redis rather than served locally.
    const key = `window-${Math.random()}`
    await cached(key, async () => ({ v: 1 }), 100)
    const getsAfterFirst = counts.get

    await new Promise((r) => setTimeout(r, 40))
    await cached(key, async () => ({ v: 1 }), 100)

    expect(counts.get).toBeGreaterThan(getsAfterFirst)
  })

  it("does not let the memo hide an invalidation", async () => {
    const key = `invalidate-${Math.random()}`
    await cached(key, async () => ({ v: "old" }), 60_000)

    await invalidateCache(key)

    const after = await cached(key, async () => ({ v: "new" }), 60_000)
    expect(after.v).toBe("new")
  })

  it("does not let an in-flight read repopulate the memo after invalidation", async () => {
    // A read that started before the invalidation must not resolve afterwards
    // and write the stale value back into the local memo.
    const key = `inflight-invalidate-${Math.random()}`
    store.set(`cache:${key}`, { v: "old" })
    store.set(`cache_ts:${key}`, Date.now())

    const inFlight = cached(key, async () => ({ v: "fetched" }), 60_000)
    await invalidateCache(key) // lands while the read above is still pending
    await inFlight.catch(() => undefined)

    const after = await cached(key, async () => ({ v: "new" }), 60_000)
    expect(after.v).toBe("new")
  })
})
