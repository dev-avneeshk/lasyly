import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// AUTHZ-8: the public writeup route called OpenAI on every cache miss with no
// limit (and propId variants always miss).
const st = vi.hoisted(() => ({ allowed: true, cachedWriteup: null as unknown }))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const c: Record<string, unknown> = {}
      for (const op of ["select", "eq", "gt", "gte", "order", "limit", "in", "upsert", "insert"]) c[op] = () => c
      c.single = async () => ({ data: t === "ai_writeup_cache" ? st.cachedWriteup : null })
      c.maybeSingle = c.single
      c.then = (r: (v: unknown) => unknown) =>
        r({ data: t === "nba_player_stats" ? [1, 2, 3, 4].map((pts) => ({ pts, opponent: "BOS" })) : [], error: null })
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
const get = () => GET(new Request("http://localhost/api/props/ai-writeup?propId=LeBron%20James-pts"))

beforeEach(() => {
  st.allowed = true
  st.cachedWriteup = null
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
})
