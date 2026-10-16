/**
 * The Big-5 team props add team_shots / team_shotsOnTarget / team_fouls. Every
 * prop-key consumer (the /api/props + /api/bets stat allowlist, parlay
 * validation, the stat filter tabs) has to accept them.
 */
import { describe, it, expect } from "vitest"
import { isValidStatForSport } from "@/lib/props/statCatalog"
import { validateCreateParlay } from "@/lib/parlays/validation"
import { SOCCER_STAT_FILTERS, STAT_LABELS } from "@/lib/props/constants"
import { getTodayET } from "@/lib/props/dates"

const NEW_KEYS = ["team_shots", "team_shotsOnTarget", "team_fouls"] as const

function soccerLeg(stat: string, team: string) {
  return {
    player_name: team,
    stat_category: stat,
    prop_line: 10.5,
    direction: "over",
    l10_hit_rate: 60,
    sport: "Soccer",
  }
}

describe("soccer team stat catalog", () => {
  it.each(NEW_KEYS)("isValidStatForSport('Soccer', %s)", (key) => {
    expect(isValidStatForSport("Soccer", key)).toBe(true)
  })

  it("validateCreateParlay accepts a Soccer team_fouls leg", () => {
    const result = validateCreateParlay({
      legs: [soccerLeg("team_fouls", "Arsenal"), soccerLeg("team_shots", "Chelsea")],
      visibility: "public",
      odds: null,
      stake: null,
      custom_note: null,
      combined_hit_rate: null,
    })
    expect(result.errors).toHaveLength(0)
    expect(result.valid).toBe(true)
  })

  it("SOCCER_STAT_FILTERS lists every team stat in display order", () => {
    expect(SOCCER_STAT_FILTERS.map((f) => [f.key, f.label])).toEqual([
      ["all", "All"],
      ["team_totalGoals", "Team Goals"],
      ["team_matchGoals", "Match Goals"],
      ["team_cards", "Cards"],
      ["team_corners", "Corners"],
      ["team_shots", "Shots"],
      ["team_shotsOnTarget", "Shots on Target"],
      ["team_fouls", "Fouls"],
    ])
  })

  it("STAT_LABELS has labels for the new keys", () => {
    expect(STAT_LABELS.team_shots).toBe("Shots")
    expect(STAT_LABELS.team_shotsOnTarget).toBe("Shots on Target")
    expect(STAT_LABELS.team_fouls).toBe("Fouls")
  })

  it("getTodayET returns YYYY-MM-DD", () => {
    expect(getTodayET()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
