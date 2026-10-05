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

// L-13: P/L assumed decimal odds although American odds are accepted, so a
// $10 win at +150 showed +$1,490.
describe("net P/L handles American and decimal odds", () => {
  const priced = (status: string, odds: number, stake = 10) =>
    ({ ...p(status, 1), stake, odds }) as unknown as ParlayWithLegs
  it.each([
    [150, 15],
    [-110, 9.09],
    [2.5, 15],
  ])("won at %s with stake 10 → %s", (odds, net) => {
    expect(computeParlayStats([priced("won", odds)]).net_profit_loss).toBe(net)
  })
  it("a loss is -stake regardless of format", () => {
    expect(computeParlayStats([priced("lost", 150)]).net_profit_loss).toBe(-10)
  })
})
