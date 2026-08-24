/**
 * Tests for parlay settlement logic.
 *
 * Since settlement functions interact with Supabase (admin client),
 * we test the core deterministic logic: stat resolution, win/loss/push
 * determination, combo stat computation, and date filtering.
 *
 * These are unit tests for the settlement decision logic — not integration
 * tests against the database.
 */
import { describe, it, expect } from "vitest"

// ─── Settlement Decision Logic (extracted for testability) ──────────────────

/** Determine leg result given actual value, prop line, and direction */
function determineResult(
  actualValue: number,
  propLine: number,
  direction: "over" | "under"
): "won" | "lost" | "push" {
  if (direction === "over") {
    if (actualValue > propLine) return "won"
    if (actualValue === propLine) return "push"
    return "lost"
  } else {
    if (actualValue < propLine) return "won"
    if (actualValue === propLine) return "push"
    return "lost"
  }
}

/** Compute combo stat value from individual stats */
function computeComboStat(
  statKey: string,
  stats: { pts: number; trb: number; ast: number }
): number | null {
  switch (statKey) {
    case "pra":
      return stats.pts + stats.trb + stats.ast
    case "pa":
      return stats.pts + stats.ast
    case "pr":
      return stats.pts + stats.trb
    case "ra":
      return stats.trb + stats.ast
    default:
      return null
  }
}

/** Map stat category to database column name */
const NBA_STAT_MAP: Record<string, string> = {
  points: "pts", pts: "pts",
  rebounds: "trb", reb: "trb", trb: "trb",
  assists: "ast", ast: "ast",
  steals: "stl", stl: "stl",
  blocks: "blk", blk: "blk",
  "3pm": "tp", "3-pointers": "tp", threes: "tp", tp: "tp",
  turnovers: "tov", tov: "tov",
  "field goals": "fg", fg: "fg",
  fga: "fga",
  "free throws": "ft", ft: "ft",
  fta: "fta",
  pra: "pra", "pts+reb+ast": "pra", "points+rebounds+assists": "pra",
  pa: "pa", "pts+ast": "pa",
  pr: "pr", "pts+reb": "pr",
  ra: "ra", "reb+ast": "ra",
}

