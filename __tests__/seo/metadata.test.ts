/**
 * Unit tests for lib/seo/metadata.ts
 * Validates metadata generation functions meet SEO length constraints and patterns.
 */

import { describe, it, expect } from "vitest"
import {
  generatePlayerTitle,
  generatePlayerDescription,
  generatePropsTitle,
  generatePropsDescription,
  generateScoresTitle,
  generateScoresDescription,
} from "@/lib/seo/metadata"

// ─── generatePlayerTitle ────────────────────────────────────────────────────

describe("generatePlayerTitle", () => {
  it("generates title with short player name that fits", () => {
    // "Ja Morant" is 9 chars — fits within the budget before suffix
    const title = generatePlayerTitle("Ja Morant")
    expect(title).toContain("Ja Morant")
    expect(title).toContain("Props Today")
    expect(title.length).toBeLessThanOrEqual(60)
  })

  it("truncates names that exceed available space", () => {
    const title = generatePlayerTitle("LeBron James")
    expect(title).toContain("Props Today")
    expect(title.length).toBeLessThanOrEqual(60)
  })

  it("generates title within 60 chars for typical names", () => {
    const title = generatePlayerTitle("Victor Wembanyama")
    expect(title.length).toBeLessThanOrEqual(60)
  })

  it("truncates long player names to stay within 60 chars", () => {
    const title = generatePlayerTitle("Giannis Antetokounmpo-Richardson")
    expect(title.length).toBeLessThanOrEqual(60)
    expect(title).toContain("…")
  })

  it("handles empty name gracefully", () => {
    const title = generatePlayerTitle("")
    expect(title.length).toBeLessThanOrEqual(60)
    expect(title).toContain("Props Today")
  })

  it("trims whitespace from player name", () => {
    const title = generatePlayerTitle("  Ja Morant  ")
    expect(title).toContain("Ja Morant")
    expect(title.length).toBeLessThanOrEqual(60)
  })
})

// ─── generatePlayerDescription ──────────────────────────────────────────────

describe("generatePlayerDescription", () => {
  it("generates description between 120-160 chars", () => {
    const desc = generatePlayerDescription("LeBron James", "Points", 25.5, 72, "A")
    expect(desc.length).toBeGreaterThanOrEqual(120)
    expect(desc.length).toBeLessThanOrEqual(160)
  })

  it("includes player name, stat, prop line, hit rate, and grade", () => {
    const desc = generatePlayerDescription("Stephen Curry", "3-Pointers", 4.5, 65, "B")
    expect(desc).toContain("Stephen Curry")
    expect(desc).toContain("3-Pointers")
    expect(desc).toContain("4.5")
    expect(desc).toContain("65")
    expect(desc).toContain("B")
  })

  it("handles long player names within constraints", () => {
    const desc = generatePlayerDescription(
      "Giannis Antetokounmpo",
      "Points + Rebounds + Assists",
      45.5,
      58,
      "C"
    )
    expect(desc.length).toBeGreaterThanOrEqual(120)
    expect(desc.length).toBeLessThanOrEqual(160)
  })

  it("handles short player names within constraints", () => {
    const desc = generatePlayerDescription("Ja Morant", "Points", 22.5, 80, "A")
    expect(desc.length).toBeGreaterThanOrEqual(120)
    expect(desc.length).toBeLessThanOrEqual(160)
  })
})

// ─── generatePropsTitle ─────────────────────────────────────────────────────

describe("generatePropsTitle", () => {
  it("generates title with correct date format", () => {
    const date = new Date(2025, 0, 15) // January 15, 2025
    const title = generatePropsTitle(date)
    expect(title).toBe("Today's Player Props — January 15, 2025 | Hit Rates & Picks")
  })

  it("follows the expected pattern", () => {
    const date = new Date(2025, 5, 3) // June 3, 2025
    const title = generatePropsTitle(date)
    expect(title).toContain("Today's Player Props")
    expect(title).toContain("June 3, 2025")
    expect(title).toContain("Hit Rates & Picks")
  })
})

// ─── generatePropsDescription ───────────────────────────────────────────────

describe("generatePropsDescription", () => {
  it("generates description within 160 chars", () => {
    const desc = generatePropsDescription(150, ["NBA", "NFL", "MLB"])
    expect(desc.length).toBeLessThanOrEqual(160)
    expect(desc.length).toBeGreaterThan(0)
  })

  it("includes prop count and sports", () => {
    const desc = generatePropsDescription(85, ["NBA", "NHL"])
    expect(desc).toContain("85")
    expect(desc).toContain("NBA")
    expect(desc).toContain("NHL")
  })

  it("handles empty sports array", () => {
    const desc = generatePropsDescription(50, [])
    expect(desc.length).toBeLessThanOrEqual(160)
    expect(desc.length).toBeGreaterThan(0)
  })

  it("handles many sports without exceeding 160 chars", () => {
    const desc = generatePropsDescription(200, [
      "NBA", "NFL", "NHL", "MLB", "Premier League", "Champions League", "MLS",
    ])
    expect(desc.length).toBeLessThanOrEqual(160)
  })

  it("handles zero prop count", () => {
    const desc = generatePropsDescription(0, ["NBA"])
    expect(desc.length).toBeLessThanOrEqual(160)
    expect(desc).toContain("0")
  })
})

// ─── generateScoresTitle ────────────────────────────────────────────────────

describe("generateScoresTitle", () => {
  it("generates title with sport name and short date", () => {
    const date = new Date(2025, 0, 15) // January 15, 2025
    const title = generateScoresTitle("NBA", date)
    expect(title).toBe("NBA Live Scores Today — Jan 15, 2025")
  })

  it("follows the expected pattern", () => {
    const date = new Date(2025, 11, 25) // December 25, 2025
    const title = generateScoresTitle("Premier League", date)
    expect(title).toContain("Premier League")
    expect(title).toContain("Live Scores Today")
    expect(title).toContain("Dec 25, 2025")
  })
})

// ─── generateScoresDescription ──────────────────────────────────────────────

describe("generateScoresDescription", () => {
  it("generates description within 160 chars", () => {
    const desc = generateScoresDescription("NBA", 12, 3, 5)
    expect(desc.length).toBeLessThanOrEqual(160)
    expect(desc.length).toBeGreaterThan(0)
  })

  it("includes sport name, match count, live count, and upcoming count", () => {
    const desc = generateScoresDescription("NFL", 8, 2, 4)
    expect(desc).toContain("NFL")
    expect(desc).toContain("8")
    expect(desc).toContain("2")
    expect(desc).toContain("4")
  })

  it("handles zero matches", () => {
    const desc = generateScoresDescription("NHL", 0, 0, 0)
    expect(desc.length).toBeLessThanOrEqual(160)
    expect(desc).toContain("No")
    expect(desc).toContain("NHL")
  })

  it("handles large numbers within 160 chars", () => {
    const desc = generateScoresDescription("Premier League", 100, 50, 30)
    expect(desc.length).toBeLessThanOrEqual(160)
  })
})
