/**
 * AIController — decides how the AI seat bids on the current lot.
 *
 * The AI is NOT random. For each lot it computes a "walk-away price": the most
 * it's willing to pay given player value, positional need, scarcity, remaining
 * budget, roster balance, and personality. It raises up to that price and
 * passes above it. Personalities tilt aggressiveness and priorities.
 */

import type {
  AIDifficulty,
  AIPersonality,
  RosterState,
  SeasonPlayer,
  TeamId,
} from "./types"
import type { ArenaState } from "./auction"
import { canAddPlayer, openStarterSlots, eligiblePositions, isRosterComplete, openSlots } from "./roster"
import { maxAffordable, remaining, MIN_BID } from "./budget"
import { offenseScore, defenseScore, spacingScore, scarcityByPosition, scaledOpeningBid } from "./value"
import { getSeasonPlayers } from "./data"

interface Personality {
  aggression: number // multiplier on walk-away price
  offenseBias: number
  defenseBias: number
  superstarBias: number // extra willingness to pay for tier-1/2
  valueDiscipline: number // how much to avoid overpaying (0-1)
}

const PERSONALITIES: Record<AIPersonality, Personality> = {
  balanced:   { aggression: 1.08, offenseBias: 1.0, defenseBias: 1.0, superstarBias: 1.05, valueDiscipline: 0.25 },
  aggressive: { aggression: 1.35, offenseBias: 1.05, defenseBias: 1.0, superstarBias: 1.2, valueDiscipline: 0.12 },
  value:      { aggression: 1.0, offenseBias: 1.0, defenseBias: 1.0, superstarBias: 0.95, valueDiscipline: 0.5 },
  superstar:  { aggression: 1.2, offenseBias: 1.0, defenseBias: 0.95, superstarBias: 1.5, valueDiscipline: 0.15 },
  defense:    { aggression: 1.1, offenseBias: 0.9, defenseBias: 1.35, superstarBias: 1.05, valueDiscipline: 0.25 },
  offense:    { aggression: 1.12, offenseBias: 1.4, defenseBias: 0.85, superstarBias: 1.1, valueDiscipline: 0.2 },
}

interface DifficultyProfile {
  aggression: number // scales walk-away price
  mistakeChance: number // chance to make a suboptimal (low) bid / bail early
  jitter: number // random noise on price
}

function difficultyProfile(d: AIDifficulty): DifficultyProfile {
  switch (d) {
    // Easy: frequently bails on contested players → loses the studs, and its
    // valuations are noisy so it overpays for mediocre ones. Weak roster.
    case "easy":   return { aggression: 0.9, mistakeChance: 0.45, jitter: 4 }
    // Hard: disciplined valuations (aggression ~1 = pays fair value, not more),
    // never makes mistakes, no noise → reliably lands the best available roster.
    case "hard":   return { aggression: 1.0, mistakeChance: 0.0, jitter: 0 }
    case "medium":
    default:       return { aggression: 0.97, mistakeChance: 0.18, jitter: 1.5 }
  }
}

/**
 * Desirability of a player to THIS AI seat, on a normalized 0..100 scale.
 * Blends the qualities that actually win simulations: overall + two-way value +
 * spacing, tilted by the AI's personality and its current roster gaps
 * (positional need, "do I lack shooting / defense / a rim protector").
 */
