import { describe, it, expect, vi, beforeEach } from "vitest"

// DB-23: raw team params went into a PostgREST `.or()` filter string (filter
// injection), uncached, two queries per call. RT-12: /api/highlights took any
// `q` (unbounded, un-normalized cache keys) with no limit on YouTube spend.
const st = vi.hoisted(() => ({ ors: [] as string[], keys: [] as string[], allowed: true }))

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
}))

import { GET as series } from "@/app/api/props/series/route"
import { GET as highlights } from "@/app/api/highlights/route"

beforeEach(() => {
  st.ors = []
  st.keys = []
  st.allowed = true
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
