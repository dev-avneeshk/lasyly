import { beforeEach, describe, expect, it, vi } from "vitest"
import { CACHE_CONTROL } from "@/lib/security/routeHelpers"

// Per-table fake Supabase state; each test sets what the tables return.
const st = vi.hoisted(() => ({
  tables: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  calls: [] as Array<{ table: string; op: string; args: unknown[] }>,
}))

vi.mock("@/lib/cache", () => ({
  cached: async (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
  CACHE_TTL: { leaderboard: 300_000, props: 120_000 },
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const result = () => st.tables[table] ?? { data: null, error: null }
      const builder: Record<string, unknown> = {}
      for (const op of ["select", "eq", "in"]) {
        builder[op] = (...args: unknown[]) => {
          st.calls.push({ table, op, args })
          return builder
        }
      }
      builder.maybeSingle = async () => result()
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject)
      return builder
    },
  }),
}))

import { GET } from "@/app/api/soccer/match-stats/[league]/[season]/[matchNo]/route"

type Params = { league?: string; season?: string; matchNo?: string }

async function call(params: Params) {
  const path = [params.league, params.season, params.matchNo].map((p) => p ?? "").join("/")
  const res = await GET(new Request(`http://localhost/api/soccer/match-stats/${path}`), {
    params: Promise.resolve(params),
  })
  return { res, json: await res.json() }
}

const HEADER = {
  league: "eng.1",
  season: "2025-26",
  match_no: 1,
  round: 1,
  match_date: "2025-08-15",
  home_team: "Liverpool",
  away_team: "AFC Bournemouth",
  home_score: 4,
  away_score: 2,
  source: "FotMob",
  has_stats: true,
}

const STATS = [
  { period: "FT", stat_group: "Top stats", stat_name: "Corners", home_value: "9", away_value: "3", home_pct: null, away_pct: null, home_raw: "9", away_raw: "3" },
  { period: "1H", stat_group: "Top stats", stat_name: "Corners", home_value: 5, away_value: 1, home_pct: null, away_pct: null, home_raw: "5", away_raw: "1" },
]

beforeEach(() => {
  st.tables = {}
  st.calls = []
  vi.restoreAllMocks()
})