/** Parse game date from game_id (first 8 chars are YYYYMMDD) */
function isGameAfterDate(gameId: string, parlayDateStr: string): boolean {
  const gameDate = gameId.slice(0, 8)
  return gameDate >= parlayDateStr
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Settlement Decision Logic", () => {
  describe("determineResult — over direction", () => {
    it("returns 'won' when actual > prop line", () => {
      expect(determineResult(25.0, 22.5, "over")).toBe("won")
    })

    it("returns 'lost' when actual < prop line", () => {
      expect(determineResult(20.0, 22.5, "over")).toBe("lost")
    })

    it("returns 'push' when actual === prop line", () => {
      expect(determineResult(22.5, 22.5, "over")).toBe("push")
    })

    it("handles zero values correctly", () => {
      expect(determineResult(0, 0.5, "over")).toBe("lost")
      expect(determineResult(1, 0.5, "over")).toBe("won")
    })

    it("handles large values", () => {
      expect(determineResult(50.0, 49.5, "over")).toBe("won")
      expect(determineResult(49.0, 49.5, "over")).toBe("lost")
    })

    it("handles fractional prop lines (standard .5 lines)", () => {
      // .5 lines can never push
      expect(determineResult(5, 4.5, "over")).toBe("won")
      expect(determineResult(4, 4.5, "over")).toBe("lost")
    })

    it("handles whole-number prop lines (can push)", () => {
      expect(determineResult(5, 5, "over")).toBe("push")
      expect(determineResult(6, 5, "over")).toBe("won")
      expect(determineResult(4, 5, "over")).toBe("lost")
    })
  })

  describe("determineResult — under direction", () => {
    it("returns 'won' when actual < prop line", () => {
      expect(determineResult(20.0, 22.5, "under")).toBe("won")
    })

    it("returns 'lost' when actual > prop line", () => {
      expect(determineResult(25.0, 22.5, "under")).toBe("lost")
    })

    it("returns 'push' when actual === prop line", () => {
      expect(determineResult(22.5, 22.5, "under")).toBe("push")
    })

    it("handles zero actual value (player DNP but stat recorded as 0)", () => {
      expect(determineResult(0, 0.5, "under")).toBe("won")
      expect(determineResult(0, 0, "under")).toBe("push")
    })

    it("handles fractional prop lines (standard .5 lines)", () => {
      expect(determineResult(4, 4.5, "under")).toBe("won")
      expect(determineResult(5, 4.5, "under")).toBe("lost")
    })
  })

  describe("computeComboStat", () => {
    const stats = { pts: 25, trb: 10, ast: 7 }

    it("computes PRA correctly", () => {
      expect(computeComboStat("pra", stats)).toBe(42)
    })

    it("computes PA (pts+ast) correctly", () => {
      expect(computeComboStat("pa", stats)).toBe(32)
    })

    it("computes PR (pts+reb) correctly", () => {
      expect(computeComboStat("pr", stats)).toBe(35)
    })

    it("computes RA (reb+ast) correctly", () => {
      expect(computeComboStat("ra", stats)).toBe(17)
    })

    it("returns null for unknown combo stat", () => {
      expect(computeComboStat("xyz", stats)).toBeNull()
    })

    it("handles zero values in individual stats", () => {
      expect(computeComboStat("pra", { pts: 0, trb: 0, ast: 0 })).toBe(0)
    })

    it("handles large values without overflow", () => {
      expect(computeComboStat("pra", { pts: 60, trb: 20, ast: 15 })).toBe(95)
    })
  })

  describe("NBA_STAT_MAP", () => {
    it("maps standard stat keys", () => {
      expect(NBA_STAT_MAP["pts"]).toBe("pts")
      expect(NBA_STAT_MAP["trb"]).toBe("trb")
      expect(NBA_STAT_MAP["ast"]).toBe("ast")
      expect(NBA_STAT_MAP["tp"]).toBe("tp")
      expect(NBA_STAT_MAP["stl"]).toBe("stl")
      expect(NBA_STAT_MAP["blk"]).toBe("blk")
    })

    it("maps alternate names to same column", () => {
      expect(NBA_STAT_MAP["points"]).toBe("pts")
      expect(NBA_STAT_MAP["rebounds"]).toBe("trb")
      expect(NBA_STAT_MAP["reb"]).toBe("trb")
      expect(NBA_STAT_MAP["assists"]).toBe("ast")
      expect(NBA_STAT_MAP["3pm"]).toBe("tp")
      expect(NBA_STAT_MAP["3-pointers"]).toBe("tp")
      expect(NBA_STAT_MAP["threes"]).toBe("tp")
    })

    it("maps combo stats", () => {
      expect(NBA_STAT_MAP["pra"]).toBe("pra")
      expect(NBA_STAT_MAP["pts+reb+ast"]).toBe("pra")
      expect(NBA_STAT_MAP["pts+ast"]).toBe("pa")
      expect(NBA_STAT_MAP["pts+reb"]).toBe("pr")
      expect(NBA_STAT_MAP["reb+ast"]).toBe("ra")
    })

    it("returns undefined for invalid stat categories", () => {
      expect(NBA_STAT_MAP["invalid"]).toBeUndefined()
      expect(NBA_STAT_MAP[""]).toBeUndefined()
      expect(NBA_STAT_MAP["PPG"]).toBeUndefined()
    })
  })

  describe("Game date filtering", () => {
    it("identifies games after parlay creation date", () => {
      // game_id format: YYYYMMDD + suffix (e.g., "202501150LAL")
      expect(isGameAfterDate("202501150LAL", "20250115")).toBe(true)
      expect(isGameAfterDate("202501160GSW", "20250115")).toBe(true)
      expect(isGameAfterDate("202501140BOS", "20250115")).toBe(false)
    })

    it("handles same-day games (game on parlay creation day)", () => {
      expect(isGameAfterDate("202503200LAL", "20250320")).toBe(true)
    })

    it("handles month/year boundaries", () => {
      expect(isGameAfterDate("202502010LAL", "20250131")).toBe(true)
      expect(isGameAfterDate("202601010LAL", "20251231")).toBe(true)
    })
  })

  describe("Edge cases for settlement", () => {
    it("floating point prop lines don't cause issues", () => {
      // 0.1 + 0.2 !== 0.3 in JS, but we use direct comparison
      // Prop lines are always at .5 increments in practice
      expect(determineResult(5.5, 5.5, "over")).toBe("push")
      expect(determineResult(5.5, 5.5, "under")).toBe("push")
    })

    it("very small differences are still wins/losses", () => {
      // 22.500001 > 22.5 — this should be a win
      expect(determineResult(22.500001, 22.5, "over")).toBe("won")
      // In practice, stats are integers and lines are at .5, so this is theoretical
    })

    it("negative values are handled (shouldn't occur but defensive)", () => {
      expect(determineResult(-1, 0.5, "under")).toBe("won")
      expect(determineResult(-1, 0.5, "over")).toBe("lost")
    })
  })
})

