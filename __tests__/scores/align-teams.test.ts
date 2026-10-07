/**
 * Unit tests for lib/scores/alignTeams.
 * ESPN lists boxscore teams away-first; the match modal header renders home on
 * the left. These helpers bind each stats entry to the correct header side.
 */
import { describe, it, expect } from "vitest"
import { alignHomeAway, normalizeTeamName, orderHomeFirst } from "@/lib/scores/alignTeams"

const match = { homeTeam: "Golden State Warriors", awayTeam: "Los Angeles Lakers" }

type Entry = { team: string; teamId?: string; abbreviation?: string; homeAway?: "home" | "away" }

const lakers: Entry = { team: "Los Angeles Lakers", teamId: "13", abbreviation: "LAL" }
const warriors: Entry = { team: "Golden State Warriors", teamId: "9", abbreviation: "GS" }

describe("normalizeTeamName", () => {
  it("lowercases and strips non-alphanumerics", () => {
    expect(normalizeTeamName("Golden State Warriors")).toBe("goldenstatewarriors")
    expect(normalizeTeamName("  St. Louis Blues! ")).toBe("stlouisblues")
    expect(normalizeTeamName(undefined)).toBe("")
  })
})

describe("alignHomeAway", () => {
  it("uses homeAway flags when ESPN lists the away team first", () => {
    const entries = [{ ...lakers, homeAway: "away" as const }, { ...warriors, homeAway: "home" as const }]
    const { home, away } = alignHomeAway(entries, match)
    expect(home?.team).toBe("Golden State Warriors")
    expect(away?.team).toBe("Los Angeles Lakers")
  })

  it("matches by exact team name when flags are missing (legacy stored data)", () => {
    const { home, away } = alignHomeAway([lakers, warriors], match)
    expect(home).toBe(warriors)
    expect(away).toBe(lakers)
  })

  it("matches names regardless of case and punctuation", () => {
    const entries = [{ team: "LOS ANGELES LAKERS" }, { team: "golden-state warriors" }]
    const { home, away } = alignHomeAway(entries, match)
    expect(home).toBe(entries[1])
    expect(away).toBe(entries[0])
  })

  it("resolves the other side by elimination when only one name matches", () => {
    const entries = [{ team: "LA Lakers" }, { team: "Golden State Warriors" }]
    const { home, away } = alignHomeAway(entries, match)
    expect(home).toBe(entries[1])
    expect(away).toBe(entries[0])
  })

  it("falls back to ESPN's away-first convention when nothing else matches", () => {
    const entries = [{ team: "Team A" }, { team: "Team B" }]
    const { home, away } = alignHomeAway(entries, match)
    expect(home).toBe(entries[1])
    expect(away).toBe(entries[0])
  })

  it("trusts flags over array order and names", () => {
    // Warriors listed first and flagged home; the flag decides.
    const entries = [{ ...warriors, homeAway: "home" as const }, { ...lakers, homeAway: "away" as const }]
    const { home, away } = alignHomeAway(entries, match)
    expect(home?.team).toBe("Golden State Warriors")
    expect(away?.team).toBe("Los Angeles Lakers")
  })

  it("resolves a single entry by flag or name and leaves the other side null", () => {
    expect(alignHomeAway([{ ...lakers, homeAway: "away" as const }], match)).toEqual({
      home: null,
      away: { ...lakers, homeAway: "away" },
    })
    expect(alignHomeAway([warriors], match)).toEqual({ home: warriors, away: null })
    expect(alignHomeAway([{ team: "Unknown" }], match)).toEqual({ home: null, away: null })
    expect(alignHomeAway([], match)).toEqual({ home: null, away: null })
  })
})

describe("orderHomeFirst", () => {
  it("puts the home entry first", () => {
    expect(orderHomeFirst([lakers, warriors], match)).toEqual([warriors, lakers])
  })

  it("keeps extra entries after home and away", () => {
    const extra = { team: "Extra" }
    expect(orderHomeFirst([lakers, warriors, extra], match)).toEqual([warriors, lakers, extra])
  })

  it("returns resolvable entries for a single group", () => {
    expect(orderHomeFirst([lakers], match)).toEqual([lakers])
    expect(orderHomeFirst([], match)).toEqual([])
  })
})