function desirability(state: ArenaState, team: TeamId, player: SeasonPlayer): number {
  const persona = PERSONALITIES[state.config.aiPersonality]
  const roster = state.rosters[team]
  const off = offenseScore(player)
  const def = defenseScore(player)
  const spacing = spacingScore(player)

  // Base: reward two-way ability, not just OVR.
  let d = player.overall * 0.5 + off * 0.22 + def * 0.22 + spacing * 0.06

  // Personality tilt.
  d += (off - 60) * (persona.offenseBias - 1) * 0.6
  d += (def - 60) * (persona.defenseBias - 1) * 0.6

  // Team-gap awareness: what does the current roster lack?
  const owned = ownedPlayers(roster)
  if (owned.length > 0) {
    const avgSpacing = avg(owned, (p) => p.attributes.threePointShooting)
    const bestRim = Math.max(...owned.map((p) => p.attributes.rimProtection), 0)
    const avgPerimD = avg(owned, (p) => p.attributes.perimeterDefense)
    if (avgSpacing < 68 && spacing >= 76) d += 8 // needs shooting
    if (bestRim < 65 && player.attributes.rimProtection >= 80) d += 10 // needs a rim protector
    if (avgPerimD < 66 && player.attributes.perimeterDefense >= 82) d += 7 // needs a stopper
  }

  // Star premium.
  if (player.tier === 1) d += 10
  else if (player.tier === 2) d += 5
  d *= player.tier <= 2 ? persona.superstarBias : 1

  // Difficulty distorts VALUATION ACCURACY. Easy mis-prices players (deterministic
  // per player+game so it's stable within a game): it flattens the gap between
  // stars and role players, so it overrates scrubs and underrates studs → a
  // worse roster. Hard sees true value.
  const diff = difficultyProfile(state.config.difficulty)
  if (diff.jitter > 0) {
    const noise = (((hash(player.id + team + state.gameId) % 200) / 100) - 1) * diff.jitter * 3 // ±
    // Pull Easy's valuation toward a flat mean (regression to mediocrity).
    const flatten = state.config.difficulty === "easy" ? 0.35 : state.config.difficulty === "medium" ? 0.12 : 0
    d = d * (1 - flatten) + 70 * flatten + noise
  }

  return Math.max(0, Math.min(120, d))
}

function ownedPlayers(roster: RosterState): SeasonPlayer[] {
  return Object.values(roster.slots).filter((o) => o !== null).map((o) => o!.player)
}
function avg(arr: SeasonPlayer[], f: (p: SeasonPlayer) => number): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, p) => s + f(p), 0) / arr.length
}

/**
 * How much this AI seat is willing to pay for the current lot — a genuine
 * "walk-away price". The model:
 *   1. Reserve the minimum needed to fill every OTHER open slot ($1 each).
 *   2. The rest is "spendable" on the current player.
 *   3. Allocate a share of spendable based on how good this player is RELATIVE
 *      to what's realistically left in the pool (grab studs, don't overpay for
 *      guys you can replace), scaled by roster need, scarcity, and personality.
 *
 * This makes the AI concentrate money on difference-makers instead of hoarding
 * cash for scrubs — the reason it was losing.
 */
/**
 * LOOKAHEAD-PLANNING walk-away price.
 *
 * The CPU "cheats" (as requested): it knows the exact remaining draft order
 * (`state.queue`) and plans its whole budget across all its open slots. It only
 * commits big when the current player is genuinely its best remaining chance at
 * a needed slot; if a comparable player is coming later, it stays disciplined
 * and saves money. This stops it from emptying its wallet on the first stud.
 *
 * Method (marginal value over the best future alternative + budget reservation):
 *  1. Determine open slots and the future queue of players that fit each.
 *  2. Build a greedy PLAN: assign the best still-coming player to each open
 *     slot, estimate a fair price for each (scaled to budget), summed = the
 *     money we should RESERVE for future slots.
 *  3. The current lot's ceiling = remaining budget − reserve-for-other-slots.
 *  4. Compute marginal value: how much better is this player than the best
 *     alternative that will still come for the same slot? Small gap → bid low
 *     (wait for the alternative). Big gap / no alternative → pay up to ceiling.
 */
