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
import { loadPolicy, strategy as strategyParam } from "./policy"
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
  const W = loadPolicy().weights

  // Base: reward two-way ability, not just OVR. The learned weights scale each
  // term (baseline = 1.0 reproduces the original constants exactly).
  let d =
    player.overall * 0.5 * W.player_value_weight +
    off * 0.22 * W.offense_weight +
    def * 0.22 * W.defense_weight +
    spacing * 0.06 * W.spacing_weight

  // Personality tilt.
  d += (off - 60) * (persona.offenseBias - 1) * 0.6
  d += (def - 60) * (persona.defenseBias - 1) * 0.6

  // Team-gap awareness: what does the current roster lack? Scaled by team_fit.
  const owned = ownedPlayers(roster)
  if (owned.length > 0) {
    const avgSpacing = avg(owned, (p) => p.attributes.threePointShooting)
    const bestRim = Math.max(...owned.map((p) => p.attributes.rimProtection), 0)
    const avgPerimD = avg(owned, (p) => p.attributes.perimeterDefense)
    if (avgSpacing < 68 && spacing >= 76) d += 8 * W.team_fit_weight // needs shooting
    if (bestRim < 65 && player.attributes.rimProtection >= 80) d += 10 * W.team_fit_weight // needs a rim protector
    if (avgPerimD < 66 && player.attributes.perimeterDefense >= 82) d += 7 * W.team_fit_weight // needs a stopper
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
  const persona = PERSONALITIES[state.config.aiPersonality]

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

  // Weight the current lot with its own fair value. The previous planner used a
  // future player's price for this slot, which made the CPU open on stars and
  // then fold to the first human raise.
  const usedFuture = new Set<string>()
  const bestFutureFor = (position: string | null): SeasonPlayer | undefined => {
    let best: SeasonPlayer | undefined
    let bestScore = Number.NEGATIVE_INFINITY
    for (const candidate of future) {
      if (usedFuture.has(candidate.id)) continue
      if (position && !eligiblePositions(candidate).includes(position as never)) continue
      const score = desirability(state, team, candidate)
      if (score > bestScore) {
        best = candidate
        bestScore = score
      }
    }
    if (best) usedFuture.add(best.id)
    return best
  }

  const slotWeights: { slot: string; weight: number; isCurrent: boolean }[] = []
  for (const pos of openStarters) {
    const isCurrent = pos === claimStarter
    const candidate = isCurrent ? player : bestFutureFor(pos)
    slotWeights.push({
      slot: pos,
      weight: candidate ? fairPrice(candidate) : MIN_BID,
      isCurrent,
    })
  }
  if (needsBench) {
    const isCurrent = claimStarter === null
    const candidate = isCurrent ? player : bestFutureFor(null)
    slotWeights.push({
      slot: "BENCH",
      weight: candidate ? fairPrice(candidate) : MIN_BID,
      isCurrent,
    })
  }

  const W = loadPolicy().weights
  const totalWeight = slotWeights.reduce((sum, item) => sum + item.weight, 0) || 1
  const currentWeight =
    slotWeights.find((item) => item.isCurrent)?.weight ?? fairPrice(player)
  // budget_weight controls how freely the plan earmarks remaining budget for the
  // current slot (learned).
  const plannedAllocation = (currentWeight / totalWeight) * rem * W.budget_weight

  // Preserve enough cash to buy the cheapest normally-priced future option for
  // every other slot. maxAffordable only reserves the hard $1 minimum; this
  // strategic reserve prevents the CPU from forcing itself into auto-fill.
  const reserveUsed = new Set<string>()
  const cheapestFutureOpening = (position: string | null): number => {
    let best: SeasonPlayer | undefined
    let bestPrice = Number.POSITIVE_INFINITY
    for (const candidate of future) {
      if (reserveUsed.has(candidate.id)) continue
      if (position && !eligiblePositions(candidate).includes(position as never)) continue
      const price = scaledOpeningBid(candidate, total, state.config.rosterSize)
      if (price < bestPrice) {
        best = candidate
        bestPrice = price
      }
    }
    if (best) reserveUsed.add(best.id)
    return Number.isFinite(bestPrice) ? bestPrice : MIN_BID
  }

  let futureReserve = 0
  for (const pos of openStarters) {
    if (pos !== claimStarter) futureReserve += cheapestFutureOpening(pos)
  }
  if (needsBench && claimStarter !== null) {
    futureReserve += cheapestFutureOpening(null)
  }
  const reserveAwareCap = Math.max(MIN_BID, rem - futureReserve)

  // Ceiling: the CPU may spend up to ~1.8× its planned allocation on a lot it
  // really wants (flexibility to win a contested stud), but never so much that
  // it can't fill the remaining slots. Both the hard $1/slot cap and the
  // strategic reserve (cheapest normal opener for every other slot) apply, so
  // winning this lot never forces the roster into emergency auto-fill.
  const ceilingRaw = Math.max(MIN_BID, Math.round(plannedAllocation * 1.8))
  let ceiling = Math.min(cap, reserveAwareCap, ceilingRaw)

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
  // future_value_weight scales how strongly a good alternative suppresses the bid.
  const gap = myDesire - bestAlt * W.future_value_weight
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
    // Spend freely: money saved past this point is wasted, and there are no
    // other slots to reserve for, so the hard cap is the only limit.
    ceiling = cap
    commitFrac = Math.max(commitFrac, 0.6)
  }

  // positional_need premium: extra willingness to commit when filling a needed
  // starter slot. NO-OP at weight 1.0 (baseline reproduces the original engine);
  // the learner can only ADD/REMOVE effect as the weight deviates from 1.
  if (fillsNeededStarter) {
    commitFrac = Math.max(0, Math.min(1, commitFrac * (1 + 0.15 * (W.positional_need_weight - 1))))
  }

  // Urgency: as open slots grow relative to the future supply that fits them,
  // spend more freely so we don't get stranded. NO-OP at weight 1.0.
  if (open > 1 && future.length > 0) {
    const fitSupply = future.filter((p) =>
      eligiblePositions(p).some((pos) => fillsSlots.includes(pos))
    ).length
    const pressure = open / Math.max(1, fitSupply)
    commitFrac = Math.max(0, Math.min(1, commitFrac * (1 + (pressure - 1) * 0.1 * (W.urgency_weight - 1))))
  }

  // Scarcity premium for genuinely rare needed positions in the FUTURE queue.
  // At weight 1.0 this is exactly the original `max(scarcity, 1)`; the learner
  // scales the premium above/below that baseline.
  const scarcity = scarcityByPosition(future)
  const rawScMult = fillsSlots
    .filter((pos) => openStarters.includes(pos))
    .reduce((m, pos) => Math.max(m, scarcity[pos] ?? 1), 1)
  const scMult = 1 + (rawScMult - 1) * W.scarcity_weight

  // ── OPPONENT MODELING (open-information; NO-OP at weight 0) ───────────────
  // "Who else wants this player, and how desperate are they?" Mirrors
  // auction_ai/ai/policy.py _opponent_features exactly.
  const rival = opponentFeatures(state, team, player)
  commitFrac = Math.max(0, Math.min(1, commitFrac * (1 + rival.demand * W.rival_demand_weight)))
  commitFrac = Math.max(0, Math.min(1, commitFrac * (1 + rival.desperation * W.rival_desperation_weight)))
  commitFrac = Math.max(0, Math.min(1, commitFrac * (1 - rival.uncontested * 0.5 * W.snipe_weight)))

  // ── AUCTION-STAGE awareness (NO-OP at weight 0) ───────────────────────────
  const stage = auctionStage(state)
  commitFrac = Math.max(0, Math.min(1, commitFrac * (1 + (stage - 0.5) * 0.4 * W.auction_stage_weight)))

  let target = ceiling * commitFrac * scMult

  // Difficulty aggression (kept modest — planning is the real strength) and the
  // personality's willingness to pay. Superstar/aggressive lean in on stars;
  // value stays disciplined. Everything is still clamped by `ceiling`, so this
  // never breaks the budget reserve.
  target *= diff.aggression
  const personaAggression =
    player.tier <= 2 ? persona.aggression * persona.superstarBias : persona.aggression
  target *= personaAggression
  target *= 1 - persona.valueDiscipline * 0.15
  // risk_tolerance: learned global willingness-to-pay multiplier.
  target *= W.risk_tolerance

  // overpay_penalty: pull the target back toward the planned allocation. A
  // higher penalty means the CPU is more reluctant to exceed its plan (learned).
  if (target > plannedAllocation && plannedAllocation > 0) {
    const excess = target - plannedAllocation
    target = plannedAllocation + excess / Math.max(1, W.overpay_penalty)
  }

  // ── OPPORTUNITY COST (explicit; NO-OP at weight 0) ────────────────────────
  // Committing budget now reduces what's left for future needs.
  if (W.opportunity_cost_weight !== 0 && rem > 0 && open > 1) {
    const consumeFrac = Math.min(1, target / rem)
    const futureNeeds = open - 1
    const oc = consumeFrac * (futureNeeds / Math.max(1, open))
    target *= Math.max(0.3, 1 - oc * 0.5 * W.opportunity_cost_weight)
  }

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

