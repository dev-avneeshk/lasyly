/**
 * Unit tests for lib/seo/player-slug.ts
 * Validates slug generation, sport slug map, and slug resolution.
 */

import { describe, it, expect } from "vitest"
import { playerNameToSlug, SPORT_SLUG_MAP } from "@/lib/seo/player-slug"

// ─── playerNameToSlug ───────────────────────────────────────────────────────

describe("playerNameToSlug", () => {
  it("converts a simple name to a slug", () => {
    expect(playerNameToSlug("LeBron James")).toBe("lebron-james")
  })

  it("handles names with diacritics", () => {
    expect(playerNameToSlug("Nikola Jokić")).toBe("nikola-jokic")
    expect(playerNameToSlug("José Ramírez")).toBe("jose-ramirez")
    expect(playerNameToSlug("Luka Dončić")).toBe("luka-doncic")
  })

  it("handles names with tildes", () => {
    expect(playerNameToSlug("Peña")).toBe("pena")
  })

  it("handles names with periods and suffixes", () => {
    expect(playerNameToSlug("Robert Williams III")).toBe("robert-williams-iii")
    expect(playerNameToSlug("P.J. Tucker")).toBe("p-j-tucker")
  })

  it("handles names with apostrophes", () => {
    expect(playerNameToSlug("De'Aaron Fox")).toBe("de-aaron-fox")
    expect(playerNameToSlug("Shai Gilgeous-Alexander")).toBe("shai-gilgeous-alexander")
  })

  it("handles names with multiple spaces", () => {
    expect(playerNameToSlug("Victor  Wembanyama")).toBe("victor-wembanyama")
  })

  it("trims leading and trailing hyphens", () => {
    expect(playerNameToSlug(" LeBron James ")).toBe("lebron-james")
    expect(playerNameToSlug("--LeBron James--")).toBe("lebron-james")
  })

  it("produces only lowercase letters, digits, and hyphens", () => {
    const slug = playerNameToSlug("André 'The Giant' Iguodala Jr.")
    expect(slug).toMatch(/^[a-z0-9-]+$/)
    expect(slug).not.toMatch(/^-/)
    expect(slug).not.toMatch(/-$/)
  })

  it("handles single-word names", () => {
    expect(playerNameToSlug("Neymar")).toBe("neymar")
  })

  it("handles names with numbers", () => {
    expect(playerNameToSlug("Player 23")).toBe("player-23")
  })
})

// ─── SPORT_SLUG_MAP ─────────────────────────────────────────────────────────

describe("SPORT_SLUG_MAP", () => {
  it("contains all 12 supported sport slugs", () => {
    const expectedSlugs = [
      "nba", "nfl", "nhl", "mlb",
      "premier-league", "champions-league", "mls",
      "atp", "wta", "ufc", "f1", "cricket",
    ]
    expect(Object.keys(SPORT_SLUG_MAP)).toHaveLength(12)
    for (const slug of expectedSlugs) {
      expect(SPORT_SLUG_MAP[slug]).toBeDefined()
    }
  })

  it("each entry has name and dbSport fields", () => {
    for (const [slug, entry] of Object.entries(SPORT_SLUG_MAP)) {
      expect(entry.name).toBeTruthy()
      expect(entry.dbSport).toBeTruthy()
      expect(typeof entry.name).toBe("string")
      expect(typeof entry.dbSport).toBe("string")
    }
  })

  it("maps nba correctly", () => {
    expect(SPORT_SLUG_MAP["nba"]).toEqual({ name: "NBA", dbSport: "Basketball" })
  })

  it("maps premier-league correctly", () => {
    expect(SPORT_SLUG_MAP["premier-league"]).toEqual({ name: "Premier League", dbSport: "Football" })
  })

  it("maps f1 correctly", () => {
    expect(SPORT_SLUG_MAP["f1"]).toEqual({ name: "Formula 1", dbSport: "F1" })
  })
})
