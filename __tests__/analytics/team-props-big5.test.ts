/**
 * Big-5 team props come from the imported soccer_matches / soccer_match_stats
 * tables (FT rows), with ESPN for uefa.champions / usa.1 and for every league
 * when the DB read fails.
 *
 * `cached` is mocked as a memoizing JSON round trip (like Redis), so any Map
 * returned from a cached() fetcher would come back as `{}` and break the
 * assertions below. Supabase is a per-table fake that applies eq/in/gte/lte
 * filters to the fixture rows and records every query.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

type Filter = [op: string, col: string, val: unknown]
type Call = { table: string; head: boolean; filters: Filter[] }
type Row = Record<string, unknown>

const { store, db, calls } = vi.hoisted(() => ({
  store: new Map<string, string>(),
  db: {
    tables: {} as Record<string, Row[]>,
    errors: {} as Record<string, { message: string } | undefined>,
  },
  calls: [] as Call[],
}))

vi.mock("@/lib/cache", () => ({
  cached: async (k: string, f: () => Promise<unknown>) => {
    if (!store.has(k)) store.set(k, JSON.stringify(await f()))
    return JSON.parse(store.get(k)!)
  },
  CACHE_TTL: { props: 120_000, leaderboard: 300_000 },
}))

// One page: run the head count (so its filters are recorded), then page 0.
vi.mock("@/lib/supabase/paged", () => ({
  fetchPagedParallel: async (
    count: () => Promise<number | null>,
    page: (from: number, to: number) => Promise<unknown[]>
  ) => {
    await count()
    return page(0, 999)
  },
}))

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter((r) =>
    filters.every(([op, col, val]) => {
      if (!(col in r)) return true
      const v = r[col] as string | number
      if (op === "eq") return v === val
      if (op === "in") return (val as unknown[]).includes(v)
      if (op === "gte") return v >= (val as string | number)
      if (op === "lte") return v <= (val as string | number)
      return true
    })
  )
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const call: Call = { table, head: false, filters: [] }
      calls.push(call)
      const c: Record<string, unknown> = {
        select: (_cols: string, o?: { head?: boolean }) => {
          call.head = !!o?.head
          return c
        },
        eq: (col: string, val: unknown) => (call.filters.push(["eq", col, val]), c),
        in: (col: string, val: unknown) => (call.filters.push(["in", col, val]), c),
        gte: (col: string, val: unknown) => (call.filters.push(["gte", col, val]), c),
        lte: (col: string, val: unknown) => (call.filters.push(["lte", col, val]), c),
        not: () => c,
        order: () => c,
        range: () => c,
        limit: () => c,
        then: (resolve: (v: unknown) => unknown) => {
          const error = db.errors[table]
          if (error) return resolve({ data: null, count: null, error })
          const rows = applyFilters(db.tables[table] ?? [], call.filters)
          if (call.head) return resolve({ count: rows.length, error: null })
          return resolve({ data: rows, error: null })
        },
      }
      return c
    },
  }),
}))

import { computeTeamProps, type TeamPropCard, type TeamPropStat } from "@/lib/analytics/engine-team-props"
import { BIG5_LEAGUE_CODES } from "@/lib/soccer/big5"

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** UTC today minus `n` days, as YYYY-MM-DD (negative = future). */
function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

const SEASON = "2026-27"
const N = 7 // matches per pair; the oldest lacks a Red cards row

const PAIRS = [
  { league: "eng.1", a: "Arsenal", b: "Brighton & Hove Albion", base: 100 },
  { league: "esp.1", a: "Atlético Madrid", b: "Sevilla", base: 200 },
  { league: "fra.1", a: "Paris Saint-Germain", b: "Lyon", base: 300 },
]

// Per-team values (constant, so every team gets one "under" card).
const A = { corners: 7, yellow: 2, red: 1, fouls: 11, shots: 14, sot: 5, goals: 2 }
const B = { corners: 3, yellow: 1, red: 0, fouls: 13, shots: 9, sot: 2, goals: 1 }

