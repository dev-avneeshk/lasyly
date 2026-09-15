import { describe, it, expect, beforeEach } from "vitest"
import {
  DEFAULT_POLICY,
  DEFAULT_WEIGHTS,
  loadPolicy,
  sanitizePolicy,
  __setPolicyForTest,
} from "@/lib/arena/policy"

describe("CPU policy loader — production inference safety (spec §26)", () => {
  beforeEach(() => {
    // Force a fresh load from the real artifact at the start of each test. We
    // set null so the next loadPolicy() re-reads; we never LEAVE the shared
    // module cache nulled, so a concurrently-running arena test can't observe an
    // empty policy mid-run.
    __setPolicyForTest(null)
    loadPolicy()
  })

  it("loads a valid policy artifact", () => {
    const p = loadPolicy()
    expect(typeof p.version).toBe("number")
    for (const key of Object.keys(DEFAULT_WEIGHTS)) {
      expect(typeof p.weights[key as keyof typeof DEFAULT_WEIGHTS]).toBe("number")
    }
  })

  it("falls back to the deterministic baseline on a null/garbage blob", () => {
    expect(sanitizePolicy(null)).toEqual(DEFAULT_POLICY)
    expect(sanitizePolicy(42)).toEqual(DEFAULT_POLICY)
    expect(sanitizePolicy("nope")).toEqual(DEFAULT_POLICY)
    expect(sanitizePolicy([])).toEqual(DEFAULT_POLICY)
  })

  it("fills missing weights from the baseline (partial artifact)", () => {
    const p = sanitizePolicy({ version: 9, weights: { risk_tolerance: 1.5 } })
    expect(p.version).toBe(9)
    expect(p.weights.risk_tolerance).toBe(1.5)
    // Every other weight defaults to 1.0.
    expect(p.weights.budget_weight).toBe(1)
    expect(p.weights.scarcity_weight).toBe(1)
  })

  it("rejects non-finite / out-of-range weights and keeps the baseline for them", () => {
    const p = sanitizePolicy({
      version: 1,
      weights: {
        risk_tolerance: Number.NaN,
        budget_weight: Infinity,
        scarcity_weight: -5,
        team_fit_weight: 999,
        offense_weight: 1.3, // valid
      },
    })
    expect(p.weights.risk_tolerance).toBe(1) // NaN → default
    expect(p.weights.budget_weight).toBe(1) // Infinity → default
    expect(p.weights.scarcity_weight).toBe(1) // negative → default
    expect(p.weights.team_fit_weight).toBe(1) // absurd → default
    expect(p.weights.offense_weight).toBeCloseTo(1.3) // valid → kept
  })

  it("treats a corrupt version as 0 but keeps valid weights", () => {
    const p = sanitizePolicy({ version: "bad", weights: { risk_tolerance: 1.2 } })
    expect(p.version).toBe(0)
    expect(p.weights.risk_tolerance).toBeCloseTo(1.2)
  })

  it("baseline policy is a no-op: multiplicative weights = 1, extended terms = 0", () => {
    // Core multiplicative weights are neutral at 1.0.
    const multiplicative = [
      "player_value_weight", "offense_weight", "defense_weight", "spacing_weight",
      "team_fit_weight", "positional_need_weight", "scarcity_weight", "budget_weight",
      "future_value_weight", "overpay_penalty", "urgency_weight", "risk_tolerance",
    ] as const
    for (const key of multiplicative) {
      expect(DEFAULT_WEIGHTS[key]).toBe(1)
    }
    // Extended opponent-modeling / timing terms are additive → neutral at 0, so
    // an artifact without them (e.g. v6) reproduces the original CPU exactly.
    const extended = [
      "rival_demand_weight", "rival_desperation_weight", "snipe_weight",
      "opportunity_cost_weight", "auction_stage_weight",
    ] as const
    for (const key of extended) {
      expect(DEFAULT_WEIGHTS[key]).toBe(0)
    }
  })
})
