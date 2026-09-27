/**
 * Season → player-pool registry.
 *
 * The engine only ever talks to `getSeasonPlayers(season)`. Adding a future
 * season is a pure data change: create `players-<season>.ts` and register it
 * below. Nothing in the engine needs to change.
 */

import type { Season, SeasonPlayer } from "../types"
import { AVAILABLE_SEASONS, DEFAULT_SEASON } from "../seasons"
import {
  NBA_CDN_NAMESPACE,
  nbaCdnHeadshotUrl,
  storedHeadshotUrl,
} from "@/lib/data/headshot-paths"
import { PLAYERS_2025_26 } from "./players-2025-26"

const REGISTRY: Record<string, SeasonPlayer[]> = {
  "2025-26": PLAYERS_2025_26,
}

// The season *names* live in ../seasons.ts so that UI which only needs to label
// a season doesn't have to import the ~383 KB player pool below (see the header
// comment there). This assertion is what stops the two lists drifting: register a
// pool without naming it — or name one without registering it — and the arena
// fails loudly at module load instead of silently offering a season with no
// players.
const registered = Object.keys(REGISTRY).sort().join(",")
const named = [...AVAILABLE_SEASONS].sort().join(",")
if (registered !== named) {
  throw new Error(
    `Arena season registry mismatch: lib/arena/data has [${registered}] but lib/arena/seasons.ts names [${named}]. Update both.`
  )
}

export { AVAILABLE_SEASONS, DEFAULT_SEASON }

/** Returns the player pool for a season, falling back to the default season. */
export function getSeasonPlayers(season: Season): SeasonPlayer[] {
  return REGISTRY[season] ?? REGISTRY[DEFAULT_SEASON]
}

/** Look up a single player by id within a season. */
export function findPlayer(season: Season, id: string): SeasonPlayer | undefined {
  return getSeasonPlayers(season).find((p) => p.id === id)
}

/**
 * Headshot for a player, preferring the copy we host ourselves.
 *
 * The arena used to hot-link `cdn.nba.com` directly, which serves a 1040x760 PNG
 * (~200KB) for a card that renders at 160 CSS px. All 573 players in the pool who
 * have an id are now stored in our own bucket as ~16KB WebP, so this returns that
 * and the caller falls back to the CDN only if the object is missing.
 *
 * Returns both URLs rather than one because this runs in the browser: client
 * components cannot await the stored-object index, so they try the deterministic
 * stored path first and use `onError` to drop back to the origin. `null` id means
 * there is no photo anywhere and the UI shows initials.
 */
export function headshotSources(player: SeasonPlayer): { stored: string | null; origin: string } | null {
  if (!player.nbaId) return null
  return {
    stored: storedHeadshotUrl(NBA_CDN_NAMESPACE, String(player.nbaId), "sm"),
    origin: nbaCdnHeadshotUrl(player.nbaId),
  }
}

/**
 * Origin-CDN headshot URL, or null if we don't have the player's id.
 *
 * Kept for callers that just want a single URL. Prefer `headshotSources` so the
 * stored copy is used.
 */
export function headshotUrl(player: SeasonPlayer): string | null {
  if (!player.nbaId) return null
  return nbaCdnHeadshotUrl(player.nbaId)
}
