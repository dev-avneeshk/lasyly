/**
 * Unit tests for lib/parlays/validation.ts
 */

import { describe, it, expect } from "vitest"
import { validateCreateParlay } from "@/lib/parlays/validation"

function validLeg(overrides: Record<string, unknown> = {}) {
  return {
    player_name: "LeBron James",
    stat_category: "Points",
    prop_line: 25.5,
    direction: "over",
    l10_hit_rate: 70,
    sport: "NBA",
    ...overrides,
  }
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    legs: [validLeg(), validLeg({ player_name: "Stephen Curry" })],
    visibility: "public",
    odds: null,
    stake: null,
    custom_note: null,
    combined_hit_rate: null,
    ...overrides,
  }
}

describe("validateCreateParlay", () => {
  describe("valid payloads", () => {
    it("accepts a minimal valid payload with 2 legs", () => {
      const result = validateCreateParlay(validPayload())
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("accepts a payload with all optional fields provided", () => {
      const result = validateCreateParlay(
        validPayload({
          odds: 150,
          stake: 50.0,
          custom_note: "Lock of the day",
          combined_hit_rate: 45.5,
        })
      )
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it("accepts 10 legs (maximum)", () => {
      const legs = Array.from({ length: 10 }, (_, i) =>
        validLeg({ player_name: `Player ${i}` })
      )
      const result = validateCreateParlay(validPayload({ legs }))
      expect(result.valid).toBe(true)
    })

    it("accepts negative odds", () => {
      const result = validateCreateParlay(validPayload({ odds: -110 }))
      expect(result.valid).toBe(true)
    })

    it("accepts boundary odds values", () => {
      expect(validateCreateParlay(validPayload({ odds: -10000 })).valid).toBe(true)
      expect(validateCreateParlay(validPayload({ odds: 10000 })).valid).toBe(true)
    })

    it("accepts boundary stake values", () => {
      expect(validateCreateParlay(validPayload({ stake: 0.01 })).valid).toBe(true)
      expect(validateCreateParlay(validPayload({ stake: 99999.99 })).valid).toBe(true)
    })
  })

  describe("body-level validation", () => {
    it("rejects null body", () => {
      const result = validateCreateParlay(null)
      expect(result.valid).toBe(false)
      expect(result.errors[0].field).toBe("body")
    })

    it("rejects undefined body", () => {
      const result = validateCreateParlay(undefined)
      expect(result.valid).toBe(false)
    })

    it("rejects non-object body", () => {
      const result = validateCreateParlay("string")
      expect(result.valid).toBe(false)
    })
  })

  describe("legs validation", () => {
    it("rejects fewer than 2 legs", () => {
      const result = validateCreateParlay(validPayload({ legs: [validLeg()] }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "legs")).toBe(true)
    })

    it("rejects more than 10 legs", () => {
      const legs = Array.from({ length: 11 }, (_, i) =>
        validLeg({ player_name: `Player ${i}` })
      )
      const result = validateCreateParlay(validPayload({ legs }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "legs")).toBe(true)
    })

    it("rejects empty legs array", () => {
      const result = validateCreateParlay(validPayload({ legs: [] }))
      expect(result.valid).toBe(false)
    })

    it("rejects non-array legs", () => {
      const result = validateCreateParlay(validPayload({ legs: "not an array" }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "legs")).toBe(true)
    })
  })

  describe("leg field validation", () => {
    it("rejects missing player_name", () => {
      const leg = validLeg()
      delete (leg as Record<string, unknown>).player_name
      const result = validateCreateParlay(validPayload({ legs: [leg, validLeg()] }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "legs[0].player_name")).toBe(true)
    })

    it("rejects player_name exceeding 100 characters", () => {
      const result = validateCreateParlay(
        validPayload({ legs: [validLeg({ player_name: "A".repeat(101) }), validLeg()] })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "legs[0].player_name")).toBe(true)
    })

    it("rejects invalid direction value", () => {
      const result = validateCreateParlay(
        validPayload({ legs: [validLeg({ direction: "sideways" }), validLeg()] })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "legs[0].direction")).toBe(true)
    })

    it("rejects prop_line below 0.5", () => {
      const result = validateCreateParlay(
        validPayload({ legs: [validLeg({ prop_line: 0.4 }), validLeg()] })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "legs[0].prop_line")).toBe(true)
    })

    it("rejects prop_line above 999.5", () => {
      const result = validateCreateParlay(
        validPayload({ legs: [validLeg({ prop_line: 1000 }), validLeg()] })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "legs[0].prop_line")).toBe(true)
    })

    it("rejects l10_hit_rate below 0", () => {
      const result = validateCreateParlay(
        validPayload({ legs: [validLeg({ l10_hit_rate: -1 }), validLeg()] })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "legs[0].l10_hit_rate")).toBe(true)
    })

    it("rejects l10_hit_rate above 100", () => {
      const result = validateCreateParlay(
        validPayload({ legs: [validLeg({ l10_hit_rate: 101 }), validLeg()] })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "legs[0].l10_hit_rate")).toBe(true)
    })

    it("rejects missing sport", () => {
      const leg = validLeg()
      delete (leg as Record<string, unknown>).sport
      const result = validateCreateParlay(validPayload({ legs: [leg, validLeg()] }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "legs[0].sport")).toBe(true)
    })
  })

  describe("visibility validation", () => {
    it("rejects missing visibility", () => {
      const payload = validPayload()
      delete (payload as Record<string, unknown>).visibility
      const result = validateCreateParlay(payload)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "visibility")).toBe(true)
    })

    it("rejects invalid visibility value", () => {
      const result = validateCreateParlay(validPayload({ visibility: "unlisted" }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "visibility")).toBe(true)
    })
  })

  describe("odds validation", () => {
    it("rejects odds below -10000", () => {
      const result = validateCreateParlay(validPayload({ odds: -10001 }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "odds")).toBe(true)
    })

    it("rejects odds above 10000", () => {
      const result = validateCreateParlay(validPayload({ odds: 10001 }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "odds")).toBe(true)
    })

    it("rejects non-numeric odds", () => {
      const result = validateCreateParlay(validPayload({ odds: "abc" }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "odds")).toBe(true)
    })
  })

  describe("stake validation", () => {
    it("rejects stake below 0.01", () => {
      const result = validateCreateParlay(validPayload({ stake: 0.001 }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "stake")).toBe(true)
    })

    it("rejects stake above 99999.99", () => {
      const result = validateCreateParlay(validPayload({ stake: 100000 }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "stake")).toBe(true)
    })
  })

  describe("custom_note validation", () => {
    it("rejects custom_note exceeding 280 characters", () => {
      const result = validateCreateParlay(validPayload({ custom_note: "A".repeat(281) }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "custom_note")).toBe(true)
    })

    it("accepts custom_note at exactly 280 characters", () => {
      const result = validateCreateParlay(validPayload({ custom_note: "A".repeat(280) }))
      expect(result.valid).toBe(true)
    })
  })

  describe("combined_hit_rate validation", () => {
    it("rejects combined_hit_rate below 0", () => {
      const result = validateCreateParlay(validPayload({ combined_hit_rate: -1 }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "combined_hit_rate")).toBe(true)
    })

    it("rejects combined_hit_rate above 100", () => {
      const result = validateCreateParlay(validPayload({ combined_hit_rate: 101 }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.field === "combined_hit_rate")).toBe(true)
    })
  })

  describe("multiple errors", () => {
    it("returns all errors for a payload with multiple issues", () => {
      const result = validateCreateParlay({
        legs: [{ player_name: "A" }], // missing fields + too few legs
        visibility: "invalid",
        odds: 99999,
        stake: -5,
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(3)
    })
  })
})
