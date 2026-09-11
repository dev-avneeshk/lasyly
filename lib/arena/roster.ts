/**
 * RosterManager — tracks the 5 starters (one per position) + 1 flexible bench
 * slot, positional eligibility, and legal roster completion.
 *
 * Anti-cheese: a player can only occupy a slot they're eligible for (primary or
 * secondary position); the bench accepts anyone. This prevents "five point
 * guards masquerading as a lineup" while still allowing flexible bigs (Jokic at
 * C or PF, Giannis at PF/C/SF, etc.).
 */

import {
  type OwnedPlayer,
  type Position,
  type RosterSlot,
  type RosterState,
  type SeasonPlayer,
  ROSTER_SLOTS,
  POSITIONS,
} from "./types"

export function emptyRoster(): RosterState {
  return {
    slots: {
      PG: null,
      SG: null,
      SF: null,
      PF: null,
      C: null,
      BENCH: null,
    },
  }
}

/** All positions a player can legally play. */
export function eligiblePositions(player: SeasonPlayer): Position[] {
  return [player.primaryPosition, ...player.secondaryPositions]
}

/** Can this player fill this slot? Bench accepts anyone. */
export function canFillSlot(player: SeasonPlayer, slot: RosterSlot): boolean {
  if (slot === "BENCH") return true
  return eligiblePositions(player).includes(slot)
}

export function rosterCount(roster: RosterState): number {
  return ROSTER_SLOTS.filter((s) => roster.slots[s] !== null).length
}

export function isRosterComplete(roster: RosterState): boolean {
  return ROSTER_SLOTS.every((s) => roster.slots[s] !== null)
}

/** Slots still empty. */
export function openSlots(roster: RosterState): RosterSlot[] {
  return ROSTER_SLOTS.filter((s) => roster.slots[s] === null)
}

/** Positional slots (excludes bench) that are still empty. */
export function openStarterSlots(roster: RosterState): Position[] {
  return POSITIONS.filter((p) => roster.slots[p] === null)
}

export function ownsPlayer(roster: RosterState, playerId: string): boolean {
  return ROSTER_SLOTS.some((s) => roster.slots[s]?.player.id === playerId)
}

/**
 * Choose the best legal slot for a newly-won player, preferring an open starter
 * slot they're eligible for, then bench. Returns null if there's genuinely no
 * legal slot (roster full or no eligible opening).
 *
 * Preference order among eligible open starter slots: the *scarcer* the player's
 * eligibility, the earlier we lock it in — but at assignment time we simply take
 * the first open eligible starter slot (positions are pre-ordered PG→C). This is
 * deterministic and predictable.
 */
export function bestSlotFor(
  roster: RosterState,
  player: SeasonPlayer
): RosterSlot | null {
  // Prefer a starter slot the player is eligible for.
  for (const pos of eligiblePositions(player)) {
    if (roster.slots[pos] === null) return pos
  }
  // Fall back to bench.
  if (roster.slots.BENCH === null) return "BENCH"
  return null
}

/**
 * The slot this player may take UNDER AUCTION RULES.
 *
 * Starters before bench: you cannot spend your single bench slot while any of
 * your five starting positions is still empty. Without this rule a team could
 * blow real money on a luxury bench piece early and then be stranded needing two
 * starters on a near-empty board (and get silently auto-filled with $1 scrubs).
 * It also stops a team whose starters are set from using its flexible bench slot
 * to hoover up the last eligible player at a position the opponent still needs.
 */
export function auctionSlotFor(
  roster: RosterState,
  player: SeasonPlayer
): RosterSlot | null {
  for (const pos of eligiblePositions(player)) {
    if (roster.slots[pos] === null) return pos
  }
  // No open starter slot fits this player — bench is only legal once the five
  // starting spots are all accounted for.
  if (openStarterSlots(roster).length > 0) return null
  return roster.slots.BENCH === null ? "BENCH" : null
}

/** Returns a NEW roster with the player placed, or throws on an illegal add. */
export function placePlayer(
  roster: RosterState,
  player: SeasonPlayer,
  price: number,
  forcedSlot?: RosterSlot
): RosterState {
  if (ownsPlayer(roster, player.id)) {
    throw new Error(`Duplicate player: ${player.name} is already on this roster.`)
  }

  const slot = forcedSlot ?? bestSlotFor(roster, player)
  if (slot === null) {
    throw new Error(`No legal roster slot available for ${player.name}.`)
  }
  if (roster.slots[slot] !== null) {
    throw new Error(`Slot ${slot} is already filled.`)
  }
  if (!canFillSlot(player, slot)) {
    throw new Error(`${player.name} cannot play ${slot}.`)
  }

  const owned: OwnedPlayer = { player, price, slot }
  return {
    slots: { ...roster.slots, [slot]: owned },
  }
}

/**
 * Whether adding `player` is even *possible* given open slots. Used to gate
 * bidding: never let someone win a player they can't legally roster.
 */
export function canAddPlayer(roster: RosterState, player: SeasonPlayer): boolean {
  if (ownsPlayer(roster, player.id)) return false
  return auctionSlotFor(roster, player) !== null
}

/**
 * Permissive variant for the end-of-auction emergency auto-fill, which must be
 * able to place ANY legal player (including into the bench) to guarantee the
 * game always reaches a complete, playable roster.
 */
export function canForceAddPlayer(roster: RosterState, player: SeasonPlayer): boolean {
  if (ownsPlayer(roster, player.id)) return false
  return bestSlotFor(roster, player) !== null
}

/**
 * Whether the roster can still be *legally completed* if this player is added.
 * Checks that every remaining open starter slot could still be filled by some
 * eligible player from `remainingPool` (a feasibility check to avoid painting
 * yourself into a corner, e.g. taking a C into the last PF slot when you still
 * need a real C and none remain).
 *
 * This is a soft check surfaced as a WARNING in the UI, not a hard block —
 * except when it makes completion provably impossible.
 */
export function completionFeasible(
  roster: RosterState,
  player: SeasonPlayer,
  slot: RosterSlot,
  remainingPool: SeasonPlayer[]
): boolean {
  // Simulate the placement.
  const after = placePlayer(roster, player, 0, slot)
  const needed = openStarterSlots(after)
  if (needed.length === 0) return true

  // Bipartite feasibility (Hall's condition, greedy). For each needed position,
  // is there at least one distinct eligible player left in the pool?
  const pool = remainingPool.filter((p) => p.id !== player.id)
  const used = new Set<string>()
  for (const pos of needed) {
    const candidate = pool.find(
      (p) => !used.has(p.id) && eligiblePositions(p).includes(pos)
    )
    if (!candidate) return false
    used.add(candidate.id)
  }
  return true
}

/** Starters in position order, then bench. Handy for lineup display / sim. */
export function orderedRoster(roster: RosterState): OwnedPlayer[] {
  return ROSTER_SLOTS.map((s) => roster.slots[s]).filter(
    (x): x is OwnedPlayer => x !== null
  )
}

export function starters(roster: RosterState): OwnedPlayer[] {
  return POSITIONS.map((p) => roster.slots[p]).filter(
    (x): x is OwnedPlayer => x !== null
  )
}

export function bench(roster: RosterState): OwnedPlayer | null {
  return roster.slots.BENCH
}
