/**
 * Unit tests for components/props/MatchupBadge
 * Tests the grade color mapping logic and null-grade behavior.
 */

import { describe, it, expect } from "vitest"
import { getGradeColors } from "@/components/props/MatchupBadge"
import type { Grade } from "@/lib/analytics/types"

describe("MatchupBadge - getGradeColors", () => {
  it("returns green colors for grade A", () => {
    const result = getGradeColors("A")
    expect(result).toContain("emerald")
  })

  it("returns green colors for grade B", () => {
    const result = getGradeColors("B")
    expect(result).toContain("emerald")
  })

  it("returns yellow/amber colors for grade C", () => {
    const result = getGradeColors("C")
    expect(result).toContain("amber")
  })

  it("returns red colors for grade D", () => {
    const result = getGradeColors("D")
    expect(result).toContain("red")
  })

  it("returns red colors for grade F", () => {
    const result = getGradeColors("F")
    expect(result).toContain("red")
  })

  it("A and B grades produce the same color class", () => {
    expect(getGradeColors("A")).toBe(getGradeColors("B"))
  })

  it("D and F grades produce the same color class", () => {
    expect(getGradeColors("D")).toBe(getGradeColors("F"))
  })

  it("all grades return a non-empty string", () => {
    const grades: Grade[] = ["A", "B", "C", "D", "F"]
    for (const grade of grades) {
      expect(getGradeColors(grade).length).toBeGreaterThan(0)
    }
  })
})