function buildFixtures() {
  const soccer_matches: Row[] = []
  const soccer_match_stats: Row[] = []
  let statId = 1

  for (const p of PAIRS) {
    for (let i = 0; i < N; i++) {
      const aHome = i % 2 === 0
      const hv = aHome ? A : B
      const av = aHome ? B : A
      const base = {
        league: p.league,
        season: SEASON,
        match_no: p.base + i,
        match_date: daysAgo(2 + i * 3),
        home_team: aHome ? p.a : p.b,
        away_team: aHome ? p.b : p.a,
      }
      soccer_matches.push({ id: `${p.league}-${SEASON}-${p.base + i}`, ...base, home_score: hv.goals, away_score: av.goals })

      const row = (period: string, stat_group: string, stat_name: string, h: unknown, a: unknown) =>
        soccer_match_stats.push({ id: statId++, ...base, period, stat_group, stat_name, home_value: h, away_value: a })

      // PostgREST returns numeric as strings: corners prove the Number() coercion.
      row("FT", "Top stats", "Corners", String(hv.corners), String(av.corners))
      // Decoys the period/group filters must exclude.
      row("1H", "Top stats", "Corners", 99, 99)
      row("FT", "Top stats", "Total shots", 99, 99)
      row("FT", "Top stats", "Shots on target", 99, 99)
      row("FT", "Top stats", "Yellow cards", 99, 99)
      row("FT", "Shots", "Total shots", hv.shots, av.shots)
      row("FT", "Shots", "Shots on target", hv.sot, av.sot)
      row("FT", "Discipline", "Yellow cards", hv.yellow, av.yellow)
      if (i !== N - 1) row("FT", "Discipline", "Red cards", hv.red, av.red)
      row("FT", "Discipline", "Fouls committed", hv.fouls, av.fouls)
    }
  }

  const espn_games: Row[] = [
    { id: "up-1", league: "eng.1", status: "scheduled", match_date: daysAgo(-2), home_team: "Arsenal", away_team: "Chelsea" },
  ]
  const espn_player_stats: Row[] = []
  let psId = 1
  const ps = (game: Row, team: string, stats: Record<string, number>) =>
    espn_player_stats.push({
      id: `ps-${psId++}`, game_id: game.id, team, league: game.league, match_date: game.match_date, stats,
    })

  // usa.1: ESPN only.
  for (let i = 0; i < 6; i++) {
    const g = {
      id: `mls-${i}`, league: "usa.1", status: "completed", match_date: daysAgo(3 + i * 4),
      home_team: "LA Galaxy", away_team: "Seattle Sounders FC", home_score: 3, away_score: 0,
      home_logo: null, away_logo: null,
    }
    espn_games.push(g)
    ps(g, "LA Galaxy", { yellowCards: 1, totalShots: 6, foulsCommitted: 5 })
    ps(g, "LA Galaxy", { yellowCards: 1, totalShots: 6, foulsCommitted: 5 })
    ps(g, "Seattle Sounders FC", { yellowCards: 1, totalShots: 4, foulsCommitted: 7 })
  }
  // UCL rows for a DB team (Arsenal): must be ignored while the DB covers it.
  for (let i = 0; i < 2; i++) {
    const g = {
      id: `ucl-${i}`, league: "uefa.champions", status: "completed", match_date: daysAgo(1),
      home_team: "Arsenal", away_team: "PSV", home_score: 5, away_score: 0, home_logo: null, away_logo: null,
    }
    espn_games.push(g)
    ps(g, "Arsenal", { yellowCards: 4 })
  }
  // eng.1 ESPN copies: only reachable on the full ESPN fallback.
  for (let i = 0; i < 6; i++) {
    const g = {
      id: `epl-${i}`, league: "eng.1", status: "completed", match_date: daysAgo(2 + i * 3),
      home_team: "Arsenal", away_team: "Brighton & Hove Albion", home_score: 4, away_score: 4,
      home_logo: null, away_logo: null,
    }
    espn_games.push(g)
    ps(g, "Arsenal", { yellowCards: 1 })
    ps(g, "Arsenal", { yellowCards: 1 })
    ps(g, "Brighton & Hove Albion", { yellowCards: 1 })
  }

  const espn_teams: Row[] = [
    { name: "Arsenal", league: "eng.1", logo_url: "https://example.test/arsenal.png" },
  ]

  return { soccer_matches, soccer_match_stats, espn_games, espn_player_stats, espn_teams }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function card(props: TeamPropCard[], team: string): TeamPropCard {
  const found = props.find((p) => p.team === team)
  expect(found, `no card for ${team}`).toBeDefined()
  return found!
}

function reads(table: string): Call[] {
  return calls.filter((c) => c.table === table && !c.head)
}

const ALL_TEAMS = PAIRS.flatMap((p) => [p.a, p.b])

beforeEach(() => {
  store.clear()
  calls.length = 0
  db.tables = buildFixtures()
  db.errors = {}
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("team props from soccer_match_stats", () => {
  it("corners: FT Top stats/Corners with the right side, opponent and matchKey", async () => {
    const { props } = await computeTeamProps("team_corners")

    const arsenal = card(props, "Arsenal")
    expect(arsenal.league).toBe("Premier League")
    expect(arsenal.lastGames).toHaveLength(N)
    expect(arsenal.lastGames.every((g) => g.value === A.corners)).toBe(true)
    expect(arsenal.lastGames.every((g) => g.opponent === "Brighton & Hove Albion")).toBe(true)
    // Most recent first: match 100 (2 days ago), home.
    expect(arsenal.lastGames.map((g) => g.matchKey)).toEqual(
      Array.from({ length: N }, (_, i) => `eng.1/${SEASON}/${100 + i}`)
    )
    expect(arsenal.logoUrl).toBe("https://example.test/arsenal.png")

    const brighton = card(props, "Brighton & Hove Albion")
    expect(brighton.lastGames.every((g) => g.value === B.corners)).toBe(true)
    expect(brighton.lastGames[0].opponent).toBe("Arsenal")
    expect(brighton.lastGames[0].matchKey).toBe(`eng.1/${SEASON}/100`)

    const call = reads("soccer_match_stats")[0]
    expect(call.filters).toEqual(
      expect.arrayContaining([
        ["eq", "period", "FT"],
        ["eq", "stat_group", "Top stats"],
        ["in", "stat_name", ["Corners"]],
        ["in", "league", [...BIG5_LEAGUE_CODES]],
      ])
    )
    // The head count uses the same filters.
    const head = calls.find((c) => c.table === "soccer_match_stats" && c.head)!
    expect(head.filters).toEqual(call.filters)
  })

  it("cards = yellow + red; a match missing a component is skipped", async () => {
    const { props } = await computeTeamProps("team_cards")

    const arsenal = card(props, "Arsenal")
    expect(arsenal.lastGames).toHaveLength(N - 1)
    expect(arsenal.lastGames.every((g) => g.value === A.yellow + A.red)).toBe(true)
    expect(arsenal.lastGames.map((g) => g.matchKey)).not.toContain(`eng.1/${SEASON}/${100 + N - 1}`)

    const sevilla = card(props, "Sevilla")
    expect(sevilla.lastGames.every((g) => g.value === B.yellow + B.red)).toBe(true)

    expect(reads("soccer_match_stats")[0].filters).toEqual(
      expect.arrayContaining([
        ["eq", "stat_group", "Discipline"],
        ["in", "stat_name", ["Yellow cards", "Red cards"]],
      ])
    )
  })

  it.each([
    ["team_shots", "Shots", ["Total shots"], A.shots, B.shots],
    ["team_shotsOnTarget", "Shots", ["Shots on target"], A.sot, B.sot],
    ["team_fouls", "Discipline", ["Fouls committed"], A.fouls, B.fouls],
  ] as const)("%s reads stat_group %s / %j", async (stat, group, names, aValue, bValue) => {
    const { props } = await computeTeamProps(stat as TeamPropStat)

    const psg = card(props, "Paris Saint-Germain")
    expect(psg.lastGames).toHaveLength(N)
    expect(psg.lastGames.every((g) => g.value === aValue)).toBe(true)
    expect(psg.lastGames[0].matchKey).toBe(`fra.1/${SEASON}/300`)
    expect(card(props, "Lyon").lastGames.every((g) => g.value === bValue)).toBe(true)

    expect(reads("soccer_match_stats")[0].filters).toEqual(
      expect.arrayContaining([
        ["eq", "period", "FT"],
        ["eq", "stat_group", group],
        ["in", "stat_name", [...names]],
      ])
    )
  })

  it("goals come from soccer_matches", async () => {
    const team = await computeTeamProps("team_totalGoals")
    const arsenal = card(team.props, "Arsenal")
    expect(arsenal.lastGames).toHaveLength(N)
    expect(arsenal.lastGames.every((g) => g.value === A.goals)).toBe(true)
    expect(arsenal.lastGames[0].matchKey).toBe(`eng.1/${SEASON}/100`)
    expect(card(team.props, "Brighton & Hove Albion").lastGames.every((g) => g.value === B.goals)).toBe(true)

    const match = await computeTeamProps("team_matchGoals")
    expect(card(match.props, "Sevilla").lastGames.every((g) => g.value === A.goals + B.goals)).toBe(true)

    expect(reads("soccer_matches").length).toBeGreaterThan(0)
    expect(reads("soccer_matches")[0].filters).toEqual([["in", "league", [...BIG5_LEAGUE_CODES]]])
    expect(reads("soccer_match_stats")).toHaveLength(0)
  })

  it("a DB error sends every league through ESPN, with one warning", async () => {
    db.errors.soccer_match_stats = { message: 'relation "public.soccer_match_stats" does not exist' }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { props } = await computeTeamProps("team_cards")

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toBe("[team-props] soccer DB read failed for team_cards; using ESPN:")
    expect(warn.mock.calls[0][1]).toContain("does not exist")

    // ESPN aggregates were read for all 7 leagues.
    const espnRead = reads("espn_player_stats")[0]
    const leagues = espnRead.filters.find(([op, col]) => op === "in" && col === "league")![2] as string[]
    expect([...leagues].sort()).toEqual(
      ["eng.1", "esp.1", "fra.1", "ger.1", "ita.1", "uefa.champions", "usa.1"]
    )

    // Arsenal now comes from ESPN: eng.1 + UCL games, opponents from espn_games, no matchKey.
    const arsenal = card(props, "Arsenal")
    expect(arsenal.league).toBe("Premier League")
    expect(arsenal.lastGames).toHaveLength(8)
    expect(arsenal.lastGames[0].opponent).toBe("PSV")
    expect(arsenal.lastGames.filter((g) => g.opponent === "Brighton & Hove Albion")).toHaveLength(6)
    expect(arsenal.lastGames.every((g) => g.matchKey === undefined)).toBe(true)
  })

  it("a usa.1 team comes from ESPN; ESPN rows for a DB team are ignored", async () => {
    const { props } = await computeTeamProps("team_cards")

    const galaxy = card(props, "LA Galaxy")
    expect(galaxy.league).toBe("MLS")
    expect(galaxy.lastGames).toHaveLength(6)
    expect(galaxy.lastGames.every((g) => g.value === 2)).toBe(true)
    expect(galaxy.lastGames.every((g) => g.opponent === "Seattle Sounders FC")).toBe(true)

    // The ESPN read skipped the DB-covered leagues.
    const leagues = reads("espn_player_stats")[0].filters.find(([op, col]) => op === "in" && col === "league")![2]
    expect([...(leagues as string[])].sort()).toEqual(["ger.1", "ita.1", "uefa.champions", "usa.1"])

    // Arsenal's UCL games (ESPN) are dropped: only the DB history remains.
    const arsenal = card(props, "Arsenal")
    expect(arsenal.lastGames.every((g) => g.opponent === "Brighton & Hove Albion")).toBe(true)
    expect(arsenal.lastGames.every((g) => typeof g.matchKey === "string")).toBe(true)
    expect(store.has("soccer-espn-team-games:v1:ger.1,ita.1,uefa.champions,usa.1")).toBe(true)
  })

  it("upcomingOpponent survives the JSON round trip", async () => {
    const first = await computeTeamProps("team_corners")
    expect(card(first.props, "Arsenal").upcomingOpponent).toBe("Chelsea")
    expect(card(first.props, "Arsenal").matchup).toBe("Chelsea")

    // Second stat: upcoming + logos are served from the round-tripped cache.
    const second = await computeTeamProps("team_fouls")
    expect(card(second.props, "Arsenal").upcomingOpponent).toBe("Chelsea")
    expect(card(second.props, "Arsenal").logoUrl).toBe("https://example.test/arsenal.png")
    expect(card(second.props, "Sevilla").upcomingOpponent).toBeNull()
  })

  it.each([
    ["brighton hove albion", "Brighton & Hove Albion"],
    ["atl tico madrid", "Atlético Madrid"],
    ["paris saint germain", "Paris Saint-Germain"],
  ])("normalized search %j matches %s", async (search, team) => {
    const { props } = await computeTeamProps("team_corners", { search })
    expect(props.length).toBeGreaterThan(0)
    expect(props.every((p) => p.team === team)).toBe(true)
  })

  it("'--' matches no team; '' and 'a' are unfiltered", async () => {
    expect((await computeTeamProps("team_corners", { search: "--" })).props).toEqual([])

    for (const search of ["", "a"]) {
      const teams = new Set((await computeTeamProps("team_corners", { search })).props.map((p) => p.team))
      for (const t of ALL_TEAMS) expect(teams.has(t)).toBe(true)
    }
  })

  it("two searches for one stat: two team-props:v2 keys, one soccer_match_stats read", async () => {
    await computeTeamProps("team_shots", { search: "" })
    await computeTeamProps("team_shots", { search: "arsenal" })

    expect(store.has("team-props:v2:team_shots:50:")).toBe(true)
    expect(store.has("team-props:v2:team_shots:50:arsenal")).toBe(true)
    expect(store.has("soccer-db-history:v1:team_shots")).toBe(true)
    expect(reads("soccer_match_stats")).toHaveLength(1)
  })
})
