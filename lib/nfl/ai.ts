/**
 * AIController — decides how the AI seat bids on the current lot.
 *
 * Not random. For each lot it computes a "walk-away price": the most it will pay
 * given role impact, positional need, scarcity, remaining budget, and
 * personality. It raises up to that price and passes above it. It plans its
 * whole budget across open slots using the true future queue (an intentional
 * "cheat") so it saves money when a comparable player is coming later.
 */

import type {
  AIDifficulty,
  AIPersonality,
  RosterState,
  NflPlayer,
  RosterSlot,
  TeamId,
} from "./types"
import { SLOT_POSITION } from "./types"
import type { NflAuctionState } from "./auction"
import { canAddPlayer, openSlots, eligibleSlots, isRosterComplete, ownedPlayers } from "./roster"
import { maxAffordable, remaining, MIN_BID } from "./budget"
import { offenseScore, defenseScore, unitImpact, scarcityByPosition, scaledOpeningBid } from "./value"
import { getSeasonPlayers } from "./data"

interface Personality {
  aggression: number
  offenseBias: number
  defenseBias: number
  superstarBias: number
  valueDiscipline: number
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
  aggression: number
  mistakeChance: number
  jitter: number
}

function difficultyProfile(d: AIDifficulty): DifficultyProfile {
  switch (d) {
    case "easy":   return { aggression: 0.9, mistakeChance: 0.45, jitter: 4 }
    case "hard":   return { aggression: 1.0, mistakeChance: 0.0, jitter: 0 }
    case "medium":
    default:       return { aggression: 0.97, mistakeChance: 0.18, jitter: 1.5 }
  }
}

function slotsNeeded(roster: RosterState): RosterSlot[] {
  return openSlots(roster)
}

/** Desirability of a player to THIS AI seat, normalized 0..120. */
function desirability(state: NflAuctionState, team: TeamId, player: NflPlayer): number {
  const persona = PERSONALITIES[state.config.aiPersonality]
  const roster = state.rosters[team]
  const off = offenseScore(player)
  const def = defenseScore(player)
  const isOffense = off > 0

  // Base: role impact + overall.
  let d = player.overall * 0.5 + unitImpact(player) * 0.4

  // Personality tilt by side of the ball.
  if (isOffense) d += (off - 60) * (persona.offenseBias - 1) * 0.6
  else d += (def - 60) * (persona.defenseBias - 1) * 0.6

  // Positional need: strongly prefer a position the roster still lacks. A QB is
  // uniquely important — the offense can't function without one.
  const need = openSlots(roster).some((slot) => SLOT_POSITION[slot] === player.position)
  if (need) {
    d += 8
    if (player.position === "QB") d += 10
  } else {
    // Already have this position filled (e.g. both WR slots) → much less useful.
    d -= 20
  }

  // Star premium.
  if (player.tier === 1) d += 10
  else if (player.tier === 2) d += 5
  d *= player.tier <= 2 ? persona.superstarBias : 1

  // Difficulty distorts VALUATION ACCURACY (stable per player+game).
  const diff = difficultyProfile(state.config.difficulty)
  if (diff.jitter > 0) {
    const noise = (((hash(player.id + team + state.gameId) % 200) / 100) - 1) * diff.jitter * 3
    const flatten = state.config.difficulty === "easy" ? 0.35 : state.config.difficulty === "medium" ? 0.12 : 0
    d = d * (1 - flatten) + 70 * flatten + noise
  }

  return Math.max(0, Math.min(120, d))
}

