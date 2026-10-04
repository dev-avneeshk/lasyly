import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync } from "fs"
import path from "path"

// Vercel bills an ISR write whenever a regeneration produces new output. These
// tests pin what keeps the routine writes bounded: /explore and /scores stay
// on a 900 s ISR window, no snapshot inside them can drag that window lower
// (the lowest revalidate on a route wins), and the sitemap output is stable
// within a UTC day.

const st = vi.hoisted(() => ({ revalidates: [] as Array<number | false | undefined> }))

vi.mock("next/cache", () => ({
  unstable_cache: <A extends unknown[], R>(fn: (...args: A) => Promise<R>, _keys?: string[], opts?: { revalidate?: number | false }) => {
    st.revalidates.push(opts?.revalidate)
    return fn
  },
}))
vi.mock("@/lib/data/scores", () => ({
  getTodayYYYYMMDD: () => "20261004",
  getScoresForDate: async () => ({ data: [{ id: "m1" }], meta: {} }),
}))
vi.mock("@/lib/data/news", () => ({
  getNews: async () => ({ items: [{ id: "n1" }] }),
}))
vi.mock("@/lib/data/leaderboard", () => ({
  getLeaderboard: async () => ({
    leaderboard: [{ user_id: "u1", username: "a", display_name: "A", avatar_url: null, win_rate: 0.6, total_picks: 12, is_verified: false }],
  }),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const c: Record<string, unknown> = {
        select: () => c,
        eq: () => c,
        order: () => c,
        limit: () => c,
        in: () => c,
        then: (r: (v: unknown) => unknown) =>
          r({ data: [{ slug: "post-1", published_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z" }], error: null }),
      }
      return c
    },
  }),
}))
vi.mock("@/lib/data/public-players", () => ({
  getAllPlayerSlugs: async () => [{ slug: "player-1", lastGameDate: "2026-10-01" }],
}))

const root = path.resolve(__dirname, "../..")
const source = (rel: string) => readFileSync(path.join(root, rel), "utf8")

const PAGE_REVALIDATE = 900

describe("/explore and /scores stay on 900 s ISR", () => {
  it.each(["app/(app)/explore/page.tsx", "app/(app)/scores/page.tsx"])("%s exports revalidate = 900 and force-static", (file) => {
    const src = source(file)
    expect(src).toMatch(new RegExp(`export const revalidate = ${PAGE_REVALIDATE}\\b`))
    expect(src).toMatch(/export const dynamic = "force-static"/)
  })
})

describe("snapshots never lower the page's ISR window", () => {
  beforeEach(() => {
    st.revalidates = []
  })

  it("every unstable_cache snapshot revalidates no sooner than the page", async () => {
    const snap = await import("@/lib/data/isr-snapshots")
    expect(snap.SNAPSHOT_REVALIDATE_SECONDS).toBeGreaterThanOrEqual(PAGE_REVALIDATE)

    expect(await snap.getScoresSnapshot()).toEqual([{ id: "m1" }])
    expect(await snap.getTopNewsSnapshot()).toEqual({ id: "n1" })
    expect(await snap.getLeaderboardSnapshot()).toEqual([
      { user_id: "u1", username: "a", display_name: "A", avatar_url: null, win_rate: 0.6, total_picks: 12 },
    ])
    await snap.getFeedSnapshot()

    expect(st.revalidates).toHaveLength(4)
    for (const r of st.revalidates) {
      expect(typeof r).toBe("number")
      expect(r as number).toBeGreaterThanOrEqual(PAGE_REVALIDATE)
    }
  })
})

describe("sitemap output is stable within a UTC day", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  async function renderAt(iso: string) {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(iso))
    const { default: sitemap } = await import("@/app/sitemap")
    return JSON.stringify(await sitemap())
  }

  it("regenerations on the same day produce identical output, so they are not billed", async () => {
    const morning = await renderAt("2026-10-04T01:05:00Z")
    const evening = await renderAt("2026-10-04T23:55:00Z")
    expect(evening).toBe(morning)
    expect(morning).not.toContain("2026-10-04T01:05")
  })

  it("the date still advances on the next day", async () => {
    const today = await renderAt("2026-10-04T12:00:00Z")
    const tomorrow = await renderAt("2026-10-05T12:00:00Z")
    expect(tomorrow).not.toBe(today)
    expect(tomorrow).toContain("2026-10-05T00:00:00.000Z")
  })
})