describe("GET /api/soccer/match-stats/[league]/[season]/[matchNo]", () => {
  it("400 for every invalid param (AC10)", async () => {
    const cases: Params[] = [
      { league: "usa.1", season: "2025-26", matchNo: "1" },
      { league: "uefa.champions", season: "2025-26", matchNo: "1" },
      { league: "eng.1", season: "2026-28", matchNo: "1" },
      { league: "eng.1", season: "2025-26", matchNo: "0" },
      { league: "eng.1", season: "2025-26", matchNo: "045" },
      { league: "eng.1", season: "2025-26", matchNo: "4.5" },
      { league: "eng.1", season: "2025-26", matchNo: "1e3" },
      { league: "eng.1", season: "2025-26", matchNo: "10000" },
      { league: "eng.1", season: "2025-26", matchNo: "abc" },
      { league: "eng.1", season: "2025-26", matchNo: "%" },
      { league: "eng.1%2E1", season: "2025-26", matchNo: "1" },
      { league: "eng.1", season: "2025-26" },
      { season: "2025-26", matchNo: "1" },
      {},
    ]
    for (const params of cases) {
      const { res, json } = await call(params)
      expect(res.status, JSON.stringify(params)).toBe(400)
      expect(json).toEqual({ error: "Invalid match", success: false })
      expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL.SENSITIVE)
    }
    // Validation runs before any DB read.
    expect(st.calls).toEqual([])
  })

  it("400 when the context is missing entirely", async () => {
    const res = await GET(new Request("http://localhost/api/soccer/match-stats/"))
    expect(res.status).toBe(400)
  })

  it("404 when the match doesn't exist", async () => {
    st.tables.soccer_matches = { data: null, error: null }
    const { res, json } = await call({ league: "eng.1", season: "2025-26", matchNo: "999" })
    expect(res.status).toBe(404)
    expect(json).toEqual({ error: "Match not found", success: false })
    expect(res.headers.get("Cache-Control")).not.toMatch(/public/)
  })

  it("200 with the shaped payload and a PUBLIC_LONG Cache-Control", async () => {
    st.tables.soccer_matches = { data: HEADER, error: null }
    st.tables.soccer_match_stats = { data: STATS, error: null }
    st.tables.espn_teams = { data: [{ name: "Liverpool", logo_url: "https://logo/liv.png", color: "c8102e" }], error: null }

    const { res, json } = await call({ league: "eng.1", season: "2025-26", matchNo: "1" })
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL.PUBLIC_LONG)
    expect(json.success).toBe(true)
    expect(json.data).toMatchObject({
      matchKey: "eng.1/2025-26/1",
      leagueName: "Premier League",
      homeTeam: "Liverpool",
      awayTeam: "AFC Bournemouth",
      homeScore: 4,
      awayScore: 2,
      homeLogo: "https://logo/liv.png",
      awayLogo: null,
      hasStats: true,
    })
    expect(json.data.periods.map((p: { period: string }) => p.period)).toEqual(["FT", "1H"])
    expect(json.data.periods[0].groups[0].stats[0]).toEqual({
      label: "Corners", home: "9", away: "3", homeValue: 9, awayValue: 3,
    })

    // Every read is filtered by the validated key.
    for (const table of ["soccer_matches", "soccer_match_stats"]) {
      const eqs = st.calls.filter((c) => c.table === table && c.op === "eq").map((c) => c.args)
      expect(eqs, table).toEqual([["league", "eng.1"], ["season", "2025-26"], ["match_no", 1]])
    }
    const teamIn = st.calls.find((c) => c.table === "espn_teams" && c.op === "in")
    expect(teamIn?.args).toEqual(["name", ["Liverpool", "AFC Bournemouth"]])
  })

  it("200 with hasStats:false and periods:[] for a no-stats match (no stats read)", async () => {
    st.tables.soccer_matches = { data: { ...HEADER, has_stats: false }, error: null }
    st.tables.espn_teams = { data: [], error: null }
    const { res, json } = await call({ league: "eng.1", season: "2025-26", matchNo: "1" })
    expect(res.status).toBe(200)
    expect(json.data.hasStats).toBe(false)
    expect(json.data.periods).toEqual([])
    expect(st.calls.some((c) => c.table === "soccer_match_stats")).toBe(false)
  })

  it("an espn_teams error is swallowed (no logos/colors)", async () => {
    st.tables.soccer_matches = { data: HEADER, error: null }
    st.tables.soccer_match_stats = { data: STATS, error: null }
    st.tables.espn_teams = { data: null, error: { message: "boom" } }
    const { res, json } = await call({ league: "eng.1", season: "2025-26", matchNo: "1" })
    expect(res.status).toBe(200)
    expect(json.data.homeLogo).toBeNull()
    expect(json.data.homeColor).toBeNull()
  })

  it("502 with a non-public Cache-Control on a builder error, logging the message only", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    st.tables.soccer_matches = { data: HEADER, error: null }
    st.tables.soccer_match_stats = { data: null, error: { message: 'relation "soccer_match_stats" does not exist' } }
    const { res, json } = await call({ league: "eng.1", season: "2025-26", matchNo: "1" })
    expect(res.status).toBe(502)
    expect(json).toEqual({ error: "Failed to fetch match stats", success: false })
    expect(res.headers.get("Cache-Control")).not.toMatch(/public/)
    expect(res.headers.get("Cache-Control")).toBe(CACHE_CONTROL.SENSITIVE)
    expect(errorSpy).toHaveBeenCalledWith("Soccer match stats API error:", 'relation "soccer_match_stats" does not exist')
  })

  it("502 when the soccer_matches read errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    st.tables.soccer_matches = { data: null, error: { message: "timeout" } }
    const { res } = await call({ league: "fra.1", season: "2026-27", matchNo: "12" })
    expect(res.status).toBe(502)
    expect(res.headers.get("Cache-Control")).not.toMatch(/public/)
  })
})
