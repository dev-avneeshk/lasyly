/**
 * Season → player-pool registry.
 *
 * The engine only ever talks to `getSeasonPlayers(season)`. Adding a future
 * season is a pure data change: create `players-<season>.ts` and register it
 * below. Nothing in the engine needs to change.
 */

import type { Season, NflPlayer } from "../types"
import { PLAYERS_2025 } from "./players-2025"

const REGISTRY: Record<string, NflPlayer[]> = {
  "2025": PLAYERS_2025,
}

export const AVAILABLE_SEASONS = Object.keys(REGISTRY) as Season[]

export const DEFAULT_SEASON: Season = "2025"

/** Returns the player pool for a season, falling back to the default season. */
export function getSeasonPlayers(season: Season): NflPlayer[] {
  return REGISTRY[season] ?? REGISTRY[DEFAULT_SEASON]
}

/** Look up a single player by id within a season. */
export function findPlayer(season: Season, id: string): NflPlayer | undefined {
  return getSeasonPlayers(season).find((p) => p.id === id)
}

/**
 * Public ESPN CDN headshot for a player, or null if we don't have their id.
 * The UI falls back to initials on error.
 */
export function headshotUrl(player: NflPlayer): string | null {
  if (!player.espnId) return null
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espnId}.png`
}
