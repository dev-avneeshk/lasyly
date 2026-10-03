import { describe, it, expect, vi } from "vitest"

// DB-16: the NBA player detail read every row for the player and season, so
// draft versions and the other mode overwrote the published ranks per type,
// and the detail rank disagreed with the list.
const rankingRows = [
  { ranking_type: "overall", ranking_mode: "projected", ranking_version: "v2", rank: 3, score: 90, player_name: "A B" },
  { ranking_type: "overall", ranking_mode: "projected", ranking_version: "v3-draft", rank: 40, score: 50, player_name: "A B" },
  { ranking_type: "overall", ranking_mode: "historical", ranking_version: "h1", rank: 12, score: 70, player_name: "A B" },
]

vi.mock("@/lib/cache", () => ({ cached: (_k: string, f: () => unknown) => f() }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      const f: Record<string, unknown> = {}
      const result = () => {
        if (t === "nba_ranking_versions") {
          const v = f.status === "published" && ({ projected: "v2", historical: "h1" } as Record<string, string>)[f.ranking_mode as string]
          return { data: v ? { ranking_version: v } : null }
        }
        if (t === "nba_player_rankings") return { data: rankingRows.filter((r) => !f.ranking_mode || r.ranking_mode === f.ranking_mode), error: null }
        return { data: t === "nba_players" ? null : [] }
      }
      const c: Record<string, unknown> = {
        eq: (k: string, v: unknown) => ((f[k] = v), c),
        maybeSingle: async () => result(),
        then: (r: (v: unknown) => unknown) => r(result()),
      }
      for (const op of ["select", "order", "limit"]) c[op] = () => c
      return c
    },
  }),
}))

import { NextRequest } from "next/server"
import { GET } from "@/app/api/rankings/players/[playerId]/route"

const get = async (qs = "") =>
  (await GET(new NextRequest(`http://localhost/api/rankings/players/A%20B${qs}`), { params: Promise.resolve({ playerId: "A%20B" }) })).json()

describe("GET /api/rankings/players/[playerId] (NBA)", () => {
  it("uses only the published version of the requested mode (was: rank from whichever row came last)", async () => {
    const body = await get()
    expect(body.overall_rank).toBe(3)
    expect(body.rankings_by_type.overall.rank).toBe(3)
  })
  it("REV-34: a past season without ?mode reads the historical row (was: projected default → 404)", async () => {
    const body = await get("?season=2025-26")
    expect(body.overall_rank).toBe(12)
    expect((await get("?season=2025-26&mode=projected")).overall_rank).toBe(3)
  })
})
