import { describe, expect, it } from "vitest"
import { hasGameStarted, predictionLock } from "@/lib/props/game-lock"
import { computePropValue, modelMultiplier, qualifiesForValue } from "@/lib/props/prop-value"
import { mapMatchStatus, easternDate } from "@/lib/props/game-clock"

const TIP = "2026-10-24T23:30:00Z"
const tipMs = Date.parse(TIP)

describe("hasGameStarted", () => {
  it("is open before tip-off and closed at it", () => {
    expect(hasGameStarted({ startTime: TIP, status: "scheduled" }, tipMs - 1)).toBe(false)
    expect(hasGameStarted({ startTime: TIP, status: "scheduled" }, tipMs)).toBe(true)
  })
  it("trusts a live or final status even before the scheduled time", () => {
    expect(hasGameStarted({ startTime: TIP, status: "live" }, tipMs - 60_000)).toBe(true)
    expect(hasGameStarted({ startTime: null, status: "final" }, 0)).toBe(true)
  })
  it("ignores a date-only gameTime (it would read as the previous US evening)", () => {
    expect(hasGameStarted({ startTime: "2026-10-24", status: "scheduled" }, Date.parse("2026-10-24T15:00:00Z"))).toBe(false)
  })
  it("is open when nothing is known", () => {
    expect(hasGameStarted(undefined)).toBe(false)
  })
})

describe("predictionLock", () => {
  const game = { startTime: TIP, status: "scheduled" }
  it("locks past and future slates regardless of the game", () => {
    expect(predictionLock(game, "2026-10-23", "2026-10-24", 0)).toBe("past")
    expect(predictionLock(game, "2026-10-25", "2026-10-24", 0)).toBe("future")
  })
  it("locks today's game at tip-off", () => {
    expect(predictionLock(game, "2026-10-24", "2026-10-24", tipMs - 1)).toBeNull()
    expect(predictionLock(game, "2026-10-24", "2026-10-24", tipMs + 1)).toBe("started")
    expect(predictionLock({ ...game, status: "final" }, "2026-10-24", "2026-10-24", 0)).toBe("final")
  })
})

describe("model multiplier", () => {
  it("prices a coin flip like -110 and shortens with the chance", () => {
    expect(modelMultiplier(0.5)).toBe(1.91)
    expect(modelMultiplier(0.7)).toBe(1.36)
    expect(modelMultiplier(0.97)).toBe(1.01) // floored
    expect(modelMultiplier(0.03)).toBe(10) // capped
    expect(modelMultiplier(0)).toBeNull()
  })

  const games = Array.from({ length: 12 }, (_, i) => ({ value: i % 3 === 0 ? 30 : 18, minutes: 32 }))

  it("fills the multiplier for an unpriced line, without inventing value", () => {
    const v = computePropValue({ propLine: 20.5, lastGames: games, lineSource: "average" })!
    expect(v.multiplierSource).toBe("model")
    expect(v.multiplier).toBe(modelMultiplier(v.chance))
    expect(v.value).toBeNull()
    expect(qualifiesForValue(v)).toBe(false)
  })

  it("keeps the book's price when the line is priced", () => {
    const v = computePropValue({
      propLine: 20.5,
      lastGames: games,
      lineSource: "market",
      marketLine: { overPrice: 120, underPrice: -140 },
    })!
    expect(v.multiplierSource).toBe("market")
    expect(v.multiplier).toBe(v.side === "over" ? 2.2 : 1.71)
    expect(v.value).not.toBeNull()
  })
})

describe("game clock helpers", () => {
  it("maps ESPN statuses", () => {
    expect(mapMatchStatus("Not Started")).toBe("scheduled")
    expect(mapMatchStatus("In Progress")).toBe("live")
    expect(mapMatchStatus("Halftime")).toBe("live")
    expect(mapMatchStatus("Finished")).toBe("final")
    expect(mapMatchStatus(null)).toBe("scheduled")
  })
  it("puts a late tip-off on the US Eastern date", () => {
    // 00:30 UTC on the 25th is 8:30pm ET on the 24th.
    expect(easternDate("2026-10-25T00:30:00Z")).toBe("2026-10-24")
  })
})
