/**
 * Player value model — decouples *price* from raw OVR.
 *
 * A player's suggested opening bid comes from their tier, but their true
 * strategic VALUE (used by the AI and shown as a hint) blends:
 *   - overall ability
 *   - positional scarcity (how rare their position is in the pool)
 *   - two-way balance (offense + defense, not just scoring)
 *   - efficiency & low turnover risk
 *   - shooting gravity / spacing (helps any roster fit)
 *
 * Two 92-OVR players can therefore carry very different value, which is the
 * whole point: reward basketball IQ, not OVR-counting.
 */

import type { SeasonPlayer, Position } from "./types"
import { eligiblePositions } from "./roster"

const A = (p: SeasonPlayer) => p.attributes

/** Offensive impact score (0-99-ish). */
export function offenseScore(p: SeasonPlayer): number {
  const a = A(p)
  return (
    a.scoring * 0.28 +
    ((a.threePointShooting + a.midrange + a.finishing) / 3) * 0.22 +
    a.playmaking * 0.18 +
    a.efficiency * 0.16 +
    (99 - a.turnoverRisk) * 0.06 +
    a.ballHandling * 0.1
  )
}

/** Defensive impact score (0-99-ish). */
export function defenseScore(p: SeasonPlayer): number {
  const a = A(p)
  return (
    a.perimeterDefense * 0.26 +
    a.interiorDefense * 0.2 +
    a.rimProtection * 0.16 +
    a.steal * 0.14 +
    a.block * 0.14 +
    a.rebounding * 0.1
  )
}

/** Spacing / gravity — helps everyone else on the floor. */
export function spacingScore(p: SeasonPlayer): number {
  return A(p).threePointShooting
}

/**
 * Strategic value on a 0-100 scale. Rewards two-way balance and efficiency
 * beyond pure OVR.
 */
export function playerValue(p: SeasonPlayer): number {
  const off = offenseScore(p)
  const def = defenseScore(p)
  const balance = 1 - Math.abs(off - def) / 100 // reward two-way players
  const base = p.overall * 0.55 + off * 0.2 + def * 0.2
  return Math.round(base * (0.9 + balance * 0.2))
}

/**
 * Positional scarcity multiplier for a pool: rarer positions are worth more.
 * Returns a map position → multiplier around 1.0.
 */
export function scarcityByPosition(pool: SeasonPlayer[]): Record<Position, number> {
  const counts: Record<Position, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 }
  for (const p of pool) {
    for (const pos of eligiblePositions(p)) counts[pos] += 1
  }
  const avg =
    (counts.PG + counts.SG + counts.SF + counts.PF + counts.C) / 5 || 1
  const out: Record<Position, number> = { PG: 1, SG: 1, SF: 1, PF: 1, C: 1 }
  for (const pos of Object.keys(counts) as Position[]) {
    const c = counts[pos] || 1
    // Fewer eligible players ⇒ higher multiplier (capped).
    out[pos] = Math.min(1.35, Math.max(0.85, avg / c))
  }
  return out
}

/**
 * Budget-scaled opening bid.
 *
 * Prices are RELATIVE to the league budget so the same player is affordable in
 * every league: a superstar might open at ~$6 in a $25 league and ~$24 in a
 * $100 league. This solves "how does a $15 Jokic fit in a $25 budget" — his
 * price scales down with the budget.
 *
 * Model: baseline slice = budget / rosterSize. A player's opening bid is a
 * multiplier of that slice driven by overall rating (curved), then CAPPED so no
 * single player can ever cost more than `maxShare` of the whole budget (keeps
 * every player affordable and rosterable).
 */
export function scaledOpeningBid(
  p: SeasonPlayer,
  budget: number,
  rosterSize: number,
  maxShare?: number
): number {
  const slice = budget / rosterSize // e.g. 25/6 ≈ 4.17
  // Map overall (roughly 78..99) → multiplier ~0.35 .. ~2.6 on the slice.
  const t = Math.max(0, Math.min(1, (p.overall - 76) / 22))
  const mult = 0.35 + Math.pow(t, 1.6) * 2.25
  let price = slice * mult
  // Cap so nobody eats too much of the budget. Smaller leagues cap TIGHTER so a
  // superstar can't cost half your money: ~30% in a $25 league (≈ $7-8 max),
  // rising toward ~40% in larger leagues where concentration is more viable.
  const share = maxShare ?? (budget <= 25 ? 0.3 : budget <= 50 ? 0.36 : 0.42)
  const cap = Math.max(2, Math.floor(budget * share))
  price = Math.min(cap, Math.max(1, Math.round(price)))
  return price
}

/**
 * Legacy flat opening bid (tier-based) — retained for any caller that doesn't
 * know the budget. Prefer `scaledOpeningBid`.
 */
export function openingBid(p: SeasonPlayer): number {
  return Math.max(1, p.startingBid)
}
