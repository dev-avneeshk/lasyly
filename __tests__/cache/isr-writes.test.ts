import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync } from "fs"
import path from "path"

// Vercel bills an ISR write whenever a regeneration produces new output. These
// tests pin the three changes that stop the routine writes: /explore and
// /scores render dynamically (no ISR entry), their snapshots read through
// Redis cache-aside instead of the Next Data Cache, and the sitemap output is
// stable within a UTC day.

const st = vi.hoisted(() => ({ cacheKeys: [] as string[] }))

vi.mock("next/cache", () => ({
  unstable_cache: () => {
    throw new Error("snapshots must not use the Next Data Cache")
  },
}))
vi.mock("@/lib/cache", () => ({
  CACHE_TTL: { scores: 10_000, feed: 15_000 },
  cached: async <T>(key: string, fetcher: () => Promise<T>) => {
    st.cacheKeys.push(key)
    return fetcher()
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

describe("live-data shells are not ISR", () => {
  it.each(["app/(app)/explore/page.tsx", "app/(app)/scores/page.tsx"])("%s renders dynamically with no revalidate window", (file) => {
    const src = source(file)
    expect(src).toMatch(/export const dynamic = "force-dynamic"/)
    expect(src).not.toMatch(/export const revalidate/)
    expect(src).not.toMatch(/force-static/)
  })
})

describe("page snapshots read through Redis cache-aside", () => {
  beforeEach(() => {
    st.cacheKeys = []
  })

  it("scores and feed use their own Redis keys; news and leaderboard reuse their cached loaders", async () => {
    const snap = await import("@/lib/data/page-snapshots")
    expect(await snap.getScoresSnapshot()).toEqual([{ id: "m1" }])
    expect(await snap.getTopNewsSnapshot()).toEqual({ id: "n1" })
    expect(await snap.getLeaderboardSnapshot()).toEqual([
      { user_id: "u1", username: "a", display_name: "A", avatar_url: null, win_rate: 0.6, total_picks: 12 },
    ])
    await snap.getFeedSnapshot()
    expect(st.cacheKeys).toEqual(["scores:snapshot:20261004", "explore:feed-snapshot"])
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
