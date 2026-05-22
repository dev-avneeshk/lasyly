import { describe, it, expect } from "vitest"
import { computePearsonCorrelation, computeAllCorrelations } from "./correlations"

describe("computePearsonCorrelation", () => {
  it("returns null when arrays have different lengths", () => {
    expect(computePearsonCorrelation([1, 2, 3], [1, 2])).toBeNull()
  })

  it("returns null when fewer than 10 values", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    const b = [9, 8, 7, 6, 5, 4, 3, 2, 1]
    expect(computePearsonCorrelation(a, b)).toBeNull()
  })

  it("returns null when either array has zero variance (constant values)", () => {
    const constant = Array(10).fill(5)
    const varying = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(computePearsonCorrelation(constant, varying)).toBeNull()
    expect(computePearsonCorrelation(varying, constant)).toBeNull()
  })

  it("returns null when both arrays are constant", () => {
    const a = Array(10).fill(3)
    const b = Array(10).fill(7)
    expect(computePearsonCorrelation(a, b)).toBeNull()
  })

  it("computes perfect positive correlation (r = 1)", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const b = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
    const r = computePearsonCorrelation(a, b)
    expect(r).toBeCloseTo(1, 10)
  })

  it("computes perfect negative correlation (r = -1)", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const b = [20, 18, 16, 14, 12, 10, 8, 6, 4, 2]
    const r = computePearsonCorrelation(a, b)
    expect(r).toBeCloseTo(-1, 10)
  })

  it("computes zero correlation for uncorrelated data", () => {
    // Orthogonal-like data: one increases, other oscillates
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const b = [1, -1, 1, -1, 1, -1, 1, -1, 1, -1]
    const r = computePearsonCorrelation(a, b)
    expect(r).not.toBeNull()
    // Should be close to 0 for this pattern
    expect(Math.abs(r!)).toBeLessThan(0.2)
  })

  it("returns a value in [-1, 1] for arbitrary data", () => {
    const a = [23, 15, 42, 8, 31, 19, 27, 35, 11, 44]
    const b = [18, 22, 35, 12, 28, 16, 30, 40, 9, 38]
    const r = computePearsonCorrelation(a, b)
    expect(r).not.toBeNull()
    expect(r!).toBeGreaterThanOrEqual(-1)
    expect(r!).toBeLessThanOrEqual(1)
  })

  it("computes known correlation value correctly", () => {
    // Known example: x = [1..10], y = x + small noise
    // With y = x exactly, r = 1. With slight perturbation, r < 1 but close.
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const b = [1.1, 2.2, 2.9, 4.1, 5.0, 5.9, 7.1, 8.0, 9.2, 9.8]
    const r = computePearsonCorrelation(a, b)
    expect(r).not.toBeNull()
    expect(r!).toBeGreaterThan(0.99)
    expect(r!).toBeLessThanOrEqual(1)
  })

  it("handles exactly 10 values (minimum threshold)", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const b = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    const r = computePearsonCorrelation(a, b)
    expect(r).not.toBeNull()
    expect(r).toBeCloseTo(-1, 10)
  })

  it("handles large arrays", () => {
    const n = 100
    const a = Array.from({ length: n }, (_, i) => i)
    const b = Array.from({ length: n }, (_, i) => i * 2 + 3)
    const r = computePearsonCorrelation(a, b)
    expect(r).toBeCloseTo(1, 10)
  })

  it("returns null for empty arrays", () => {
    expect(computePearsonCorrelation([], [])).toBeNull()
  })

  it("is symmetric: r(A, B) === r(B, A)", () => {
    const a = [23, 15, 42, 8, 31, 19, 27, 35, 11, 44]
    const b = [18, 22, 35, 12, 28, 16, 30, 40, 9, 38]
    const rAB = computePearsonCorrelation(a, b)
    const rBA = computePearsonCorrelation(b, a)
    expect(rAB).toBeCloseTo(rBA!, 10)
  })

  it("clamps result to [-1, 1] even with floating point edge cases", () => {
    // Use values that could cause floating point issues
    const a = Array.from({ length: 10 }, (_, i) => 1e15 + i)
    const b = Array.from({ length: 10 }, (_, i) => 1e15 + i * 2)
    const r = computePearsonCorrelation(a, b)
    if (r !== null) {
      expect(r).toBeGreaterThanOrEqual(-1)
      expect(r).toBeLessThanOrEqual(1)
    }
  })
})

