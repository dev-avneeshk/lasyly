/**
 * fetchESPNSummary must carry team identity (id, abbreviation, home/away) on
 * boxscore teams and player groups, because ESPN lists them away-first.
 * It must no longer expose odds.
 */
import { describe, it, expect, vi, afterEach } from "vitest"

vi.mock("@/lib/services/circuitBreaker", () => ({
  withCircuitBreaker: (_name: string, fn: () => unknown) => fn(),
}))

import { fetchESPNSummary } from "@/lib/services/espn"

const team = (id: string, displayName: string, abbreviation: string) => ({
  id,
  displayName,
  abbreviation,
  logo: `https://a.espncdn.com/i/teamlogos/nba/500/${abbreviation.toLowerCase()}.png`,
})

const LAKERS = team("13", "Los Angeles Lakers", "LAL")
const WARRIORS = team("9", "Golden State Warriors", "GS")

const playerGroup = (t: typeof LAKERS, name: string) => ({
  team: t,
  statistics: [
    {
      labels: ["MIN", "PTS"],
      athletes: [{ athlete: { displayName: name, position: { abbreviation: "F" } }, stats: ["34", "28"] }],
    },
  ],
})

const FIXTURE = {
  header: {
    competitions: [
      {
        competitors: [
          { id: "9", homeAway: "home", team: WARRIORS },
          { id: "13", homeAway: "away", team: LAKERS },
        ],
      },
    ],
  },
  pickcenter: [{ details: "GS -6.5", overUnder: 228.5, homeTeamOdds: { moneyLine: -250 }, awayTeamOdds: { moneyLine: 200 } }],
  boxscore: {
    // ESPN order: away first, and no homeAway flag on the entries
    teams: [
      { team: LAKERS, statistics: [{ label: "FG", displayValue: "38-90" }] },
      { team: WARRIORS, statistics: [{ label: "FG", displayValue: "47-92" }] },
    ],
    players: [playerGroup(LAKERS, "LeBron James"), playerGroup(WARRIORS, "Stephen Curry")],
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchESPNSummary mapping", () => {
  it("tags boxscore teams and player groups with id, abbreviation and side", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })))

    const summary = await fetchESPNSummary("basketball/nba", "401")

    expect(summary.boxscore?.teams).toEqual([
      expect.objectContaining({ team: "Los Angeles Lakers", teamId: "13", abbreviation: "LAL", homeAway: "away" }),
      expect.objectContaining({ team: "Golden State Warriors", teamId: "9", abbreviation: "GS", homeAway: "home" }),
    ])
    expect(summary.boxscore?.players).toEqual([
      expect.objectContaining({ team: "Los Angeles Lakers", teamId: "13", abbreviation: "LAL", homeAway: "away" }),
      expect.objectContaining({ team: "Golden State Warriors", teamId: "9", abbreviation: "GS", homeAway: "home" }),
    ])

    // NBA stays single-category: one unnamed category per team.
    const away = summary.boxscore!.players[0]
    expect(away.categories).toHaveLength(1)
    expect(away.categories[0].name).toBeUndefined()
    expect(away.categories[0].labels).toEqual(["MIN", "PTS"])
    expect(away.categories[0].athletes[0].name).toBe("LeBron James")
  })

  it("prefers an entry's own homeAway flag over the header lookup", async () => {
    const fixture = structuredClone(FIXTURE)
    // No header competitors; the entries' own flags still apply.
    fixture.header.competitions[0].competitors = []
    ;(fixture.boxscore.teams[0] as Record<string, unknown>).homeAway = "away"
    ;(fixture.boxscore.teams[1] as Record<string, unknown>).homeAway = "home"
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })))

    const summary = await fetchESPNSummary("basketball/nba", "401")

    expect(summary.boxscore?.teams.map((t) => t.homeAway)).toEqual(["away", "home"])
    // No header data for player groups, so their side stays unknown.
    expect(summary.boxscore?.players.map((p) => p.homeAway)).toEqual([undefined, undefined])
  })

  it("does not expose betting odds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })))

    const summary = await fetchESPNSummary("basketball/nba", "401")

    expect(summary).not.toHaveProperty("odds")
  })
})

// ─── NFL multi-category boxscore ──────────────────────────────────────────────