/**
 * Open-information opponent model for the CURRENT lot — mirrors
 * auction_ai/ai/policy.py `_opponent_features`. Returns demand / desperation /
 * uncontested in [0,1], all derived from state the human can also see (rosters,
 * budgets, queue). Cheap features, not a simulation.
 */
function opponentFeatures(
  state: ArenaState,
  team: TeamId,
  player: SeasonPlayer
): { demand: number; desperation: number; uncontested: number } {
  if (!state.lot) return { demand: 0, desperation: 0, uncontested: 1 }
  const opp: TeamId = team === "P1" ? "P2" : "P1"
  const oppRoster = state.rosters[opp]
  if (isRosterComplete(oppRoster) || !canAddPlayer(oppRoster, player)) {
    return { demand: 0, desperation: 0, uncontested: 1 }
  }
  const oppCap = maxAffordable(state.config.budgetPerPlayer, oppRoster)
  if (oppCap < state.lot.openingBid) return { demand: 0, desperation: 0, uncontested: 1 }

  const oppDesire = desirability(state, opp, player)
  const demand = Math.max(0, Math.min(1, (oppDesire - 45) / 55))

  const oppOpen = openStarterSlots(oppRoster)
  const fills = eligiblePositions(player).filter((pos) => oppOpen.includes(pos))
  let desperation = 0
  if (fills.length > 0) {
    const pool = getSeasonPlayers(state.season)
    const byId = new Map(pool.map((p) => [p.id, p] as const))
    const future = state.queue
      .filter((id) => id !== player.id)
      .map((id) => byId.get(id))
      .filter((p): p is SeasonPlayer => !!p)
    const minSupply = Math.min(
      ...fills.map((pos) => future.filter((p) => eligiblePositions(p).includes(pos)).length)
    )
    desperation = Math.max(0, Math.min(1, (3 - minSupply) / 3))
  }
  return { demand, desperation, uncontested: 0 }
}