describe("computeAllCorrelations", () => {
  it("returns empty array when no props provided", () => {
    expect(computeAllCorrelations([])).toEqual([])
  })

  it("returns empty array when only one prop provided", () => {
    const props = [{ id: "player-pts", values: Array.from({ length: 20 }, (_, i) => i) }]
    expect(computeAllCorrelations(props)).toEqual([])
  })

  it("computes pairwise correlations for valid pairs", () => {
    const props = [
      { id: "playerA-pts", values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { id: "playerB-pts", values: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
      { id: "playerC-pts", values: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] },
    ]

    const results = computeAllCorrelations(props)

    // Should have 3 pairs: A-B, A-C, B-C
    expect(results).toHaveLength(3)

    const ab = results.find((r) => r.propA === "playerA-pts" && r.propB === "playerB-pts")!
    expect(ab.coefficient).toBeCloseTo(1, 10)
    expect(ab.overlappingGames).toBe(10)

    const ac = results.find((r) => r.propA === "playerA-pts" && r.propB === "playerC-pts")!
    expect(ac.coefficient).toBeCloseTo(-1, 10)

    const bc = results.find((r) => r.propA === "playerB-pts" && r.propB === "playerC-pts")!
    expect(bc.coefficient).toBeCloseTo(-1, 10)
  })

  it("skips pairs with fewer than 10 overlapping games", () => {
    const props = [
      { id: "playerA-pts", values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { id: "playerB-pts", values: [1, 2, 3, 4, 5] }, // only 5 values
    ]

    const results = computeAllCorrelations(props)
    expect(results).toHaveLength(0)
  })

  it("uses the shorter array length as overlap", () => {
    const props = [
      { id: "playerA-pts", values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
      { id: "playerB-pts", values: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
    ]

    const results = computeAllCorrelations(props)
    expect(results).toHaveLength(1)
    expect(results[0].overlappingGames).toBe(10)
  })

  it("caps at maxProps unique props", () => {
    // Create 5 props but cap at 3
    const props = Array.from({ length: 5 }, (_, i) => ({
      id: `player${i}-pts`,
      values: Array.from({ length: 10 }, (_, j) => j + i),
    }))

    const results = computeAllCorrelations(props, 3)

    // With 3 props, max pairs = 3C2 = 3
    expect(results.length).toBeLessThanOrEqual(3)

    // Verify only the first 3 props are used
    for (const r of results) {
      expect(["player0-pts", "player1-pts", "player2-pts"]).toContain(r.propA)
      expect(["player0-pts", "player1-pts", "player2-pts"]).toContain(r.propB)
    }
  })

  it("skips pairs where one array has constant values", () => {
    const props = [
      { id: "playerA-pts", values: Array(10).fill(5) }, // constant
      { id: "playerB-pts", values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    ]

    const results = computeAllCorrelations(props)
    expect(results).toHaveLength(0)
  })

  it("returns correct propA and propB identifiers", () => {
    const props = [
      { id: "lebron-pts", values: [25, 30, 28, 22, 35, 27, 31, 29, 26, 33] },
      { id: "davis-reb", values: [12, 14, 10, 15, 11, 13, 16, 9, 14, 12] },
    ]

    const results = computeAllCorrelations(props)
    expect(results).toHaveLength(1)
    expect(results[0].propA).toBe("lebron-pts")
    expect(results[0].propB).toBe("davis-reb")
  })

  it("default maxProps is 500", () => {
    // Create 501 props with enough data
    const props = Array.from({ length: 501 }, (_, i) => ({
      id: `player${i}-pts`,
      values: Array.from({ length: 10 }, (_, j) => j * (i + 1)),
    }))

    const results = computeAllCorrelations(props)

    // Should only process first 500 props
    for (const r of results) {
      const idA = parseInt(r.propA.replace("player", "").replace("-pts", ""))
      const idB = parseInt(r.propB.replace("player", "").replace("-pts", ""))
      expect(idA).toBeLessThan(500)
      expect(idB).toBeLessThan(500)
    }
  })
})
