import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextResponse } from "next/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const st = vi.hoisted(() => ({ players: [] as Array<Record<string, unknown>> }))

vi.mock("@/lib/cache", () => ({ cached: async (_k: string, fn: () => unknown) => fn() }))
vi.mock("@/lib/data/headshot-storage", () => ({
  getStoredHeadshotIds: async () => new Set<string>(),
  storedHeadshotUrl: () => null,
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const c: Record<string, unknown> = {
        select: () => c, eq: () => c, ilike: () => c, limit: () => c,
        then: (r: (v: unknown) => unknown) => r({ data: table === "espn_players" ? st.players : [], error: null }),
      }
      return c
    },
  }),
}))

// DB-20: withSecurity stamped the public preset on 4xx/5xx too, so a CDN could
// cache a 404/429/500 for every visitor.
const route = (status: number) =>
  withSecurity(async () => NextResponse.json({}, { status }), { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })

describe("withSecurity Cache-Control", () => {
  it("keeps the public preset on a 200", async () => {
    expect((await route(200)(new Request("http://localhost/x"))).headers.get("Cache-Control")).toBe(CACHE_CONTROL.PUBLIC_SHORT)
  })
  it.each([404, 429, 500])("a %i is not publicly cacheable (was: public preset)", async (status) => {
    const res = await route(status)(new Request("http://localhost/x"))
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL.SENSITIVE)
  })
})

// Found headshots are CDN-cacheable again (every PlayerPhoto fallback was a
// function call); misses and bad input must stay no-store.
const { GET: headshotGET } = await import("@/app/api/players/headshot/route")

describe("GET /api/players/headshot Cache-Control", () => {
  const get = (qs: string) => headshotGET(new Request(`http://localhost/api/players/headshot?${qs}`))

  beforeEach(() => {
    st.players = []
    // Strategy 3 (ESPN core search) must not hit the network in tests.
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("a found player is publicly cacheable", async () => {
    st.players = [{ espn_id: "3059318", name: "Victor Wembanyama", headshot_url: null, sport: "basketball" }]
    const res = await get("name=Victor+Wembanyama&sport=NBA")
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL.IMMUTABLE)
  })

  it("not found is a 404 that is never cached", async () => {
    const res = await get("name=Nobody+Here&sport=NBA")
    expect(res.status).toBe(404)
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL.SENSITIVE)
  })

  it("a too-short name is a 400 that is never cached", async () => {
    const res = await get("name=x")
    expect(res.status).toBe(400)
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL.SENSITIVE)
  })
})
