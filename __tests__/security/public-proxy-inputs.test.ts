import { describe, it, expect, vi, beforeEach } from "vitest"

// DB-23: raw team params went into a PostgREST `.or()` filter string (filter
// injection), uncached, two queries per call. RT-12: /api/highlights took any
// `q` (unbounded, un-normalized cache keys) with no limit on YouTube spend.
const st = vi.hoisted(() => ({ ors: [] as string[], keys: [] as string[], allowed: true, limiterCalls: 0, scoreCalls: 0 }))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const c: Record<string, unknown> = {
      from: () => c, select: () => c, gte: () => c, eq: () => c, order: () => c,
      or: (f: string) => (st.ors.push(f), c),
      then: (r: (v: unknown) => unknown) =>
        r({
          data: [
            { home_team: "Oklahoma City Thunder", away_team: "San Antonio Spurs", home_score: 110, away_score: 100, game_date: "2000-01-01" },
          ],
          error: null,
        }),
    }
    return c
  },
}))
vi.mock("@/lib/cache", () => ({ cached: async (k: string, fn: () => unknown) => (st.keys.push(k), fn()) }))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: st.allowed, retryAfterMs: 1000 }),
  rateLimited: async () => {
    st.limiterCalls++
    return st.allowed ? null : Response.json({ error: "Too many requests." }, { status: 429 })
  },
}))
vi.mock("@/lib/data/scores", () => ({
  isValidYYYYMMDD: (d: string) => /^\d{8}$/.test(d),
  getScoresForDate: async () => (st.scoreCalls++, { data: [], meta: {} }),
}))

import { GET as series } from "@/app/api/props/series/route"
import { GET as highlights } from "@/app/api/highlights/route"
import { GET as scores } from "@/app/api/scores/route"
import { CACHE_CONTROL } from "@/lib/security/routeHelpers"

beforeEach(() => {
  st.ors = []
  st.keys = []
  st.allowed = true
  st.limiterCalls = 0
  st.scoreCalls = 0
})

describe("GET /api/props/series", () => {
  it("never interpolates unknown team input into the filter", async () => {
    const res = await series(new Request("http://localhost/api/props/series?team=OKC&opponent=x),id.not.is.null,and(a.eq.b"))
    expect(await res.json()).toMatchObject({ gamesPlayed: 0 })
    expect(st.ors).toEqual([])
  })

  it("still resolves abbreviations and full names, with one cached query", async () => {
    const res = await series(new Request("http://localhost/api/props/series?team=okc&opponent=San%20Antonio%20Spurs"))
    expect(res.status).toBe(200)
    expect(st.ors).toHaveLength(1)
    expect(st.keys[0]).toContain("Oklahoma City Thunder:San Antonio Spurs")
  })
})

describe("GET /api/highlights", () => {
  it("bounds and normalizes q, and rate-limits per IP", async () => {
    expect((await highlights(new Request(`http://localhost/api/highlights?q=${"a".repeat(81)}`))).status).toBe(400)
    st.allowed = false
    expect((await highlights(new Request("http://localhost/api/highlights?q=Spurs%20vs%20OKC"))).status).toBe(429)
  })
})

// /api/scores is outside the proxy matcher (CDN-cached polls skipped the proxy
// run), so its per-IP limit runs in the handler, on CDN misses only.
describe("GET /api/scores", () => {
  it("rejects a bad date before the limiter or the data layer", async () => {
    expect((await scores(new Request("http://localhost/api/scores?date=bad"))).status).toBe(400)
    expect(st.limiterCalls).toBe(0)
    expect(st.scoreCalls).toBe(0)
  })
  it("returns an uncached 429 without touching the data layer when over the limit", async () => {
    st.allowed = false
    const res = await scores(new Request("http://localhost/api/scores?date=20261004"))
    expect(res.status).toBe(429)
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL.SENSITIVE)
    expect(st.scoreCalls).toBe(0)
  })
  it("serves 200 with the public short cache when allowed", async () => {
    const res = await scores(new Request("http://localhost/api/scores?date=20261004"))
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL.PUBLIC_SHORT)
    expect(st.limiterCalls).toBe(1)
    expect(st.scoreCalls).toBe(1)
  })
})
