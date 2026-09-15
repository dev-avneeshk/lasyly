/**
 * Manual audit overrides for the generated NFL pool.
 *
 * `players-2025.ts` is generated from real stats (scripts/generate-nfl-players.ts
 * + ./derive-attributes.ts). This file captures hand-reviewed corrections so they
 * SURVIVE a regeneration — the generator applies them as its final step and
 * recomputes tier + startingBid from any overridden `overall`.
 *
 * Add an entry keyed by the player's slug id. Set `overall` to force a new
 * overall, and/or `attr` to force specific attributes. Unspecified values keep
 * their stat-derived value. Sibling of lib/arena/data/overrides.ts.
 */

import type { PlayerAttributes } from "../types"

export interface PlayerOverride {
  overall?: number
  attr?: Partial<Record<keyof PlayerAttributes, number>>
  note?: string
}

/** id → override. Start empty; add corrections as the eye test surfaces them. */
export const PLAYER_OVERRIDES: Record<string, PlayerOverride> = {}
