import { describe, it, expect, vi, beforeEach } from "vitest"

// getScoresForDate used to schedule a full-day upsertMatches on every request
// that found the DB stale, even when all three ESPN reads were Redis hits that
// some other invocation had already persisted. The upsert now runs only inside
// a cached() fetcher, i.e. once per real ESPN refetch.

const st = vi.hoisted(() => ({
  hits: new Map<string, unknown>(),
  upserts: [] as Array<Array<{ id: string }>>,
  espnCalls: 0,
  dbRows: [] as Array<Record<string, unknown>>,
  selects: [] as string[],
}))

vi.mock("@/lib/cache", () => ({
  CACHE_TTL: { scores: 10_000 },
  cached: async <T>(key: string, fetcher: () => Promise<T>) =>
    st.hits.has(key) ? (st.hits.get(key) as T) : fetcher(),
}))
vi.mock("@/lib/background", () => ({
  afterResponse: (work: () => Promise<unknown>) => {
    void work()
  },
}))
vi.mock("@/lib/services/sportsApi", () => ({
  fetchLiveScores: async () => (st.espnCalls++, [match("live-1")]),
}))
vi.mock("@/lib/services/espn", () => ({
  fetchESPNScores: async (d: string) => (st.espnCalls++, [match(`espn-${d}`)]),
}))
vi.mock("@/lib/services/matchStorage", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/matchStorage")>()),
  upsertMatches: async (m: Array<{ id: string }>) => {
    st.upserts.push(m)
  },
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const c: Record<string, unknown> = {
      from: () => c,
      select: (cols: string) => (st.selects.push(cols), c),
      gte: () => c,
      lte: () => c,
      eq: () => c,
      then: (r: (v: unknown) => unknown) => r({ data: st.dbRows, error: null }),
    }
    return c
  },
}))

function match(id: string) {
  return { id, homeTeam: "A", awayTeam: "B", homeScore: 0, awayScore: 0, status: "Finished", league: "NBA", sport: "Basketball" }
}

function row(id: string, matchDate: string, updatedAt: string) {
  return { id, home_team: "A", away_team: "B", status: "Not Started", league: "NBA", sport: "Basketball", match_date: matchDate, updated_at: updatedAt }
}

const { getScoresForDate, getTodayYYYYMMDD, shiftYYYYMMDD } = await import("@/lib/data/scores")

const today = getTodayYYYYMMDD()
const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  st.hits = new Map()
  st.upserts = []
  st.espnCalls = 0
  st.dbRows = []
  st.selects = []
})

describe("getScoresForDate persistence", () => {
  it("does not upsert when every ESPN read is a cache hit", async () => {
    st.dbRows = [row("db-1", iso(today), "2000-01-01T00:00:00Z")] // stale
    st.hits.set(`scores:espn:${today}`, [match("live-1")])
    st.hits.set(`scores:espn:${shiftYYYYMMDD(today, -1)}`, [match("prev-1")])
    st.hits.set(`scores:espn:${shiftYYYYMMDD(today, 1)}`, [match("next-1")])

    const { data, meta } = await getScoresForDate(today)
    await flush()

    expect(st.upserts).toHaveLength(0)
    expect(st.espnCalls).toBe(0)
    expect(meta.source).toBe("espn_cached")
    expect(data.map((m) => m.id)).toEqual(["live-1", "prev-1", "next-1"])
  })

  it("upserts only the matches of the fetcher that missed", async () => {
    st.hits.set(`scores:espn:${today}`, [match("live-1")])
    st.hits.set(`scores:espn:${shiftYYYYMMDD(today, -1)}`, [match("prev-1")])

    await getScoresForDate(today)
    await flush()

    const next = shiftYYYYMMDD(today, 1)
    expect(st.espnCalls).toBe(1)
    expect(st.upserts).toEqual([[match(`espn-${next}`)]])
  })

  it("serves fresh DB rows without fetching ESPN or upserting", async () => {
    st.dbRows = [row("db-1", iso(today), new Date().toISOString())]

    const { data, meta } = await getScoresForDate(today)
    await flush()

    expect(meta.source).toBe("db")
    expect(data.map((m) => m.id)).toEqual(["db-1"])
    expect(st.espnCalls).toBe(0)
    expect(st.upserts).toHaveLength(0)
  })

  it("selects only the columns the freshness read uses (no raw_data)", async () => {
    await getScoresForDate(today)
    expect(st.selects).toEqual([
      "id, event_id, home_team, away_team, home_score, away_score, clock, start_time, status, league, sport, home_logo, away_logo, home_color, away_color, venue, match_date, updated_at",
    ])
  })
})