export function walkAwayPrice(state: ArenaState, team: TeamId): number {
  if (!state.lot) return 0
  const player = state.lot.player
  const roster = state.rosters[team]
  if (isRosterComplete(roster)) return 0
  if (!canAddPlayer(roster, player)) return 0

  const total = state.config.budgetPerPlayer
  const rem = remaining(total, roster)
  const cap = maxAffordable(total, roster)
  const diff = difficultyProfile(state.config.difficulty)

  // Players still to be auctioned AFTER accounting for the current lot. The CPU
  // sees the true future order (the "cheat").
  const pool = getSeasonPlayers(state.season)
  const byId = new Map(pool.map((p) => [p.id, p] as const))
  const futureIds = state.queue.filter((id) => id !== player.id)
  const future: SeasonPlayer[] = futureIds
    .map((id) => byId.get(id))
    .filter((p): p is SeasonPlayer => !!p)

  // What we still need (starters first, bench last).
  const openStarters = openStarterSlots(roster) // Position[]
  const needsBench = roster.slots.BENCH === null
  // Count how many slots remain besides the one this player would take.
  const open = openSlots(roster).length

  // Estimate a fair acquisition price for a player at this budget (what the CPU
  // expects to actually pay in a contested auction ≈ ~1.15× opening).
  const fairPrice = (p: SeasonPlayer) =>
    Math.max(1, Math.round(scaledOpeningBid(p, total, state.config.rosterSize) * 1.15))

  // ── Build the greedy PLAN across ALL open slots, then scale to the budget ──
  // For each open starter slot, find the best future candidate and estimate its
  // fair price. These raw fair prices usually SUM to more than the budget, so we
  // scale the whole plan proportionally to fit `rem`. The current player's slot
  // gets its scaled share as a ceiling; the rest is reserved for future slots.
  const fillsSlots = eligiblePositions(player) // slots this player could take
  const claimStarter = openStarters.find((pos) => fillsSlots.includes(pos)) ?? null

  // Weight = expected fair price for the best future candidate at each slot.
  const usedFuture = new Set<string>()
  const slotWeights: { slot: string; weight: number; isCurrent: boolean }[] = []
  for (const pos of openStarters) {
    const cand = future.find(
      (p) => !usedFuture.has(p.id) && eligiblePositions(p).includes(pos)
    )
    if (cand) usedFuture.add(cand.id)
    slotWeights.push({ slot: pos, weight: cand ? fairPrice(cand) : MIN_BID, isCurrent: pos === claimStarter })
  }
  if (needsBench) {
    slotWeights.push({ slot: "BENCH", weight: MIN_BID * 2, isCurrent: claimStarter === null })
  }

  const totalWeight = slotWeights.reduce((s, w) => s + w.weight, 0) || 1
  // The current player's planned allocation = its slot's share of the budget.
  const currentWeight =
    slotWeights.find((w) => w.isCurrent)?.weight ??
    (claimStarter ? fairPrice(player) : MIN_BID * 2)
  const plannedAllocation = (currentWeight / totalWeight) * rem

  // Ceiling: the CPU may spend up to ~1.8× its planned allocation on a lot it
  // really wants (flexibility to win a contested stud), but never so much that
  // it can't fill the remaining slots (cap enforces $1/slot feasibility).
  const ceilingRaw = Math.max(MIN_BID, Math.round(plannedAllocation * 1.8))
  let ceiling = Math.min(cap, ceilingRaw)

  // ── Marginal value: is a comparable player coming for the same slot? ──────
  const myDesire = desirability(state, team, player)
  // Best future alternative that fits ANY slot the current player fits.
  let bestAlt = 0
  for (const p of future) {
    if (!canAddPlayer(roster, p)) continue
    const sharesSlot = eligiblePositions(p).some((pos) => fillsSlots.includes(pos) && (openStarters.includes(pos) || needsBench))
    if (!sharesSlot) continue
    const d = desirability(state, team, p)
    if (d > bestAlt) bestAlt = d
  }
  // If a nearly-as-good (or better) player is coming for the same slot, the
  // current player's *marginal* worth is small → bid low and wait.
  // gap in desirability (0..~40) → fraction of ceiling we'll commit.
  const gap = myDesire - bestAlt
  // Sigmoid-ish: big positive gap → ~1.0; zero/negative gap → ~0.25.
  let commitFrac = 0.25 + 0.75 / (1 + Math.exp(-gap / 6))
  commitFrac = Math.max(0, Math.min(1, commitFrac))

  // If this player fills a NEEDED starter slot, we care more.
  const fillsNeededStarter = claimStarter !== null
  // Is the bench our LAST open slot? Then our whole remaining budget has nothing
  // else to buy, so lowballing it is strictly wrong — it just leaves money on the
  // table and risks the slot going unfilled (and getting auto-filled with a scrub).
  const benchIsLastSlot = openStarters.length === 0 && needsBench
  if (!fillsNeededStarter && !benchIsLastSlot) {
    // A luxury bench piece while starters are still open — stay cheap.
    ceiling = Math.min(ceiling, Math.max(MIN_BID, Math.round(rem * 0.18)))
    commitFrac *= 0.7
  } else if (benchIsLastSlot) {
    // Spend freely: money saved past this point is wasted.
    ceiling = cap
    commitFrac = Math.max(commitFrac, 0.6)
  }

  // Scarcity premium for genuinely rare needed positions in the FUTURE queue.
  const scarcity = scarcityByPosition(future)
  const scMult = fillsSlots
    .filter((pos) => openStarters.includes(pos))
    .reduce((m, pos) => Math.max(m, scarcity[pos] ?? 1), 1)

  let target = ceiling * commitFrac * scMult

  // Difficulty aggression (kept modest — planning is the real strength).
  target *= diff.aggression

  let price = Math.min(ceiling, Math.round(target))

  // The CPU is always willing to buy a rosterable player CHEAP — it opens and
  // contests auctions at low prices even when better players are coming; it
  // just won't *overpay* (that's what the ceiling/commitFrac controls). Only a
  // genuinely undesirable player (would hurt the roster) is skipped entirely.
  // Always willing to open at the asking price when the slot MUST be filled —
  // passing on an affordable player for our last empty slot means auto-filling a
  // scrub instead.
  const wantsAtAll = myDesire >= 45 || fillsNeededStarter || benchIsLastSlot
  const floor = wantsAtAll ? Math.min(state.lot.openingBid, ceiling) : 0
  price = Math.max(floor, price)

  // Difficulty noise (widened for easier levels).
  if (diff.jitter > 0) {
    const jitter = -Math.round(diff.jitter * ((hash(player.id + team) % 100) / 100))
    price = Math.max(floor, Math.min(ceiling, price + jitter))
  }

  void open
  return Math.max(0, Math.min(cap, price))
}

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

