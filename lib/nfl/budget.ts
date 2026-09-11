/**
 * BudgetManager — pure budget math and the single most important safety rule of
 * the auction:
 *
 *   A player can NEVER bid more than they can afford while still being able to
 *   legally fill every remaining roster slot.
 *
 * With $10 and 4 slots to fill (each needing ≥ $1), the most you can commit to
 * the current player is $10 − (3 × $1) = $7. We reserve $1 × openSlotsAfterThis
 * so the roster can always be completed.
 */

import type { RosterState } from "./types"
import { openSlots } from "./roster"

/** Minimum price any player can be won for. Keeps at least $1 per slot. */
export const MIN_BID = 1

export interface BudgetSnapshot {
  total: number
  spent: number
  remaining: number
  slotsFilled: number
  slotsRemaining: number
  maxAffordable: number
}

function totalSpent(roster: RosterState): number {
  return Object.values(roster.slots).reduce((sum, owned) => sum + (owned?.price ?? 0), 0)
}

export function spent(roster: RosterState): number {
  return totalSpent(roster)
}

export function remaining(total: number, roster: RosterState): number {
  return total - totalSpent(roster)
}

/**
 * Maximum legal bid on the CURRENT lot. Reserve MIN_BID for every OTHER open
 * slot. If the roster is already full, max is 0.
 */
export function maxAffordable(total: number, roster: RosterState): number {
  const open = openSlots(roster).length
  if (open === 0) return 0
  const rem = remaining(total, roster)
  const reserve = (open - 1) * MIN_BID
  return Math.max(0, rem - reserve)
}

export function snapshot(total: number, roster: RosterState): BudgetSnapshot {
  const filled = Object.values(roster.slots).filter((x) => x !== null).length
  const open = openSlots(roster).length
  return {
    total,
    spent: totalSpent(roster),
    remaining: remaining(total, roster),
    slotsFilled: filled,
    slotsRemaining: open,
    maxAffordable: maxAffordable(total, roster),
  }
}

/**
 * Validate a proposed bid amount against budget + roster. Returns an error
 * string, or null if the bid is legal.
 */
export function validateBidAmount(
  amount: number,
  currentBid: number,
  total: number,
  roster: RosterState,
  /** When claiming an unclaimed lot, a bid EQUAL to the opening price is legal. */
  allowEqual = false
): string | null {
  if (!Number.isInteger(amount)) return "Bids must be whole dollars."
  if (amount < MIN_BID) return `Minimum bid is $${MIN_BID}.`
  if (allowEqual ? amount < currentBid : amount <= currentBid) {
    return `Bid must be at least $${allowEqual ? currentBid : currentBid + 1}.`
  }
  const max = maxAffordable(total, roster)
  if (amount > max) {
    return `You can only bid up to $${max} — you must keep $1 for each remaining slot.`
  }
  return null
}
