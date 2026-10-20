import { describe, expect, it } from "vitest"
import { TEAM_NAME_TO_ABBR } from "@/lib/analytics/engine-v2"
import { toNbaAbbr } from "@/lib/novig/teams"

describe("toNbaAbbr", () => {
  it("maps the Clippers spellings ParlayAPI and nba_games use", () => {
    expect(toNbaAbbr("L.A. Clippers")).toBe("LAC")
    expect(toNbaAbbr("LA Clippers")).toBe("LAC")
    expect(toNbaAbbr("Los Angeles Clippers")).toBe("LAC")
    expect(toNbaAbbr("LA Lakers")).toBe("LAL")
  })

  it("maps all 30 full names", () => {
    const entries = Object.entries(TEAM_NAME_TO_ABBR)
    expect(entries).toHaveLength(30)
    for (const [name, abbr] of entries) expect(toNbaAbbr(name)).toBe(abbr)
    expect(new Set(entries.map(([n]) => toNbaAbbr(n))).size).toBe(30)
  })

  it("passes known abbreviations through and rejects unknown names", () => {
    expect(toNbaAbbr("BOS")).toBe("BOS")
    expect(toNbaAbbr("Seattle SuperSonics")).toBeNull()
    expect(toNbaAbbr("XYZ")).toBeNull()
    expect(toNbaAbbr("")).toBeNull()
    expect(toNbaAbbr(null)).toBeNull()
  })
})
