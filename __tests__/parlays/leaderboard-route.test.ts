import { describe, it, expect, vi } from "vitest"

// L-14: the leaderboard read every parlay in one unordered select, which
// PostgREST stops at 1000 rows, and keyed the cache on any `sort` value.
const ROWS = Array.from({ length: 1500 }, (_, i) => ({
  user_id: i < 1000 ? "a" : "b",
  status: i < 1000 ? "lost" : "won",
  odds: 2,
}))
const keys = vi.hoisted(() => [] as string[])

vi.mock("@/lib/cache", async (orig) => ({
  ...(await orig<typeof import("@/lib/cache")>()),
  cached: async (k: string, fn: () => unknown) => (keys.push(k), fn()),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      let range: [number, number] | null = null
      let head = false
      const c: Record<string, unknown> = {
        select: (_s: string, o?: { head?: boolean }) => ((head = !!o?.head), c),
        in: () => c,
        order: () => c,
        range: (a: number, b: number) => ((range = [a, b]), c),
        then: (r: (v: unknown) => unknown) => {
          if (t === "profiles") return r({ data: [{ id: "a", username: "a" }, { id: "b", username: "b" }], error: null })
          if (head) return r({ count: ROWS.length, error: null })
          const [a, b] = range ?? [0, 999]
          return r({ data: ROWS.slice(a, Math.min(b, 999 + a) + 1), error: null }) // 1000-row cap per request
        },
      }
      return c
    },
  }),
}))

import { GET } from "@/app/api/leaderboard/route"

describe("GET /api/leaderboard", () => {
  it("counts parlays past the first 1000 rows", async () => {
    const body = await (await GET(new Request("http://localhost/api/leaderboard"))).json()
    const b = body.leaderboard.find((e: { user_id: string }) => e.user_id === "b")
    expect(b).toMatchObject({ total_picks: 500, win_rate: 100 })
  })

  it("normalizes unknown sort values to one cache key", async () => {
    await GET(new Request("http://localhost/api/leaderboard?sort=x" + "y".repeat(50)))
    expect(keys.at(-1)).toBe("leaderboard:win_rate")
  })
})
