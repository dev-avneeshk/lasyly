/**
 * The season list, deliberately split out from `lib/arena/data/index.ts`.
 *
 * WHY IT LIVES ON ITS OWN
 * -----------------------
 * `lib/arena/data/index.ts` derives `AVAILABLE_SEASONS` from the keys of a
 * registry whose values are the actual player pools. `players-2025-26.ts` is
 * ~439 KB of source and compiles to a 383 KB client chunk. Importing
 * `AVAILABLE_SEASONS` from the barrel to render a season picker therefore
 * dragged the whole league into the bundle — measured on `/arena/nba`, where the
 * *setup screen* (five rows of option cards) shipped every player's ratings
 * before the user had chosen anything.
 *
 * Keeping the names here lets UI that only needs to *label* seasons stay cheap,
 * while the engine keeps importing the pools it genuinely needs.
 *
 * Adding a season is still a one-line change in each place; `lib/arena/data`
 * asserts at module load that the two lists agree, so they cannot drift.
 */
import type { Season } from "./types"

/** Seasons with a registered player pool, newest first. */
export const AVAILABLE_SEASONS: Season[] = ["2025-26"]

export const DEFAULT_SEASON: Season = "2025-26"
