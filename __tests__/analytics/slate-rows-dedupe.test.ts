import { describe, it, expect, vi, beforeEach } from "vitest"
// DB-08: a cold stat=all computes six stats at once and each paged the same
// 90-day rows (6 count queries + 6 page sets for one slate).
const st = vi.hoisted(() => ({ counts: 0, pages: 0, selects: [] as string[] }))
const today = new Date().toISOString().slice(0, 10)
const ROWS = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  player_name: "P",
  team: "BOS",
  opponent: "NYK",
  position: "G",
  minutes: "30:00",
  pts: 20 + i,
  trb: 5,
  ast: 7,
  stl: 1,
  blk: 0,
  tp: 3,
  tov: 2,
  nba_games: { game_date: today, home_team: "BOS", away_team: "NYK" },
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      let head = false
      const c: Record<string, unknown> = {
        select: (cols: string, o?: { head?: boolean }) => ((head = !!o?.head), head || st.selects.push(cols), c),
        in: () => c,
        gte: () => c,
        order: () => c,
        range: () => c,
        then: (r: (v: unknown) => unknown) => {
          if (head) return (st.counts++, r({ count: ROWS.length, error: null }))
          st.pages++
          return new Promise((done) => setTimeout(() => done(r({ data: ROWS, error: null })), 5))
        },
      }
      return c
    },
  }),
}))
import { fetchBatchPlayerStats } from "@/lib/analytics/engine-v2"
beforeEach(() => Object.assign(st, { counts: 0, pages: 0, selects: [] }))
describe("NBA slate rows (DB-08)", () => {
  it("six concurrent stats share one read and project their own column", async () => {
    const stats = ["pts", "trb", "ast", "tp", "stl", "blk"]
    const maps = await Promise.all(stats.map((s) => fetchBatchPlayerStats(["BOS"], s)))
    expect(st.counts).toBe(1) // was 6
    expect(st.pages).toBe(1) // was 6
    expect(maps[0].get("P")?.[0].statValue).toBe(20)
    expect(maps[2].get("P")?.[0].statValue).toBe(7)
  })
  it("a later call reads fresh rows (nothing is kept after the read settles)", async () => {
    await fetchBatchPlayerStats(["BOS"], "pts")
    await fetchBatchPlayerStats(["BOS"], "pts")
    expect(st.pages).toBe(2)
  })
  it("an unknown stat column returns no players instead of zeros", async () => {
    expect((await fetchBatchPlayerStats(["BOS"], "bogus")).size).toBe(0)
    expect(st.pages).toBe(0)
  })
})
