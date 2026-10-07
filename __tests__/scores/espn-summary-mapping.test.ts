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
