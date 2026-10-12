import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The NFL rankings detail hero is a plain <img> with no onError, so the route
// may only hand out the 480px xl object when the xl index says it exists.
const st = vi.hoisted(() => ({
  stored: {} as Record<string, Set<string>>,
}))

vi.mock("@/lib/cache", () => ({ cached: (_k: string, f: () => unknown) => f() }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const result = () => {
        if (t === "nfl_player_rankings") {
          return {
            data: [{ ranking_type: "overall", athlete_id: "3139477", player_name: "Patrick Mahomes", rank: 1, score: 99, tier: "S" }],
            error: null,
          }
        }
        if (t === "espn_players") return { data: { headshot_url: null }, error: null }
        return { data: null, error: null }
      }
      const c: Record<string, unknown> = {
        maybeSingle: async () => result(),
        then: (r: (v: unknown) => unknown) => r(result()),
      }
      for (const op of ["select", "eq", "order", "limit"]) c[op] = () => c
      return c
    },
  }),
}))
vi.mock("@/lib/data/headshot-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/headshot-storage")>()),
  getStoredHeadshotIds: async (league: string, variant: "lg" | "xl" = "lg") =>
    st.stored[`${league}:${variant}`] ?? new Set<string>(),
}))

import { NextRequest } from "next/server"
import { GET } from "@/app/api/rankings/players/[playerId]/route"

const BASE = "https://proj.supabase.co/storage/v1/object/public/player-headshots"

const get = async () =>
  (
    await GET(new NextRequest("http://localhost/api/rankings/players/3139477?sport=NFL&season=2025"), {
      params: Promise.resolve({ playerId: "3139477" }),
    })
  ).json()

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co")
  st.stored = {}
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe("GET /api/rankings/players/[playerId] (NFL) headshot", () => {
  it("serves xl when the xl index has the athlete", async () => {
    st.stored = { "nfl:lg": new Set(["3139477"]), "nfl:xl": new Set(["3139477"]) }
    expect((await get()).headshot_url).toBe(`${BASE}/nfl/xl/3139477.webp`)
  })

  it("falls back to lg when only lg is stored", async () => {
    st.stored = { "nfl:lg": new Set(["3139477"]) }
    expect((await get()).headshot_url).toBe(`${BASE}/nfl/3139477.webp`)
  })

  it("falls back to ESPN when neither is stored", async () => {
    expect((await get()).headshot_url).toBe("https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png")
  })
})
