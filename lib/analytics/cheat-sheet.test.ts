import { describe, it, expect } from "vitest"
import { getCheatSheet, CheatSheetConfig } from "./cheat-sheet"

describe("cheat-sheet", () => {
  describe("getCheatSheet", () => {
    it("returns config for 'points' prop type", () => {
      const result = getCheatSheet("points")
      expect(result).not.toBeNull()
      expect(result!.propType).toBe("points")
      expect(result!.stats).toHaveLength(6)
    })

    it("returns config for 'rebounds' prop type", () => {
      const result = getCheatSheet("rebounds")
      expect(result).not.toBeNull()
      expect(result!.propType).toBe("rebounds")
      expect(result!.stats).toHaveLength(5)
    })

    it("returns config for 'assists' prop type", () => {
      const result = getCheatSheet("assists")
      expect(result).not.toBeNull()
      expect(result!.propType).toBe("assists")
      expect(result!.stats).toHaveLength(5)
    })

    it("returns config for 'pra' prop type", () => {
      const result = getCheatSheet("pra")
      expect(result).not.toBeNull()
      expect(result!.propType).toBe("pra")
      expect(result!.stats).toHaveLength(6)
    })

    it("is case-insensitive", () => {
      expect(getCheatSheet("Points")).not.toBeNull()
      expect(getCheatSheet("REBOUNDS")).not.toBeNull()
      expect(getCheatSheet("PRA")).not.toBeNull()
    })

    it("returns null for unsupported prop types", () => {
      expect(getCheatSheet("steals")).toBeNull()
      expect(getCheatSheet("blocks")).toBeNull()
      expect(getCheatSheet("threes")).toBeNull()
      expect(getCheatSheet("")).toBeNull()
    })

    it("ensures category ordering: primary before secondary before context", () => {
      const propTypes = ["points", "rebounds", "assists", "pra"]
      const categoryOrder = { primary: 0, secondary: 1, context: 2 }

      for (const propType of propTypes) {
        const config = getCheatSheet(propType)!
        let lastCategoryIndex = -1

        for (const stat of config.stats) {
          const currentIndex = categoryOrder[stat.category]
          expect(currentIndex).toBeGreaterThanOrEqual(lastCategoryIndex)
          lastCategoryIndex = currentIndex
        }
      }
    })

    it("ensures all explanations are at most 120 characters", () => {
      const propTypes = ["points", "rebounds", "assists", "pra"]

      for (const propType of propTypes) {
        const config = getCheatSheet(propType)!
        for (const stat of config.stats) {
          expect(stat.explanation.length).toBeLessThanOrEqual(120)
        }
      }
    })

    it("points config has correct primary stats", () => {
      const config = getCheatSheet("points")!
      const primaryStats = config.stats.filter((s) => s.category === "primary")
      expect(primaryStats.map((s) => s.key)).toEqual([
        "fgaPerGame",
        "ftaPerGame",
      ])
    })

    it("rebounds config has correct primary stats", () => {
      const config = getCheatSheet("rebounds")!
      const primaryStats = config.stats.filter((s) => s.category === "primary")
      expect(primaryStats.map((s) => s.key)).toEqual(["trbPct", "orbPct"])
    })

    it("assists config has correct primary stats", () => {
      const config = getCheatSheet("assists")!
      const primaryStats = config.stats.filter((s) => s.category === "primary")
      expect(primaryStats.map((s) => s.key)).toEqual(["astPct", "pgaPerGame"])
    })

    it("pra config has correct primary stats", () => {
      const config = getCheatSheet("pra")!
      const primaryStats = config.stats.filter((s) => s.category === "primary")
      expect(primaryStats.map((s) => s.key)).toEqual([
        "ePPS",
        "trbPct",
        "astPct",
      ])
    })
  })
})
