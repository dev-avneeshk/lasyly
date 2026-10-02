import { describe, it, expect } from "vitest"
import { computeParlayStats } from "@/lib/parlays/computations"
import type { ParlayWithLegs } from "@/lib/types/parlay"

// REV-11: `void` (added with L-04) counted as a resolved non-win: it broke win
// streaks, could be the current streak type and sat in leg-bucket denominators.
const p = (status: string, day: number, legs = 2) =>
  ({
    status,
    is_logged: false,
    resolved_at: `2026-01-${String(day).padStart(2, "0")}T00:00:00Z`,
    legs: Array.from({ length: legs }, () => ({ sport: "NBA" })),
  }) as unknown as ParlayWithLegs

describe("parlay stats ignore void", () => {
  it("won, void, won is a 2-win streak and the current type is won", () => {
    const s = computeParlayStats([p("won", 1), p("void", 2), p("won", 3), p("void", 4)])
    expect(s.best_streak).toBe(2)
    expect(s.current_streak).toEqual({ count: 2, type: "won" })
  })

  it("void is not in the leg-bucket denominator", () => {
    const s = computeParlayStats([p("won", 1), p("void", 2)])
    expect(s.by_leg_count["2-leg"]).toEqual(expect.objectContaining({ win_rate: 100 }))
  })
})
