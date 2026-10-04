import { describe, it, expect, vi } from "vitest"

// RA-3: profiles were read with one `.in()` over every qualified user before
// ranking (URL limit past ~300 ids, 1000-row cap past 1000 users). Now only
// the top 50 ranked ids are looked up.
const USERS = 1500
const ROWS = Array.from({ length: USERS }, (_, u) =>
  // user u: 10 resolved picks, u % 11 of them won; u10 (a 100% user) has no profile.
  Array.from({ length: 10 }, (_, k) => ({ user_id: `u${u}`, status: k < u % 11 ? "won" : "lost", odds: 2 }))
).flat()
const profileLookups = vi.hoisted(() => [] as string[][])

vi.mock("@/lib/cache", async (orig) => ({
  ...(await orig<typeof import("@/lib/cache")>()),
  cached: async (_k: string, fn: () => unknown) => fn(),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      let range: [number, number] = [0, 999]
      let head = false
      let ids: string[] = []
      const c: Record<string, unknown> = {
        select: (_s: string, o?: { head?: boolean }) => ((head = !!o?.head), c),
        in: (_k: string, v: string[]) => ((ids = v), c),
        order: () => c,
        range: (a: number, b: number) => ((range = [a, b]), c),
        then: (r: (v: unknown) => unknown) => {
          if (t === "profiles") {
            profileLookups.push(ids)
            return r({ data: ids.filter((id) => id !== "u10").map((id) => ({ id, username: id })), error: null })
          }
          if (head) return r({ count: ROWS.length, error: null })
          return r({ data: ROWS.slice(range[0], range[1] + 1), error: null })
        },
      }
      return c
    },
  }),
}))

import { getLeaderboard } from "@/lib/data/leaderboard"

describe("leaderboard profiles (RA-3)", () => {
  it("looks up at most 50 ids per read and returns the true top 50", async () => {
    const { leaderboard } = await getLeaderboard("win_rate")
    expect(profileLookups.length).toBe(2) // the missing profile is filled from the next batch
    expect(profileLookups.every((ids) => ids.length <= 50)).toBe(true)
    expect(leaderboard).toHaveLength(50)
    // Top win rate is 100% (u % 11 === 10); every entry is at least as good as any left out.
    expect(leaderboard[0].win_rate).toBe(100)
    expect(leaderboard.every((e) => e.win_rate === 100)).toBe(true)
    expect(leaderboard.some((e) => e.user_id === "u10")).toBe(false)
  })
})
