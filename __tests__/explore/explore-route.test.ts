import { describe, it, expect, vi } from "vitest"
// DB-11: /api/explore ran 2 queries per tipster, ranked an arbitrary 10 of
// them (limit before sort) and read at most 100/1000 betslips per user.
const st = vi.hoisted(() => {
  const ids = Array.from({ length: 15 }, (_, i) => `t${String(i).padStart(2, "0")}`)
  return {
    queries: 0,
    ids,
    // t14 has the most followers; t00 the fewest.
    follows: ids.flatMap((id, i) => Array.from({ length: i + 1 }, (_, j) => ({ id: `${id}-${j}`, following_id: id }))),
    // 1500 graded slips for t14: 1200 Won, 300 Lost, plus Voids that must not count.
    betslips: [
      ...Array.from({ length: 1500 }, (_, i) => ({ id: `b${i}`, user_id: "t14", status: i < 1200 ? "Won" : "Lost" })),
      ...Array.from({ length: 50 }, (_, i) => ({ id: `v${i}`, user_id: "t14", status: "Void" })),
    ],
  }
})
vi.mock("@/lib/cache", async (orig) => ({
  ...(await orig<typeof import("@/lib/cache")>()),
  cached: async (_k: string, fn: () => unknown) => fn(),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      st.queries++
      let head = false
      let range: [number, number] | null = null
      let eqType = ""
      const rows = () => {
        if (t === "rooms") return eqType === "Tipster" ? st.ids.map((creator_id) => ({ creator_id })) : []
        if (t === "profiles") return st.ids.map((id) => ({ id, username: id, display_name: id, avatar_url: null }))
        if (t === "follows") return st.follows
        if (t === "betslips") return st.betslips
        return []
      }
      const c: Record<string, unknown> = {
        select: (_cols: string, opts?: { head?: boolean }) => ((head = Boolean(opts?.head)), c),
        eq: (_k: string, v: string) => ((eqType = v), c),
        in: () => c,
        order: () => c,
        limit: () => c,
        range: (a: number, b: number) => ((range = [a, b]), c),
        then: (r: (v: unknown) => unknown) => {
          const all = rows()
          if (head) return r({ count: all.length, data: null, error: null })
          const page = range ? all.slice(range[0], range[1] + 1) : all.slice(0, 1000)
          return r({ data: page, error: null })
        },
      }
      return c
    },
  }),
}))
import { GET } from "@/app/api/explore/route"
describe("explore top tipsters (DB-11)", () => {
  it("ranks every tipster by followers with batched reads and counts all graded slips", async () => {
    const body = await (await GET(new Request("http://localhost/api/explore"))).json()
    expect(body.top_tipsters).toHaveLength(10)
    expect(body.top_tipsters.map((t: { id: string }) => t.id).slice(0, 3)).toEqual(["t14", "t13", "t12"])
    expect(body.top_tipsters[0]).toMatchObject({ follower_count: 15, win_rate: 80 }) // 1200 / 1500, Void excluded
    // rooms x2, profiles, follows (count + page), betslips (count + 2 pages) = 8 (was 2 + 2 per tipster)
    expect(st.queries).toBeLessThanOrEqual(8)
  })
})