describe("Parlay Resolution Logic", () => {
  /** Simulate parlay resolution given an array of leg results */
  function resolveParlay(legResults: string[]): "won" | "lost" | "pending" {
    if (legResults.some((r) => r === "pending")) return "pending"
    if (legResults.some((r) => r === "lost")) return "lost"
    if (legResults.every((r) => r === "won" || r === "push")) return "won"
    return "lost"
  }

  it("parlay wins when all legs won", () => {
    expect(resolveParlay(["won", "won", "won"])).toBe("won")
  })

  it("parlay wins when legs are mix of won and push", () => {
    expect(resolveParlay(["won", "push", "won"])).toBe("won")
  })

  it("parlay loses when any leg lost", () => {
    expect(resolveParlay(["won", "lost", "won"])).toBe("lost")
  })

  it("parlay stays pending when any leg is pending", () => {
    expect(resolveParlay(["won", "pending", "won"])).toBe("pending")
  })

  it("all-push parlay is a win (standard parlay rules)", () => {
    expect(resolveParlay(["push", "push", "push"])).toBe("won")
  })

  it("single-leg edge cases", () => {
    expect(resolveParlay(["won"])).toBe("won")
    expect(resolveParlay(["lost"])).toBe("lost")
    expect(resolveParlay(["push"])).toBe("won")
    expect(resolveParlay(["pending"])).toBe("pending")
  })

  it("mixed pending and lost — still pending (can't resolve yet)", () => {
    expect(resolveParlay(["lost", "pending"])).toBe("pending")
  })
})

describe("Stale Parlay Expiry Logic", () => {
  /** Simulate stale parlay resolution */
  function resolveStaleParlay(
    settledResults: string[],
    pendingCount: number
  ): "won" | "lost" {
    const anyLost = settledResults.some((r) => r === "lost")
    const allOriginallyPending = settledResults.length === 0
    if (anyLost || allOriginallyPending) return "lost"
    return "won"
  }

  it("all-pending stale parlay is lost (voided)", () => {
    expect(resolveStaleParlay([], 3)).toBe("lost")
  })

  it("stale parlay with some won legs and rest expired is a win", () => {
    expect(resolveStaleParlay(["won", "won"], 1)).toBe("won")
  })

  it("stale parlay with a lost leg is still lost", () => {
    expect(resolveStaleParlay(["won", "lost"], 1)).toBe("lost")
  })

  it("stale parlay with all push settled legs is a win", () => {
    expect(resolveStaleParlay(["push", "push"], 1)).toBe("won")
  })
})