export type AIDecision =
  | { action: "bid"; amount: number }
  | { action: "pass" }

/**
 * Decide the AI's move on the current lot. Called by the server between human
 * actions / on tick.
 *
 * - If the AI is already the high bidder, it holds (passes to let the lot settle).
 * - Otherwise it raises to currentBid+1 if that's within its walk-away price.
 */
export function decideAI(state: ArenaState, team: TeamId): AIDecision {
  if (!state.lot) return { action: "pass" }
  if (state.lot.highBidder === team) return { action: "pass" }

  const step = state.config.bidIncrement || 1
  const cap = maxAffordable(state.config.budgetPerPlayer, state.rosters[team])
  // Opening an unclaimed lot: bid AT the opening price. Otherwise raise by step.
  let next =
    state.lot.highBidder === null
      ? state.lot.currentBid
      : state.lot.currentBid + step
  if (next > cap) next = state.lot.highBidder === null ? state.lot.currentBid : state.lot.currentBid + 1
  if (next > cap) return { action: "pass" }

  const walkAway = walkAwayPrice(state, team)
  if (next > walkAway) return { action: "pass" }

  // Difficulty mistake: easier CPUs sometimes bail on a player they should win,
  // but only once the price is already past the opening bid (so they still
  // *start* auctions and don't just concede everything).
  const diff = difficultyProfile(state.config.difficulty)
  if (diff.mistakeChance > 0 && state.lot.currentBid > state.lot.openingBid) {
    const roll = ((hash(state.gameId + state.lot.player.id + team + state.lot.currentBid) % 1000) / 1000)
    if (roll < diff.mistakeChance) return { action: "pass" }
  }

  return { action: "bid", amount: next }
}