const BUCS = team("27", "Tampa Bay Buccaneers", "TB")
const STEELERS = team("23", "Pittsburgh Steelers", "PIT")

const nflCategory = (
  name: string,
  labels: string[],
  athletes: Array<{ name: string; position: string; stats: string[] }>
) => ({
  name,
  labels,
  athletes: athletes.map((a) => ({
    athlete: { displayName: a.name, position: { abbreviation: a.position } },
    stats: a.stats,
  })),
})

// Buccaneers carry passing + rushing + receiving.
const bucsGroup = {
  team: BUCS,
  statistics: [
    nflCategory("passing", ["C/ATT", "YDS", "TD", "INT"], [
      { name: "Baker Mayfield", position: "QB", stats: ["25/35", "290", "3", "1"] },
    ]),
    nflCategory("rushing", ["CAR", "YDS", "TD"], [
      { name: "Rachaad White", position: "RB", stats: ["18", "95", "1"] },
    ]),
    nflCategory("receiving", ["REC", "YDS", "TD"], [
      { name: "Mike Evans", position: "WR", stats: ["7", "110", "2"] },
      { name: "Chris Godwin", position: "WR", stats: ["6", "80", "0"] },
    ]),
  ],
}

// Steelers have an EMPTY passing category but non-empty rushing + receiving,
// to lock the "don't drop the team / don't drop later categories" fix.
const steelersGroup = {
  team: STEELERS,
  statistics: [
    nflCategory("passing", ["C/ATT", "YDS", "TD", "INT"], []),
    nflCategory("rushing", ["CAR", "YDS", "TD"], [
      { name: "Najee Harris", position: "RB", stats: ["20", "85", "1"] },
    ]),
    nflCategory("receiving", ["REC", "YDS", "TD"], [
      { name: "George Pickens", position: "WR", stats: ["5", "72", "1"] },
    ]),
  ],
}

const NFL_FIXTURE = {
  header: {
    competitions: [
      {
        competitors: [
          { id: "23", homeAway: "home", team: STEELERS },
          { id: "27", homeAway: "away", team: BUCS },
        ],
      },
    ],
  },
  boxscore: {
    teams: [
      { team: BUCS, statistics: [{ label: "First Downs", displayValue: "24" }] },
      { team: STEELERS, statistics: [{ label: "First Downs", displayValue: "18" }] },
    ],
    // ESPN order: away (TB) first, home (PIT) second.
    players: [bucsGroup, steelersGroup],
  },
}

describe("fetchESPNSummary NFL multi-category mapping", () => {
  it("exposes ALL stat categories and players for BOTH teams", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(NFL_FIXTURE), { status: 200 })))

    const summary = await fetchESPNSummary("football/nfl", "401")
    const players = summary.boxscore!.players

    // Both teams present with correct names and side (regression for the
    // wrong-second-team-label bug).
    expect(players).toHaveLength(2)
    expect(players[0]).toEqual(
      expect.objectContaining({ team: "Tampa Bay Buccaneers", teamId: "27", abbreviation: "TB", homeAway: "away" })
    )
    expect(players[1]).toEqual(
      expect.objectContaining({ team: "Pittsburgh Steelers", teamId: "23", abbreviation: "PIT", homeAway: "home" })
    )

    // Tampa Bay keeps all three categories, each with its athletes (not just
    // the first category / first player).
    const bucs = players[0]
    expect(bucs.categories.map((c) => c.name)).toEqual(["passing", "rushing", "receiving"])
    expect(bucs.categories[0].athletes.map((a) => a.name)).toEqual(["Baker Mayfield"])
    expect(bucs.categories[1].athletes.map((a) => a.name)).toEqual(["Rachaad White"])
    expect(bucs.categories[2].athletes.map((a) => a.name)).toEqual(["Mike Evans", "Chris Godwin"])

    // Pittsburgh's empty passing category is dropped but the team and its other
    // categories survive.
    const steelers = players[1]
    expect(steelers.categories.map((c) => c.name)).toEqual(["rushing", "receiving"])
    expect(steelers.categories[0].athletes.map((a) => a.name)).toEqual(["Najee Harris"])
    expect(steelers.categories[1].athletes.map((a) => a.name)).toEqual(["George Pickens"])
  })
})
