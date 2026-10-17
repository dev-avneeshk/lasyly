import { describe, expect, it } from "vitest"
import { getInitialModalTab, getModalTabs } from "@/lib/scores/modalTabs"
import type { LiveMatch, MatchSummary } from "@/types"

function match(overrides: Partial<LiveMatch>): LiveMatch {
  return {
    id: "m1",
    homeTeam: "Home",
    awayTeam: "Away",
    homeScore: 1,
    awayScore: 0,
    status: "Finished",
    league: "League",
    sport: "Basketball",
    ...overrides,
  }
}

describe("getModalTabs / getInitialModalTab", () => {
  it("NBA DB boxscore (presupplied, no teams) → Box Score only, opens on boxscore", () => {
    const m = match({ sport: "Basketball", league: "NBA" })
    const presupplied: MatchSummary = {
      eventId: "nba-box-1",
      boxscore: { teams: [], players: [{ team: "BOS", categories: [] }] },
    }
    expect(getModalTabs(m, presupplied)).toEqual([{ id: "boxscore", label: "Box Score" }])
    expect(getInitialModalTab(m, presupplied)).toBe("boxscore")
  })

  it("NFL (American Football, nothing presupplied) → Team Stats / Box Score / Standings, opens on stats", () => {
    const m = match({ sport: "American Football", league: "NFL" })
    expect(getModalTabs(m)).toEqual([
      { id: "stats", label: "Team Stats" },
      { id: "boxscore", label: "Box Score" },
      { id: "standings", label: "Standings" },
    ])
    expect(getModalTabs(m, null)).toEqual(getModalTabs(m))
    expect(getInitialModalTab(m)).toBe("stats")
  })

  it("Soccer with periodStats → Match Stats only, even when periodStats is []", () => {
    const m = match({ sport: "Soccer", league: "Premier League" })
    const withStats: MatchSummary = {
      eventId: "soccer-eng.1/2026-27/45",
      boxscore: { teams: [], players: [] },
      periodStats: [{ period: "FT", label: "Full time", groups: [] }],
    }
    const empty: MatchSummary = { ...withStats, periodStats: [] }
    expect(getModalTabs(m, withStats)).toEqual([{ id: "stats", label: "Match Stats" }])
    expect(getInitialModalTab(m, withStats)).toBe("stats")
    expect(getModalTabs(m, empty)).toEqual([{ id: "stats", label: "Match Stats" }])
    expect(getInitialModalTab(m, empty)).toBe("stats")
  })

  it("Soccer without presupplied data → today's soccer tabs (no Box Score)", () => {
    const m = match({ sport: "Soccer", league: "Premier League" })
    expect(getModalTabs(m)).toEqual([
      { id: "stats", label: "Team Stats" },
      { id: "standings", label: "Standings" },
    ])
    expect(getInitialModalTab(m)).toBe("stats")
  })

  it("Upcoming → Preview only, opens on summary", () => {
    for (const sport of ["Basketball", "American Football", "Soccer", "Tennis"]) {
      const m = match({ sport, status: "Not Started" })
      expect(getModalTabs(m), sport).toEqual([{ id: "summary", label: "Preview" }])
      expect(getInitialModalTab(m), sport).toBe("summary")
    }
  })

  it("Tennis → Match Info first, opens on summary", () => {
    const m = match({ sport: "Tennis", league: "ATP" })
    const tabs = getModalTabs(m)
    expect(tabs[0]).toEqual({ id: "summary", label: "Match Info" })
    expect(tabs).toHaveLength(1)
    expect(getInitialModalTab(m)).toBe("summary")
  })
})
