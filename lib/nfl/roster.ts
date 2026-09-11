/**
 * RosterManager — tracks the 9 NFL slots (5 offense + 4 defense), positional
 * eligibility, and legal roster completion.
 *
 * Anti-cheese: a player can only occupy a slot whose required position matches
 * the player's position. WR1 and WR2 both require a WR, so two receivers can
 * coexist; every other slot is 1:1.
 */

import {
  type NflPlayer,
  type OwnedPlayer,
  type RosterSlot,
  type RosterState,
  ROSTER_SLOTS,
  SLOT_POSITION,
} from "./types"

export function emptyRoster(): RosterState {
  return {
    slots: {
      QB: null,
      RB: null,
      WR1: null,
      WR2: null,
      TE: null,
      EDGE: null,
      LB: null,
      CB: null,
      S: null,
    },
  }
}

/** Every slot this player is eligible to fill (position match). */
export function eligibleSlots(player: NflPlayer): RosterSlot[] {
  return ROSTER_SLOTS.filter((slot) => SLOT_POSITION[slot] === player.position)
}

/** Can this player fill this specific slot? */
export function canFillSlot(player: NflPlayer, slot: RosterSlot): boolean {
  return SLOT_POSITION[slot] === player.position
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

export function ownsPlayer(roster: RosterState, playerId: string): boolean {
  return ROSTER_SLOTS.some((s) => roster.slots[s]?.player.id === playerId)
}

/**
 * Choose the best legal open slot for a newly-won player. For WRs this prefers
 * WR1 then WR2. Returns null if there's no legal opening (position full).
 */
export function bestSlotFor(roster: RosterState, player: NflPlayer): RosterSlot | null {
  for (const slot of eligibleSlots(player)) {
    if (roster.slots[slot] === null) return slot
  }
  return null
}

/** Returns a NEW roster with the player placed, or throws on an illegal add. */
export function placePlayer(
  roster: RosterState,
  player: NflPlayer,
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
    throw new Error(`${player.name} (${player.position}) cannot play ${slot}.`)
  }

  const owned: OwnedPlayer = { player, price, slot }
  return { slots: { ...roster.slots, [slot]: owned } }
}

/** Whether adding `player` is possible given open slots. Gates bidding. */
export function canAddPlayer(roster: RosterState, player: NflPlayer): boolean {
  if (ownsPlayer(roster, player.id)) return false
  return bestSlotFor(roster, player) !== null
}

/**
 * Whether the roster can still be LEGALLY COMPLETED if this player is added.
 * Checks that every remaining open slot could still be filled by some eligible
 * player from `remainingPool` (avoid painting yourself into a corner — e.g.
 * taking the last WR slot when you still need a QB and none remain).
 */
export function completionFeasible(
  roster: RosterState,
  player: NflPlayer,
  slot: RosterSlot,
  remainingPool: NflPlayer[]
): boolean {
  const after = placePlayer(roster, player, 0, slot)
  const needed = openSlots(after)
  if (needed.length === 0) return true

  // Greedy bipartite feasibility: each needed slot needs a distinct eligible
  // player left in the pool.
  const pool = remainingPool.filter((p) => p.id !== player.id)
  const used = new Set<string>()
  for (const s of needed) {
    const wantPos = SLOT_POSITION[s]
    const candidate = pool.find((p) => !used.has(p.id) && p.position === wantPos)
    if (!candidate) return false
    used.add(candidate.id)
  }
  return true
}

/** All owned players in slot order (offense then defense). */
export function orderedRoster(roster: RosterState): OwnedPlayer[] {
  return ROSTER_SLOTS.map((s) => roster.slots[s]).filter(
    (x): x is OwnedPlayer => x !== null
  )
}

export function ownedPlayers(roster: RosterState): NflPlayer[] {
  return orderedRoster(roster).map((o) => o.player)
}

/** The player currently filling a slot, or null. */
export function playerInSlot(roster: RosterState, slot: RosterSlot): NflPlayer | null {
  return roster.slots[slot]?.player ?? null
}
