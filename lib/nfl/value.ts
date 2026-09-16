/**
 * Player value model — decouples PRICE from raw OVR and gives the AI and UI a
 * role-aware read of how much a player is worth.
 *
 * Football value is position-specific: a QB's value is dominated by passing +
 * decision-making; a CB's by coverage; an EDGE's by pass rush. `unitImpact`
 * scores a player on the dimension that matters for their role.
 */

import type { NflPlayer, Position } from "./types"
import { POSITIONS } from "./types"

const A = (p: NflPlayer) => p.attributes

/**
 * Overall-rating floor for "star" treatment. NFL tier bands are coarse (tier 2
 * = overall>=81), so recognizable starters at overall 79-80 land in tier 3 and
 * would escape the star fire-sale guard. Anyone at or above this rating is
 * protected regardless of tier.
 */
export const ELITE_OVERALL = 80

/**
 * Is this player valuable enough that his opening reserve must NEVER be relaxed
 * / fire-sold to a patient bidder, and that the CPU should lean in on him?
 * Gated on tier OR overall so name stars the coarse tier bands miss are still
 * protected.
 */
export function isEliteReserve(player: NflPlayer): boolean {
  return player.tier <= 2 || player.overall >= ELITE_OVERALL
}

/** Offensive impact (0-99-ish) for offensive players; 0 for defenders. */
export function offenseScore(p: NflPlayer): number {
  const a = A(p)
  switch (p.position) {
    case "QB":
      return (
        a.shortAccuracy * 0.26 +
        a.deepAccuracy * 0.2 +
        a.decisionMaking * 0.2 +
        a.pocketAwareness * 0.14 +
        a.armStrength * 0.12 +
        a.mobility * 0.08
      )
    case "RB":
      return a.speed * 0.24 + a.vision * 0.22 + a.power * 0.18 + a.agility * 0.16 + a.catching * 0.12 + a.yac * 0.08
    case "WR":
      return a.separation * 0.28 + a.catching * 0.22 + a.routeRunning * 0.2 + a.speed * 0.16 + a.yac * 0.14
    case "TE":
      return a.catching * 0.28 + a.routeRunning * 0.22 + a.runBlock * 0.16 + a.passBlock * 0.12 + a.yac * 0.12 + a.separation * 0.1
    default:
      return 0
  }
}

/** Defensive impact (0-99-ish) for defensive players; 0 for offense. */
export function defenseScore(p: NflPlayer): number {
  const a = A(p)
  switch (p.position) {
    case "EDGE":
      return a.passRush * 0.5 + a.runStop * 0.22 + a.power * 0.16 + a.speed * 0.12
    case "LB":
      return a.tackling * 0.26 + a.runStop * 0.24 + a.coverage * 0.24 + a.awareness * 0.14 + a.speed * 0.12
    case "CB":
      return a.coverage * 0.5 + a.ballHawk * 0.2 + a.speed * 0.18 + a.agility * 0.12
    case "S":
      return a.coverage * 0.3 + a.ballHawk * 0.22 + a.tackling * 0.2 + a.runStop * 0.16 + a.speed * 0.12
    default:
      return 0
  }
}

/** The single role-relevant impact score for any player. */
export function unitImpact(p: NflPlayer): number {
  const off = offenseScore(p)
  return off > 0 ? off : defenseScore(p)
}

/** Strategic value on a 0-100 scale — blends OVR with role impact. */
export function playerValue(p: NflPlayer): number {
  const impact = unitImpact(p)
  return Math.round(p.overall * 0.6 + impact * 0.4)
}

/**
 * Positional scarcity multiplier for a pool: rarer positions worth more.
 * Returns a map position → multiplier around 1.0 (capped 0.85..1.35).
 */
export function scarcityByPosition(pool: NflPlayer[]): Record<Position, number> {
  const counts = {} as Record<Position, number>
  for (const pos of POSITIONS) counts[pos] = 0
  for (const p of pool) counts[p.position] += 1

  const total = POSITIONS.reduce((s, pos) => s + counts[pos], 0)
  const avg = total / POSITIONS.length || 1

  const out = {} as Record<Position, number>
  for (const pos of POSITIONS) {
    const c = counts[pos] || 1
    out[pos] = Math.min(1.35, Math.max(0.85, avg / c))
  }
  return out
}

/**
 * Budget-scaled opening bid. Prices are RELATIVE to the league budget so the
 * same player is affordable in every league. Model: baseline slice =
 * budget / rosterSize, times an overall-driven multiplier, capped so no single
 * player eats too much of the budget.
 */
export function scaledOpeningBid(
  p: NflPlayer,
  budget: number,
  rosterSize: number,
  maxShare?: number
): number {
  const slice = budget / rosterSize // e.g. 25/9 ≈ 2.78
  // Map overall (~78..99) → multiplier on the slice. The old curve used
  // exponent 1.6, which made the mid-star band far too cheap: an 80-overall
  // starter opened at ~$2 in a $25 league — a rounding artifact that let a
  // patient bidder snipe a genuine star for pocket change once the CPUs'
  // rosters filled. A gentler (near-linear) curve lifts the mid-star band so
  // those players carry a real price, while the maxShare cap keeps true
  // superstars affordable.
  const t = Math.max(0, Math.min(1, (p.overall - 78) / 21))
  const mult = 0.55 + Math.pow(t, 1.05) * 2.15
  let price = slice * mult
  const share = maxShare ?? (budget <= 25 ? 0.3 : budget <= 50 ? 0.36 : 0.42)
  const cap = Math.max(2, Math.floor(budget * share))
  price = Math.min(cap, Math.max(1, Math.round(price)))
  return price
}

/** Legacy flat opening bid (tier-based) — retained for budget-less callers. */
export function openingBid(p: NflPlayer): number {
  return Math.max(1, p.startingBid)
}
