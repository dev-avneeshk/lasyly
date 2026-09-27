/**
 * Season → player-pool registry.
 *
 * The engine only ever talks to `getSeasonPlayers(season)`. Adding a future
 * season is a pure data change: create `players-<season>.ts` and register it
 * below. Nothing in the engine needs to change.
 */

import type { Season, NflPlayer } from "../types"
import { espnHeadshotUrl, storedHeadshotUrl } from "@/lib/data/headshot-paths"
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
 * Headshot for a player, preferring the copy we host ourselves.
 *
 * Same reasoning as the NBA arena: ESPN serves the full-resolution press
 * original (~225KB PNG) for a card rendered at card size, and all 3,479 NFL
 * headshots are already in our bucket as ~15KB WebP. Returns both so the client
 * component can try the stored path and drop back to ESPN via `onError` — it
 * cannot await the stored-object index in the browser.
 */
export function headshotSources(player: NflPlayer): { stored: string | null; origin: string } | null {
  if (!player.espnId) return null
  return {
    stored: storedHeadshotUrl("nfl", String(player.espnId), "sm"),
    origin: espnHeadshotUrl("nfl", String(player.espnId)),
  }
}

/**
 * Origin-CDN headshot URL, or null if we don't have the player's id.
 *
 * Kept for callers that just want a single URL. Prefer `headshotSources` so the
 * stored copy is used.
 */
export function headshotUrl(player: NflPlayer): string | null {
  if (!player.espnId) return null
  return espnHeadshotUrl("nfl", String(player.espnId))
}
