import { describe, it, expect } from "vitest"
import {
  computeLineMovementFromHistory,
  findClosestValue,
  findEarliestIn24h,
} from "./line-movement"

describe("computeLineMovementFromHistory", () => {
  const now = new Date("2024-06-15T12:00:00Z")

  it("returns null for empty history", () => {
    expect(computeLineMovementFromHistory([], now)).toBeNull()
  })

  it("computes direction 'up' when current > previous", () => {
    const history = [
      { timestamp: "2024-06-14T12:00:00Z", value: 20.5 },
      { timestamp: "2024-06-15T06:00:00Z", value: 22.0 },
      { timestamp: "2024-06-15T12:00:00Z", value: 23.5 },
    ]

    const result = computeLineMovementFromHistory(history, now)!
    expect(result.direction).toBe("up")
    expect(result.currentLine).toBe(23.5)
  })

  it("computes direction 'down' when current < previous", () => {
    const history = [
      { timestamp: "2024-06-14T12:00:00Z", value: 25.0 },
      { timestamp: "2024-06-15T06:00:00Z", value: 24.0 },
      { timestamp: "2024-06-15T12:00:00Z", value: 22.5 },
    ]

    const result = computeLineMovementFromHistory(history, now)!
    expect(result.direction).toBe("down")
    expect(result.currentLine).toBe(22.5)
  })

  it("computes absolute change rounded to 1 decimal", () => {
    const history = [
      { timestamp: "2024-06-14T12:00:00Z", value: 20.5 },
      { timestamp: "2024-06-15T12:00:00Z", value: 23.17 },
    ]

    const result = computeLineMovementFromHistory(history, now)!
    // |23.17 - 20.5| = 2.67, rounded to 1 decimal = 2.7
    expect(result.change).toBe(2.7)
  })

  it("sets hasSignificantMove true when move >= 10% from earliest in 24h", () => {
    // Earliest in 24h is at 2024-06-14T13:00:00Z with value 20.0
    // Current is 23.0 → |23 - 20| / 20 = 0.15 >= 0.10
    const history = [
      { timestamp: "2024-06-13T12:00:00Z", value: 19.0 }, // outside 24h
      { timestamp: "2024-06-14T13:00:00Z", value: 20.0 }, // earliest in 24h
      { timestamp: "2024-06-15T06:00:00Z", value: 21.5 },
      { timestamp: "2024-06-15T12:00:00Z", value: 23.0 }, // current
    ]

    const result = computeLineMovementFromHistory(history, now)!
    expect(result.hasSignificantMove).toBe(true)
  })

  it("sets hasSignificantMove false when move < 10% from earliest in 24h", () => {
    // Earliest in 24h is at 2024-06-14T13:00:00Z with value 20.0
    // Current is 21.5 → |21.5 - 20| / 20 = 0.075 < 0.10
    const history = [
      { timestamp: "2024-06-13T12:00:00Z", value: 19.0 },
      { timestamp: "2024-06-14T13:00:00Z", value: 20.0 },
      { timestamp: "2024-06-15T06:00:00Z", value: 20.5 },
      { timestamp: "2024-06-15T12:00:00Z", value: 21.5 },
    ]

    const result = computeLineMovementFromHistory(history, now)!
    expect(result.hasSignificantMove).toBe(false)
  })

  it("uses closest record to 24h ago as previousLine", () => {
    // 24h ago from now (2024-06-15T12:00:00Z) is 2024-06-14T12:00:00Z
    // Closest record is at 2024-06-14T11:30:00Z (30 min before target)
    const history = [
      { timestamp: "2024-06-14T06:00:00Z", value: 18.0 },
      { timestamp: "2024-06-14T11:30:00Z", value: 20.0 }, // closest to 24h ago
      { timestamp: "2024-06-14T18:00:00Z", value: 21.0 },
      { timestamp: "2024-06-15T12:00:00Z", value: 23.0 },
    ]

    const result = computeLineMovementFromHistory(history, now)!
    expect(result.previousLine).toBe(20.0)
  })

  it("returns the full history array in the result", () => {
    const history = [
      { timestamp: "2024-06-14T12:00:00Z", value: 20.0 },
      { timestamp: "2024-06-15T12:00:00Z", value: 22.0 },
    ]

    const result = computeLineMovementFromHistory(history, now)!
    expect(result.history).toEqual(history)
  })

  it("handles single entry history", () => {
    const history = [
      { timestamp: "2024-06-15T12:00:00Z", value: 20.0 },
    ]

    const result = computeLineMovementFromHistory(history, now)!
    expect(result.currentLine).toBe(20.0)
    expect(result.previousLine).toBe(20.0) // closest to 24h ago is the only entry
    expect(result.change).toBe(0)
    expect(result.direction).toBe("down") // equal values → "down" (not greater)
  })

  it("handles exactly 10% move as significant", () => {
    // Earliest in 24h = 20.0, current = 22.0 → |22-20|/20 = 0.10 (exactly 10%)
    const history = [
      { timestamp: "2024-06-14T13:00:00Z", value: 20.0 },
      { timestamp: "2024-06-15T12:00:00Z", value: 22.0 },
    ]

    const result = computeLineMovementFromHistory(history, now)!
    expect(result.hasSignificantMove).toBe(true)
  })
})

describe("findClosestValue", () => {
  it("returns 0 for empty history", () => {
    expect(findClosestValue([], new Date())).toBe(0)
  })

  it("returns the value of the entry closest to target time", () => {
    const history = [
      { timestamp: "2024-06-14T06:00:00Z", value: 18.0 },
      { timestamp: "2024-06-14T12:00:00Z", value: 20.0 },
      { timestamp: "2024-06-14T18:00:00Z", value: 22.0 },
    ]

    const target = new Date("2024-06-14T11:00:00Z")
    expect(findClosestValue(history, target)).toBe(20.0)
  })

  it("returns the only entry when history has one item", () => {
    const history = [{ timestamp: "2024-06-14T12:00:00Z", value: 25.0 }]
    const target = new Date("2024-06-15T12:00:00Z")
    expect(findClosestValue(history, target)).toBe(25.0)
  })
})

describe("findEarliestIn24h", () => {
  const now = new Date("2024-06-15T12:00:00Z")

  it("returns null when no records are within 24h", () => {
    const history = [
      { timestamp: "2024-06-13T12:00:00Z", value: 20.0 },
      { timestamp: "2024-06-14T11:00:00Z", value: 21.0 }, // just outside 24h
    ]

    expect(findEarliestIn24h(history, now)).toBeNull()
  })

  it("returns the earliest value within 24h window", () => {
    const history = [
      { timestamp: "2024-06-13T12:00:00Z", value: 18.0 }, // outside 24h
      { timestamp: "2024-06-14T13:00:00Z", value: 20.0 }, // earliest in 24h
      { timestamp: "2024-06-15T06:00:00Z", value: 22.0 },
      { timestamp: "2024-06-15T12:00:00Z", value: 23.0 },
    ]

    expect(findEarliestIn24h(history, now)).toBe(20.0)
  })

  it("returns the first entry if all are within 24h", () => {
    const history = [
      { timestamp: "2024-06-14T18:00:00Z", value: 19.0 },
      { timestamp: "2024-06-15T06:00:00Z", value: 21.0 },
      { timestamp: "2024-06-15T12:00:00Z", value: 23.0 },
    ]

    expect(findEarliestIn24h(history, now)).toBe(19.0)
  })
})
