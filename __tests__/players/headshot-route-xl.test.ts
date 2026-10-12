import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CACHE_CONTROL } from "@/lib/security/routeHelpers"

const st = vi.hoisted(() => {
  const state = {
    players: [] as Array<Record<string, unknown>>,
    keys: [] as string[],
    stored: {} as Record<string, Set<string>>,
  }
  const getStored = vi.fn(async (league: string, variant: "lg" | "xl" = "lg") =>
    state.stored[`${league}:${variant}`] ?? new Set<string>()
  )
  return Object.assign(state, { getStored })
})

vi.mock("@/lib/cache", () => ({
  cached: async (key: string, fn: () => unknown) => {
    st.keys.push(key)
    return fn()
  },
}))
vi.mock("@/lib/data/headshot-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/headshot-storage")>()),
  getStoredHeadshotIds: st.getStored,
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

const { GET } = await import("@/app/api/players/headshot/route")

const BASE = "https://proj.supabase.co/storage/v1/object/public/player-headshots"
const MAHOMES = { espn_id: "3139477", name: "Patrick Mahomes", headshot_url: null, sport: "football" }
const WEMBY = { espn_id: "3059318", name: "Victor Wembanyama", headshot_url: null, sport: "basketball" }

const get = (qs: string) => GET(new Request(`http://localhost/api/players/headshot?${qs}`))
const askedForXl = () => st.getStored.mock.calls.some((call) => call[1] === "xl")

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co")
  // Strategies 2 and 3 (ESPN roster / core search) must not hit the network.
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }))
  st.players = []
  st.keys = []
  st.stored = {}
  st.getStored.mockClear()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("GET /api/players/headshot variant=xl", () => {
  it("NFL: returns xl when the xl object exists, keeping headshotCropped on sm", async () => {
    st.players = [MAHOMES]
    st.stored = { "nfl:lg": new Set(["3139477"]), "nfl:xl": new Set(["3139477"]) }
    const res = await get("name=Patrick+Mahomes&sport=NFL&variant=xl")
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL.IMMUTABLE)
    const body = await res.json()
    expect(body.headshot).toBe(`${BASE}/nfl/xl/3139477.webp`)
    expect(body.headshotCropped).toBe(`${BASE}/nfl/sm/3139477.webp`)
    expect(st.keys).toEqual(["headshot:v4:patrick mahomes::nfl"])
  })

  it("NFL: stays on lg when the xl object is missing", async () => {
    st.players = [MAHOMES]
    st.stored = { "nfl:lg": new Set(["3139477"]) }
    const body = await (await get("name=Patrick+Mahomes&sport=NFL&variant=xl")).json()
    expect(body.headshot).toBe(`${BASE}/nfl/3139477.webp`)
    expect(st.keys).toEqual(["headshot:v4:patrick mahomes::nfl"])
  })

  it("NFL without variant keeps lg and never consults the xl index", async () => {
    st.players = [MAHOMES]
    st.stored = { "nfl:lg": new Set(["3139477"]), "nfl:xl": new Set(["3139477"]) }
    const body = await (await get("name=Patrick+Mahomes&sport=NFL")).json()
    expect(body.headshot).toBe(`${BASE}/nfl/3139477.webp`)
    expect(askedForXl()).toBe(false)
    expect(st.keys).toEqual(["headshot:v4:patrick mahomes::nfl"])
  })

  it("NBA ignores variant=xl: same body, xl never queried", async () => {
    st.players = [WEMBY]
    const plain = await (await get("name=Victor+Wembanyama&sport=NBA")).json()
    const withXl = await (await get("name=Victor+Wembanyama&sport=NBA&variant=xl")).json()
    expect(withXl).toEqual(plain)
    expect(askedForXl()).toBe(false)
    expect(st.keys).toEqual(["headshot:v4:victor wembanyama::nba", "headshot:v4:victor wembanyama::nba"])
  })
})
