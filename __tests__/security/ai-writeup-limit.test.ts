import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// AUTHZ-8: the public writeup route called OpenAI on every cache miss with no
// limit (and propId variants always miss).
const st = vi.hoisted(() => ({ allowed: true, cachedWriteup: null as unknown, keys: [] as unknown[], tables: [] as string[], pageError: false, scans: 0, expires: [] as string[] }))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      st.tables.push(t)
      const c: Record<string, unknown> = {}
      for (const op of ["select", "eq", "gt", "gte", "order", "limit", "in", "insert", "range"]) c[op] = () => c
      c.eq = (k: string, v: unknown) => ((k === "prop_identifier" ? st.keys.push(v) : 0), c)
      c.upsert = (v: { prop_identifier: unknown; expires_at: string }) => (st.keys.push(v.prop_identifier), st.expires.push(v.expires_at), c)
      c.single = async () => ({ data: t === "ai_writeup_cache" ? st.cachedWriteup : null })
      c.maybeSingle = c.single
      let paged = false
      c.range = () => ((paged = true), st.scans++, c)
      c.then = (r: (v: unknown) => unknown) =>
        paged && st.pageError
          ? r({ data: null, error: { message: "timeout" } })
          : r({ data: t === "nba_player_stats" ? [1, 2, 3, 4].map((pts) => ({ pts, ast: pts, opponent: "BOS" })) : [], error: null })
      return c
    },
  }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: st.allowed, retryAfterMs: 1000 }),
}))

import { GET } from "@/app/api/props/ai-writeup/route"

const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] })))
const get = (propId = "LeBron%20James-pts") => GET(new Request(`http://localhost/api/props/ai-writeup?propId=${propId}`))

beforeEach(() => {
  st.allowed = true
  st.cachedWriteup = null
  st.keys = []
  st.tables = []
  st.pageError = false
  st.expires = []
  fetchSpy.mockClear()
  vi.stubGlobal("fetch", fetchSpy)
  vi.stubEnv("OPENAI_API_KEY", "test")
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("GET /api/props/ai-writeup", () => {
  it("over the per-IP generation limit → 429 without calling OpenAI", async () => {
    st.allowed = false
    expect((await get()).status).toBe(429)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("cache hits are served even when the generation limit is spent", async () => {
    st.allowed = false
    st.cachedWriteup = { writeup: "cached text", prop_line_at_generation: 0, expires_at: "2999-01-01" }
    const res = await get()
    expect(res.status).toBe(200)
    expect((await res.json()).writeup).toBe("cached text")
  })

  it("within the limit, a miss still generates", async () => {
    await get()
    expect(fetchSpy).toHaveBeenCalled()
  })

  // AUTHZ-8 (rest): `-PTS` and `-pts` were separate cache rows (two paid
  // calls), and any stat string went into the select() column list.
  it("stat case variants share one cache row", async () => {
    await get("LeBron%20James-PTS")
    await get("LeBron%20James-pts")
    expect(new Set(st.keys)).toEqual(new Set(["LeBron James-pts"]))
  })
  // REV-38: a failed page of the opponent-average scan was read as no rows and
  // the shrunken averages were cached for 6 h.
  it("a failed opponent-average page is not cached; the writeup still generates", async () => {
    st.pageError = true
    expect((await get("LeBron%20James-ast")).status).toBe(200)
    expect(fetchSpy).toHaveBeenCalled()
    st.pageError = false
    const scans = st.scans
    await get("LeBron%20James-ast")
    expect(st.scans).toBeGreaterThan(scans) // was: partial result served from cache
  })
  // REV-44: the gradeless writeup was cached for the full 6 h.
  it("a writeup built after a failed grade expires in minutes, a normal one in 6 h", async () => {
    const ttl = (i: number) => Date.parse(st.expires[i]) - Date.now()
    st.pageError = true
    await get("LeBron%20James-reb")
    expect(ttl(0)).toBeLessThanOrEqual(5 * 60 * 1000)
    st.pageError = false
    await get("LeBron%20James-reb")
    expect(ttl(1)).toBeGreaterThan(5 * 60 * 60 * 1000)
  })
  it("an unknown stat is rejected before any query or OpenAI call", async () => {
    const res = await get("LeBron%20James-profiles(wallet_balance)")
    expect(res.status).toBe(400)
    expect(st.tables).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
