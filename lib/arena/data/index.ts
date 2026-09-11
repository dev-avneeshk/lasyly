/**
 * Season → player-pool registry.
 *
 * The engine only ever talks to `getSeasonPlayers(season)`. Adding a future
 * season is a pure data change: create `players-<season>.ts` and register it
 * below. Nothing in the engine needs to change.
 */

import type { Season, SeasonPlayer } from "../types"
import { PLAYERS_2025_26 } from "./players-2025-26"

const REGISTRY: Record<string, SeasonPlayer[]> = {
  "2025-26": PLAYERS_2025_26,
}

export const AVAILABLE_SEASONS = Object.keys(REGISTRY) as Season[]

export const DEFAULT_SEASON: Season = "2025-26"

/** Returns the player pool for a season, falling back to the default season. */
export function getSeasonPlayers(season: Season): SeasonPlayer[] {
  return REGISTRY[season] ?? REGISTRY[DEFAULT_SEASON]
}

/** Look up a single player by id within a season. */
export function findPlayer(season: Season, id: string): SeasonPlayer | undefined {
  return getSeasonPlayers(season).find((p) => p.id === id)
}

/**
 * Public NBA CDN headshot for a player, or null if we don't have their id.
 * These are stable, cache-friendly URLs; the UI falls back to initials on error.
 */
export function headshotUrl(player: SeasonPlayer): string | null {
  if (!player.nbaId) return null
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.nbaId}.png`
}