/** How far through the auction, in [0,1] — mirrors `_auction_stage`. */
function auctionStage(state: ArenaState): number {
  const totalSlots = 2 * state.config.rosterSize
  let filled = 0
  for (const t of ["P1", "P2"] as TeamId[]) {
    for (const o of Object.values(state.rosters[t].slots)) if (o) filled += 1
  }
  return Math.max(0, Math.min(1, filled / Math.max(1, totalSlots)))
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
  const walkAway = walkAwayPrice(state, team)

  const openingClaim = state.lot.highBidder === null
  const current = state.lot.currentBid

  // ── STRATEGY head (mirrors auction_ai/ai/policy.py decide()). Every term is a
  //    NO-OP at its neutral value (0), so v6 reproduces the original min-step
  //    reactive bidding exactly. Deterministic (seeded hash) for TS/Py parity.

  // response_aggression: adjust the EFFECTIVE ceiling by how hard the opponent
  // is pushing this lot.
  const resp = strategyParam("response_aggression")
  let effWalk = walkAway
  if (resp !== 0) {
    const oppRaises = opponentRaisesOnLot(state, team)
    if (oppRaises > 0) {
      const adj = 1 + Math.max(-1, Math.min(1, resp)) * 0.15 * Math.min(1, oppRaises / 3)
      effWalk = walkAway * adj
    }
  }

  // early_pass_margin: shave the cutoff to concede marginal lots sooner.
  const epm = Math.max(0, Math.min(1, strategyParam("early_pass_margin")))
  const cutoff = effWalk * (1 - epm * 0.2)

  // jump_bid_frac: jump beyond the minimum raise toward the ceiling.
  const jbf = Math.max(0, Math.min(1, strategyParam("jump_bid_frac")))
  const minNext = openingClaim ? current : current + step
  let next = minNext
  if (jbf > 0 && !openingClaim) {
    const gap = Math.max(0, Math.round(cutoff) - current)
    const jumpTo = current + step + Math.round(jbf * gap)
    next = Math.max(minNext, jumpTo)
  }

  // Hard-rule fallbacks (identical to v6): fall back to the smallest legal raise.
  if (!openingClaim && (next > cap || next > cutoff)) {
    next = current + step
    if (next > cap || next > cutoff) next = current + 1
  }
  if (next > cap) return { action: "pass" }
  if (next > cutoff) return { action: "pass" }

  // hold_threshold: on a cheap opening claim with a future alternative, sometimes
  // WAIT (pass this poll) rather than reveal interest early.
  const hold = strategyParam("hold_threshold")
  if (hold > 0 && openingClaim) {
    const comfortable = walkAway > 0 && next <= walkAway * 0.8
    const safeToWait = hasFutureAlternative(state, team)
    if (comfortable && safeToWait) {
      const roll = (hash(state.gameId + state.lot.player.id + team + "hold" + current) % 1000) / 1000
      if (roll < Math.max(0, Math.min(0.6, hold))) return { action: "pass" }
    }
  }

  // Difficulty mistake (fixed layer).
  const diff = difficultyProfile(state.config.difficulty)
  const marginal = next >= walkAway * 0.85
  if (
    diff.mistakeChance > 0 &&
    marginal &&
    state.lot.currentBid > state.lot.openingBid
  ) {
    const roll = ((hash(state.gameId + state.lot.player.id + team + state.lot.currentBid) % 1000) / 1000)
    if (roll < diff.mistakeChance) return { action: "pass" }
  }

  return { action: "bid", amount: next }
}

/** How many times the opponent has raised the current lot (from bid history). */
function opponentRaisesOnLot(state: ArenaState, team: TeamId): number {
  if (!state.lot) return 0
  const opp: TeamId = team === "P1" ? "P2" : "P1"
  return state.history.filter(
    (h) => h.playerId === state.lot!.player.id && h.bidder === opp
  ).length
}

/** Is another eligible player still queued for a slot the current lot fills? */
function hasFutureAlternative(state: ArenaState, team: TeamId): boolean {
  if (!state.lot) return false
  const player = state.lot.player
  const roster = state.rosters[team]
  const openStarters = openStarterSlots(roster)
  const fills = eligiblePositions(player).filter((pos) => openStarters.includes(pos))
  if (fills.length === 0) return true // bench/luxury lot — safe to wait
  const pool = getSeasonPlayers(state.season)
  const byId = new Map(pool.map((p) => [p.id, p] as const))
  for (const pid of state.queue) {
    if (pid === player.id) continue
    const p = byId.get(pid)
    if (p && eligiblePositions(p).some((pos) => fills.includes(pos as never))) return true
  }
  return false
}
