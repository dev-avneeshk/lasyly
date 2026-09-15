import { describe, expect, it } from "vitest"
import {
  isHeadshotNameMatch,
  normalizeHeadshotName,
} from "@/lib/players/headshotResolver"

describe("headshot name resolution", () => {
  it.each([
    ["Nikola Jokić", "nikola jokic"],
    ["Luka Dončić", "luka doncic"],
    ["Alperen Şengün", "alperen sengun"],
    ["D'Angelo Russell", "d angelo russell"],
  ])("normalizes %s for provider lookup", (input, expected) => {
    expect(normalizeHeadshotName(input)).toBe(expected)
  })

  it.each([
    ["Nikola Jokić", "Nikola Jokic"],
    ["Luka Dončić", "Luka Doncic"],
    ["Alperen Şengün", "Alperen Sengun"],
    ["Kentavious Caldwell-Pope", "Kentavious Caldwell Pope"],
  ])("matches canonical name %s to provider name %s", (canonical, provider) => {
    expect(isHeadshotNameMatch(canonical, provider)).toBe(true)
  })

  it("does not confuse similarly spelled players", () => {
    expect(isHeadshotNameMatch("Nikola Jokić", "Nikola Jović")).toBe(false)
  })

  it("matches a shortened provider name only when the shared name is meaningful", () => {
    expect(isHeadshotNameMatch("LeBron James Jr.", "LeBron James")).toBe(true)
    expect(isHeadshotNameMatch("AJ Green", "A Green")).toBe(false)
  })
})
