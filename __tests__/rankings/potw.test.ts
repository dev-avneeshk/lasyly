import { scorePotwWindow, buildPotwResult, parseMinutes } from "../../lib/rankings/potw/engine"
import { DEFAULT_POTW_CONFIG } from "../../lib/rankings/potw/types"
import type { PotwGameLine, PotwPlayerWindow } from "../../lib/rankings/potw/types"

function game(over: Partial<PotwGameLine> = {}): PotwGameLine {
  return {
    game_id: Math.random().toString(36).slice(2),
    game_date: "2026-01-10",
    team: "XXX",
    opponent: "YYY",
    minutes: 34,
    pts: 20, trb: 5, ast: 5, stl: 1, blk: 0.5, tov: 2, fga: 15, fta: 5,
    won: true,
    ...over,
  }
}

function player(name: string, games: PotwGameLine[]): PotwPlayerWindow {
  return { player_name: name, player_id: name, team: "XXX", position: "PG", games }
}

describe("Player of the Week engine", () => {
  describe("parseMinutes", () => {
    it("parses MM:SS strings", () => {
      expect(parseMinutes("36:30")).toBeCloseTo(36.5, 2)
      expect(parseMinutes("0:00")).toBe(0)
    })
    it("handles numbers and junk", () => {
      expect(parseMinutes(28)).toBe(28)
      expect(parseMinutes(null)).toBe(0)
      expect(parseMinutes("")).toBe(0)
    })
  })

  describe("scorePotwWindow", () => {
    it("ranks a huge, efficient, winning week above a quiet one", () => {
      const monster = player("Monster", [
        game({ pts: 40, trb: 10, ast: 8, stl: 2, blk: 1, tov: 2, fga: 22, fta: 10, won: true }),
        game({ pts: 38, trb: 9, ast: 9, stl: 3, blk: 1, tov: 3, fga: 24, fta: 8, won: true }),
        game({ pts: 44, trb: 12, ast: 7, stl: 1, blk: 2, tov: 1, fga: 25, fta: 12, won: true }),
      ])
      const quiet = player("Quiet", [
        game({ pts: 8, trb: 3, ast: 2, stl: 0, blk: 0, tov: 3, fga: 10, fta: 1, won: false }),
        game({ pts: 6, trb: 2, ast: 1, stl: 0, blk: 0, tov: 2, fga: 9, fta: 0, won: false }),
      ])
      // Filler field so percentiles have a population.
      const filler = Array.from({ length: 12 }, (_, i) =>
        player(`Filler ${i}`, [
          game({ pts: 10 + i, trb: 4, ast: 3, fga: 12, fta: 3, won: i % 2 === 0 }),
          game({ pts: 12 + i, trb: 5, ast: 3, fga: 13, fta: 2, won: i % 3 === 0 }),
        ])
      )

      const scored = scorePotwWindow([quiet, monster, ...filler], DEFAULT_POTW_CONFIG)
      expect(scored[0].player_name).toBe("Monster")
      expect(scored[0].potw_score).toBeGreaterThan(scored[scored.length - 1].potw_score)
    })

    it("excludes players below the minimum games threshold", () => {
      const oneGame = player("OneGame", [game({ pts: 60 })]) // huge but only 1 game
      const twoGames = player("TwoGames", [game({ pts: 25 }), game({ pts: 25 })])
      const filler = Array.from({ length: 6 }, (_, i) =>
        player(`F${i}`, [game({ pts: 12 }), game({ pts: 14 })])
      )
      const scored = scorePotwWindow([oneGame, twoGames, ...filler], DEFAULT_POTW_CONFIG)
      expect(scored.find((s) => s.player_name === "OneGame")).toBeUndefined()
      expect(scored.find((s) => s.player_name === "TwoGames")).toBeDefined()
    })

    it("rewards a 4-game week over an equal-rate 2-game week (availability)", () => {
      const fourGames = player("FourGames", [game(), game(), game(), game()])
      const twoGames = player("TwoGames", [game(), game()])
      const filler = Array.from({ length: 6 }, (_, i) =>
        player(`F${i}`, [game({ pts: 10 + i }), game({ pts: 11 + i })])
      )
      const scored = scorePotwWindow([twoGames, fourGames, ...filler], DEFAULT_POTW_CONFIG)
      const four = scored.find((s) => s.player_name === "FourGames")!
      const two = scored.find((s) => s.player_name === "TwoGames")!
      expect(four.availability_score).toBeGreaterThan(two.availability_score)
      expect(four.potw_score).toBeGreaterThanOrEqual(two.potw_score)
    })

    it("returns empty when nobody is eligible", () => {
      const scored = scorePotwWindow([player("Solo", [game()])], DEFAULT_POTW_CONFIG)
      expect(scored).toEqual([])
    })
  })

  describe("buildPotwResult", () => {
    it("produces a winner, up to 4 runners-up, and a headline", () => {
      const field = Array.from({ length: 8 }, (_, i) =>
        player(`P${i}`, [game({ pts: 10 + i * 3 }), game({ pts: 12 + i * 3 })])
      )
      const scored = scorePotwWindow(field, DEFAULT_POTW_CONFIG)
      const result = buildPotwResult(scored, "2026-01-05", "2026-01-11", "2025-26")!
      expect(result.winner).toBeDefined()
      expect(result.runners_up.length).toBeLessThanOrEqual(4)
      expect(result.headline).toContain(result.winner.player_name)
      expect(result.headline).toMatch(/PPG/)
    })

    it("returns null for an empty field", () => {
      expect(buildPotwResult([], "2026-01-05", "2026-01-11", "2025-26")).toBeNull()
    })
  })
})