/** Lookahead budget-planning walk-away price. */
export function walkAwayPrice(state: NflAuctionState, team: TeamId): number {
  if (!state.lot) return 0
  const player = state.lot.player
  const roster = state.rosters[team]
  if (isRosterComplete(roster)) return 0
  if (!canAddPlayer(roster, player)) return 0

  const total = state.config.budgetPerPlayer
  const rem = remaining(total, roster)
  const cap = maxAffordable(total, roster)
  const diff = difficultyProfile(state.config.difficulty)

  const pool = getSeasonPlayers(state.season)
  const byId = new Map(pool.map((p) => [p.id, p] as const))
  const future: NflPlayer[] = state.queue
    .filter((id) => id !== player.id)
    .map((id) => byId.get(id))
    .filter((p): p is NflPlayer => !!p)

  const fairPrice = (p: NflPlayer) =>
    Math.max(1, Math.round(scaledOpeningBid(p, total, state.config.rosterSize) * 1.15))

  // Which open slot(s) this player could take.
  const fillsSlots = eligibleSlots(player).filter((slot) => roster.slots[slot] === null)
  const claimSlot = fillsSlots[0] ?? null

  // Build a greedy plan across all open slots; each slot's weight = expected
  // fair price of the best future candidate for it. Scale plan to fit budget.
  const needed = slotsNeeded(roster)
  const usedFuture = new Set<string>()
  const slotWeights: { slot: RosterSlot; weight: number; isCurrent: boolean }[] = []
  for (const slot of needed) {
    const wantPos = SLOT_POSITION[slot]
    const cand = future.find((p) => !usedFuture.has(p.id) && p.position === wantPos)
    if (cand) usedFuture.add(cand.id)
    slotWeights.push({ slot, weight: cand ? fairPrice(cand) : MIN_BID, isCurrent: slot === claimSlot })
  }

  const totalWeight = slotWeights.reduce((s, w) => s + w.weight, 0) || 1
  const currentWeight = slotWeights.find((w) => w.isCurrent)?.weight ?? (claimSlot ? fairPrice(player) : MIN_BID)
  const plannedAllocation = (currentWeight / totalWeight) * rem

  const ceilingRaw = Math.max(MIN_BID, Math.round(plannedAllocation * 1.8))
  const ceiling = Math.min(cap, ceilingRaw)

  // Marginal value: is a comparable player coming for the same slot?
  const myDesire = desirability(state, team, player)
  let bestAlt = 0
  for (const p of future) {
    if (!canAddPlayer(roster, p)) continue
    const sharesSlot = eligibleSlots(p).some((slot) => fillsSlots.includes(slot))
    if (!sharesSlot) continue
    const dd = desirability(state, team, p)
    if (dd > bestAlt) bestAlt = dd
  }
  const gap = myDesire - bestAlt
  let commitFrac = 0.25 + 0.75 / (1 + Math.exp(-gap / 6))
  commitFrac = Math.max(0, Math.min(1, commitFrac))

  // Scarcity premium for rare needed positions in the future queue.
  const scarcity = scarcityByPosition(future)
  const scMult = Math.max(1, scarcity[player.position] ?? 1)

  const target = ceiling * commitFrac * scMult * diff.aggression
  let price = Math.min(ceiling, Math.round(target))

  // Always willing to buy a needed player cheap; just won't overpay.
  const fillsNeed = claimSlot !== null
  const wantsAtAll = myDesire >= 45 || fillsNeed
  const floor = wantsAtAll ? Math.min(state.lot.openingBid, ceiling) : 0
  price = Math.max(floor, price)

  if (diff.jitter > 0) {
    const jitter = -Math.round(diff.jitter * ((hash(player.id + team) % 100) / 100))
    price = Math.max(floor, Math.min(ceiling, price + jitter))
  }

  return Math.max(0, Math.min(cap, price))
}

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

export type AIDecision = { action: "bid"; amount: number } | { action: "pass" }

/** Decide the AI's move on the current lot. */
export function decideAI(state: NflAuctionState, team: TeamId): AIDecision {
  if (!state.lot) return { action: "pass" }
  if (state.lot.highBidder === team) return { action: "pass" }

  const step = state.config.bidIncrement || 1
  const cap = maxAffordable(state.config.budgetPerPlayer, state.rosters[team])
  let next = state.lot.highBidder === null ? state.lot.currentBid : state.lot.currentBid + step
  if (next > cap) next = state.lot.highBidder === null ? state.lot.currentBid : state.lot.currentBid + 1
  if (next > cap) return { action: "pass" }

  const walkAway = walkAwayPrice(state, team)
  if (next > walkAway) return { action: "pass" }

  const diff = difficultyProfile(state.config.difficulty)
  if (diff.mistakeChance > 0 && state.lot.currentBid > state.lot.openingBid) {
    const roll = (hash(state.gameId + state.lot.player.id + team + state.lot.currentBid) % 1000) / 1000
    if (roll < diff.mistakeChance) return { action: "pass" }
  }

  return { action: "bid", amount: next }
}

// Re-export so the AI-strength test can read personalities/difficulty knobs.
export { PERSONALITIES, difficultyProfile, desirability, ownedPlayers }
