import { describe, it, expect, vi, beforeEach } from "vitest"

// DB-18: the sitemap read prop_line_history unpaged (PostgREST returns 1000
// rows), so most players were missing. DB-17: every unknown /players/<slug>
// scanned 5k rows plus up to three unanchored ILIKEs on the 50k-row table.
const st = vi.hoisted(() => ({ rows: [] as { player_name: string; sport: string; recorded_at: string }[], queries: 0, ilikes: 0 }))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      st.queries++
      let range: [number, number] = [0, 999]
      let head = false
      const c: Record<string, unknown> = {
        select: (_: string, o?: { head?: boolean }) => ((head = Boolean(o?.head)), c),
        order: () => c,
        limit: () => c,
        eq: () => c,
        ilike: () => (st.ilikes++, c),
        range: (a: number, b: number) => ((range = [a, Math.min(b, a + 999)]), c),
        then: (r: (v: unknown) => unknown) =>
          r(head ? { count: st.rows.length, error: null } : { data: st.rows.slice(range[0], range[1] + 1), error: null }),
      }
      return c
    },
  }),
}))

import { getAllPlayerSlugs, getPublicPlayerBySlug } from "@/lib/data/public-players"

beforeEach(() => {
  // 900 players, newest rows first, 3 rows each (2,700 rows).
  st.rows = Array.from({ length: 2700 }, (_, i) => ({
    player_name: `Player ${i % 900}`,
    sport: "NBA",
    recorded_at: `2026-0${1 + Math.floor(i / 900)}-15T00:00:00Z`,
  }))
  st.queries = 0
  st.ilikes = 0
})

describe("public player index", () => {
  it("the sitemap lists every player, with their newest line date (was: the first 1000 rows only)", async () => {
    const slugs = await getAllPlayerSlugs()
    expect(slugs).toHaveLength(900)
    expect(slugs.find((s) => s.slug === "player-899")).toEqual({ slug: "player-899", lastGameDate: "2026-01-15" })
  })

  it("an unknown slug costs no queries once the index is warm, and never ILIKE-scans", async () => {
    await getAllPlayerSlugs()
    st.queries = 0
    expect(await getPublicPlayerBySlug("no-such-player")).toBeNull()
    expect(await getPublicPlayerBySlug("x%25_")).toBeNull()
    expect(st.queries).toBe(0)
    expect(st.ilikes).toBe(0)
  })
})
