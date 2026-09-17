/**
 * Model-implied price helpers.
 *
 * IMPORTANT: Lasyly does not ingest sportsbook prices. The numbers produced
 * here are derived from our own hit-rate model and are shown purely as a
 * reference price ("what this line would be worth if our model were the
 * market"). They must always be labelled as model-implied in the UI so they
 * are never mistaken for a real book price.
 */

import { EnhancedPropCardData } from "@/lib/analytics/types"

/** Typical two-way market hold applied on top of the fair probability. */
const DEFAULT_VIG = 0.045

/** Prices outside this range are clamped so the UI never renders absurd extremes. */
const MIN_ODDS = -2000
const MAX_ODDS = 2000

function clampProbability(p: number): number {
  if (!Number.isFinite(p)) return 0.5
  // Keep away from 0/1 so the odds conversion stays finite.
  return Math.min(0.97, Math.max(0.03, p))
}

/**
 * Converts a probability (0–1) to American odds, rounded to the nearest 5.
 */
export function probabilityToAmericanOdds(probability: number): number {
  const p = clampProbability(probability)
  const raw = p >= 0.5 ? -((p / (1 - p)) * 100) : ((1 - p) / p) * 100
  const rounded = Math.round(raw / 5) * 5
  return Math.min(MAX_ODDS, Math.max(MIN_ODDS, rounded))
}

/** Formats American odds for display (`-115`, `+140`, `EVEN`). */
export function formatAmericanOdds(odds: number): string {
  if (odds === 100 || odds === -100) return "EVEN"
  return odds > 0 ? `+${odds}` : `${odds}`
}

/**
 * Returns the model's probability that a prop goes over, preferring the L10
 * hit-rate window and falling back to the base hit rate. Returns null when we
 * have no sample at all, so callers can hide the price instead of inventing one.
 */
export function getOverProbability(prop: EnhancedPropCardData): number | null {
  const l10 = prop.hitRateWindows?.find((w) => w.window === "L10")
  if (l10?.available && typeof l10.hitRate === "number") {
    return l10.hitRate / 100
  }
  const l5 = prop.hitRateWindows?.find((w) => w.window === "L5")
  if (l5?.available && typeof l5.hitRate === "number") {
    return l5.hitRate / 100
  }
  if (prop.hitRate && prop.hitRate.total > 0) {
    return prop.hitRate.over / prop.hitRate.total
  }
  return null
}

export interface PropPrices {
  over: string
  under: string
}

/**
 * Two-way model-implied price for an arbitrary over-probability, with the hold
 * spread across both sides. Use this when the probability comes from something
 * other than a prop's stored hit rate — e.g. the sample window currently shown
 * on a chart — so the displayed price and hit rate stay consistent.
 */
export function pricesFromProbability(
  overProbability: number,
  vig = DEFAULT_VIG
): PropPrices {
  const fairOver = clampProbability(overProbability)
  const overWithVig = clampProbability(fairOver * (1 + vig))
  const underWithVig = clampProbability((1 - fairOver) * (1 + vig))
  return {
    over: formatAmericanOdds(probabilityToAmericanOdds(overWithVig)),
    under: formatAmericanOdds(probabilityToAmericanOdds(underWithVig)),
  }
}

/**
 * Model-implied two-way price for a prop. Returns null when the prop has no
 * usable sample, in which case the UI should render a neutral placeholder.
 */
export function getModelPrices(prop: EnhancedPropCardData, vig = DEFAULT_VIG): PropPrices | null {
  const pOver = getOverProbability(prop)
  if (pOver === null) return null
  return pricesFromProbability(pOver, vig)
}
