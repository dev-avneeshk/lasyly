import { describe, it, expect } from "vitest"

import { TierBadge } from "@/components/rankings/TierBadge"

/**
 * Regression cover for the production crash
 * `TypeError: undefined is not an object (evaluating 'styles.bg')`.
 *
 * The fallback used to be `TIER_STYLES["Fringe"]`, but the real key is
 * "E — Fringe", so every tier that didn't match one of the eight canonical
 * em-dash labels resolved to `undefined` and threw. Tiers reach this component
 * from Supabase rows and serialized server props, so the union isn't enforced
 * at runtime.
 *
 * `TierBadge` is a plain function returning a React element, so its output can
 * be inspected without a DOM.
 */
function classNameFor(tier: unknown): string {
  const element = TierBadge({ tier: tier as string }) as {
    props: { className: string }
  }
  return element.props.className
}

function labelFor(tier: unknown): string {
  const element = TierBadge({ tier: tier as string }) as {
    props: { children: string }
  }
  return element.props.children
}

const FRINGE_BG = "bg-gray-600/10"

describe("TierBadge", () => {
  it("renders each canonical tier", () => {
    const cases: Array<[string, string]> = [
      ["Ω — Apex", "APEX"],
      ["X — Mythic", "MYTHIC"],
      ["S — Elite", "ELITE"],
      ["A — Dominant", "DOMINANT"],
      ["B — Impact", "IMPACT"],
      ["C — Rotation", "ROTATION"],
      ["D — Limited", "LIMITED"],
      ["E — Fringe", "FRINGE"],
    ]

    for (const [tier, label] of cases) {
      expect(labelFor(tier)).toBe(label)
    }
  })

  it("falls back to Fringe instead of throwing on unknown tiers", () => {
    // Each of these previously hit `styles.bg` on `undefined`.
    for (const tier of ["Fringe", "Unranked", "", "  ", "legacy-tier-name"]) {
      expect(() => classNameFor(tier)).not.toThrow()
      expect(classNameFor(tier)).toContain(FRINGE_BG)
    }
  })

  it("falls back when the tier is missing entirely", () => {
    for (const tier of [null, undefined]) {
      expect(() => classNameFor(tier)).not.toThrow()
      expect(classNameFor(tier)).toContain(FRINGE_BG)
    }
  })

  it("tolerates dash and whitespace variants of the canonical label", () => {
    // Hyphen, en dash, doubled spaces, and casing all appear in stored rows.
    expect(labelFor("S - Elite")).toBe("ELITE")
    expect(labelFor("S – Elite")).toBe("ELITE")
    expect(labelFor("  S — Elite  ")).toBe("ELITE")
    expect(labelFor("s — elite")).toBe("ELITE")
  })

  it("resolves a bare grade or a bare name", () => {
    expect(labelFor("S")).toBe("ELITE")
    expect(labelFor("Elite")).toBe("ELITE")
    expect(labelFor("Apex")).toBe("APEX")
  })

  it("applies compact sizing", () => {
    const element = TierBadge({ tier: "S — Elite", compact: true }) as {
      props: { className: string }
    }
    expect(element.props.className).toContain("text-[9px]")
  })
})
