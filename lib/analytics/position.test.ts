import { describe, it, expect } from "vitest"
import { parsePosition, isValidPosition, Position } from "./position"

describe("isValidPosition", () => {
  it("returns true for all valid positions", () => {
    expect(isValidPosition("PG")).toBe(true)
    expect(isValidPosition("SG")).toBe(true)
    expect(isValidPosition("SF")).toBe(true)
    expect(isValidPosition("PF")).toBe(true)
    expect(isValidPosition("C")).toBe(true)
  })

  it("returns false for invalid positions", () => {
    expect(isValidPosition("")).toBe(false)
    expect(isValidPosition("G")).toBe(false)
    expect(isValidPosition("F")).toBe(false)
    expect(isValidPosition("CENTER")).toBe(false)
    expect(isValidPosition("pg")).toBe(false)
    expect(isValidPosition("PG-SG")).toBe(false)
  })
})

describe("parsePosition", () => {
  describe("null/empty/undefined inputs", () => {
    it("returns null for null input", () => {
      expect(parsePosition(null)).toBeNull()
    })

    it("returns null for undefined input", () => {
      expect(parsePosition(undefined)).toBeNull()
    })

    it("returns null for empty string", () => {
      expect(parsePosition("")).toBeNull()
    })

    it("returns null for whitespace-only string", () => {
      expect(parsePosition("   ")).toBeNull()
    })
  })

  describe("single position strings", () => {
    it("parses PG", () => {
      expect(parsePosition("PG")).toBe("PG")
    })

    it("parses SG", () => {
      expect(parsePosition("SG")).toBe("SG")
    })

    it("parses SF", () => {
      expect(parsePosition("SF")).toBe("SF")
    })

    it("parses PF", () => {
      expect(parsePosition("PF")).toBe("PF")
    })

    it("parses C", () => {
      expect(parsePosition("C")).toBe("C")
    })
  })

  describe("multi-position strings with hyphen separator", () => {
    it("returns first position from PG-SG", () => {
      expect(parsePosition("PG-SG")).toBe("PG")
    })

    it("returns first position from SF-PF", () => {
      expect(parsePosition("SF-PF")).toBe("SF")
    })

    it("returns first position from C-PF", () => {
      expect(parsePosition("C-PF")).toBe("C")
    })
  })

  describe("multi-position strings with slash separator", () => {
    it("returns first position from PG/SG", () => {
      expect(parsePosition("PG/SG")).toBe("PG")
    })

    it("returns first position from SF/PF", () => {
      expect(parsePosition("SF/PF")).toBe("SF")
    })
  })

  describe("case insensitivity", () => {
    it("handles lowercase input", () => {
      expect(parsePosition("pg")).toBe("PG")
    })

    it("handles mixed case input", () => {
      expect(parsePosition("Sf-Pf")).toBe("SF")
    })
  })

  describe("invalid position strings", () => {
    it("returns null for completely invalid string", () => {
      expect(parsePosition("GUARD")).toBeNull()
    })

    it("returns null for numeric string", () => {
      expect(parsePosition("123")).toBeNull()
    })

    it("returns first valid position when mixed with invalid", () => {
      expect(parsePosition("X-PG")).toBe("PG")
    })
  })

  describe("whitespace handling", () => {
    it("handles leading/trailing whitespace", () => {
      expect(parsePosition("  PG  ")).toBe("PG")
    })

    it("handles whitespace around separators", () => {
      expect(parsePosition("PG - SG")).toBe("PG")
    })
  })
})
