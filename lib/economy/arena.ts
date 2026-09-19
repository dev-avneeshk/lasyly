/**
 * Arena coin economy — the single source of truth for every number in the
 * games economy (entry costs, rewards, 1v1 stakes, XP, levels, weekly bonuses).
 *
 * Everything here is a PURE function of its inputs so it can be unit-tested in
 * isolation and shared by both the API routes and the client UI. The database
 * mirrors the same constants inside the SECURITY DEFINER money RPCs (see
 * supabase/migrations/*_arena_economy.sql) — the DB is authoritative for the
 * actual balance mutation, this module is authoritative for the math. Keep the
 * two in sync; the numbers are duplicated deliberately (SQL can't import TS).
 *
 * Coins are Lasyly's in-app currency. They are NOT money and not withdrawable.
 */

import type { AIDifficulty } from "@/lib/arena/types"

// ─── Signup bonus ─────────────────────────────────────────────────────────────

/** One-time starter allotment credited on first sign-in. */
export const SIGNUP_BONUS = 200

// ─── Arena vs CPU: entry cost + difficulty-scaled reward ────────────────────────

/** Flat coin cost to start a game against the CPU, charged up front. */
export const CPU_ENTRY_COST = 50

/**
 * Win reward multiplier applied to the entry cost. Harder CPU pays out more
 * because it's a harder win. A loss forfeits the entry cost (multiplier 0).
 *
 *   easy   → 1.5×  (win 75, net +25)
 *   medium → 2.0×  (win 100, net +50)
 *   hard   → 3.0×  (win 150, net +100)
 */
export const CPU_WIN_MULTIPLIER: Record<AIDifficulty, number> = {
  easy: 1.5,
  medium: 2,
  hard: 3,
}

/**
 * Coins paid to the human when they beat the CPU. Losing pays 0 (the entry
 * cost is already gone). Rounded to a whole coin.
 */
export function cpuWinReward(difficulty: AIDifficulty): number {
  return Math.round(CPU_ENTRY_COST * CPU_WIN_MULTIPLIER[difficulty])
}

// ─── 1v1 human staking: winner-take-all minus commission ────────────────────────

/** Smallest stake a player may wager in a 1v1. */
export const MIN_STAKE = 5

/**
 * House commission on a 1v1, as a fraction of the amount WON (i.e. one stake,
 * the opponent's contribution — not the whole pot). This matches the product
 * spec: stake 100 → win 190, with 10 coins (10% of the 100 won) taken as
 * commission. The winner always gets their own stake back in full.
 */
export const COMMISSION_RATE = 0.1

/**
 * Is a proposed 1v1 stake valid? Must be a whole number ≥ MIN_STAKE and no
 * greater than the player's balance.
 */
export function isValidStake(stake: number, balance: number): boolean {
  return (
    Number.isInteger(stake) &&
    stake >= MIN_STAKE &&
    stake <= balance
  )
}

/**
 * The winner's total payout for a 1v1 where BOTH players staked `stake` coins.
 * The winner gets their own stake back plus the opponent's stake minus the
 * house commission (taken from the winnings):
 *
 *   payout = stake + stake*(1 - COMMISSION_RATE)
 *          = stake * (2 - COMMISSION_RATE)
 *
 *   stake 100 → 100 (own) + 90 (won, net of 10 commission) = 190 (net +90)
 */
export function stakePayout(stake: number): number {
  return Math.round(stake * (2 - COMMISSION_RATE))
}

/** The house's cut of a 1v1 (for ledger/audit display): 10% of one stake. */
export function stakeCommission(stake: number): number {
  return stake * 2 - stakePayout(stake)
}

// ─── XP + Levels ────────────────────────────────────────────────────────────────

/** XP granted for the various game outcomes. Winning is worth more than losing. */
export const XP_REWARDS = {
  /** Completing a game at all (win or lose). */
  play: 10,
  /** Extra XP on top of `play` for beating the CPU. */
  cpuWin: 15,
  /** Extra XP on top of `play` for winning a 1v1 against a human. */
  pvpWin: 30,
} as const

/**
 * Cumulative XP required to REACH a given level (level 1 = 0 XP).
 *
 * Uses a classic triangular curve so each level costs progressively more:
 *   xpToReach(n) = 100 * (n-1) * n / 2
 *
 *   L1 → 0, L2 → 100, L3 → 300, L4 → 600, L5 → 1000, L6 → 1500 …
 */
export function xpToReachLevel(level: number): number {
  const n = Math.max(1, Math.floor(level))
  return (100 * (n - 1) * n) / 2
}

/** The level a given total XP corresponds to (level 1 is the floor). */
export function levelForXp(totalXp: number): number {
  const xp = Math.max(0, totalXp)
  let level = 1
  while (xpToReachLevel(level + 1) <= xp) {
    level++
  }
  return level
}

/**
 * Progress toward the next level, for a progress bar.
 * Returns current level, XP into the current level, and XP the level spans.
 */
export function levelProgress(totalXp: number): {
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
} {
  const level = levelForXp(totalXp)
  const floor = xpToReachLevel(level)
  const ceil = xpToReachLevel(level + 1)
  return {
    level,
    xpIntoLevel: Math.max(0, totalXp) - floor,
    xpForNextLevel: ceil - floor,
  }
}

// ─── Weekly level-based payout ──────────────────────────────────────────────────

/**
 * Weekly coin grant for a player at a given level. Higher level → bigger grant,
 * so progression keeps paying off:
 *
 *   weeklyLevelBonus(level) = 100 + level * 50
 *
 *   L1 → 150, L2 → 200, L5 → 350, L10 → 600 …
 */
export function weeklyLevelBonus(level: number): number {
  const n = Math.max(1, Math.floor(level))
  return 100 + n * 50
}

/**
 * ISO week key ("2026-W38") used to make the weekly grant idempotent — one
 * grant per user per ISO week, ever.
 */
export function isoWeekKey(date: Date = new Date()): string {
  // Copy so we don't mutate the caller's date; work in UTC.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // ISO 8601: week day Mon=1..Sun=7; Thursday determines the week's year.
  const dayNum = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}
