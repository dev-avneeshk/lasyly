import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"

/**
 * Self-hosted player headshots.
 *
 * Player photos used to be hot-linked to ESPN's CDN. ESPN serves the
 * full-resolution press original (~225KB PNG) and the props page renders it into
 * a 36px circle, so a single page pulled ~5.9MB of images from a third party to
 * draw 25 small avatars.
 *
 * `scripts/db/sync-headshots.mjs` now downloads each photo once, scales it to fit
 * a 320px box, re-encodes as WebP (~10KB) and uploads it to the
 * `player-headshots` bucket. This module resolves which players have a stored
 * object and builds their public URL.
 *
 * WHY THE BUCKET IS THE SOURCE OF TRUTH
 * The object path is deterministic — `{league}/{espn_id}.webp` — so "is this
 * synced?" is answered by listing the bucket rather than by a column on
 * espn_players. That needs no schema change and, more importantly, cannot drift:
 * delete an object and the app stops referencing it on the next cache cycle,
 * whereas a stale column would keep pointing at a 404.
 */

// Path conventions live in headshot-paths.ts, which carries no `server-only`
// marker so that client components can build the same URLs. Re-exported here so
// existing server-side importers keep working unchanged.
import {
  HEADSHOT_BUCKET,
  espnHeadshotUrl,
  storedHeadshotUrl,
  type HeadshotVariant,
} from "./headshot-paths"

export {
  HEADSHOT_BUCKET,
  NBA_CDN_NAMESPACE,
  espnHeadshotUrl,
  headshotObjectPath,
  nbaCdnHeadshotUrl,
  storedHeadshotUrl,
  type HeadshotVariant,
} from "./headshot-paths"

/**
 * How long to hold the stored-object index.
 *
 * One hour, NOT a day. A day was the original choice on the reasoning that
 * rosters change slowly, and it backfired immediately: production cached this
 * index while the backfill was still uploading, captured a partial bucket, and
 * then served the ESPN fallback for 8 players who were in fact already stored —
 * for a full 24 hours, with no way to correct it short of a redeploy.
 *
 * The index is three cheap list calls, so holding it for an hour costs almost
 * nothing and bounds that window to something survivable. The failure is still
 * self-correcting in both directions; the point is how long "still wrong" lasts.
 */
const STORED_INDEX_TTL_MS = 60 * 60_000

/** Storage list() caps per call; page until exhausted. */
const LIST_PAGE_SIZE = 1000

/**
 * Hard ceiling on pages, so a pathological bucket cannot spin forever.
 * 20 pages x 1000 is far above the ~3.9k objects we actually store.
 */
const MAX_LIST_PAGES = 20

/**
 * The set of `espn_id`s that have a stored headshot for this league.
 *
 * Returns an ARRAY from the cached fetcher on purpose. This value round-trips
 * through Redis as JSON, and `JSON.stringify(new Set())` is `"{}"` — caching a
 * Set directly would read back as an empty object whose `.has()` throws, which
 * is exactly the bug the NFL defense table hit before it was switched to plain
 * records. Callers get a Set built on this side of the cache boundary.
 */
async function fetchStoredIds(league: string): Promise<string[]> {
  const lg = league.toLowerCase()

  return cached(
    // v2 retires index entries captured mid-backfill, which held a partial
    // bucket listing and pinned already-stored players to the ESPN fallback.
    `headshots-stored:v2:${lg}`,
    async () => {
      const supabase = createAdminClient()
      const ids: string[] = []

      for (let page = 0; page < MAX_LIST_PAGES; page++) {
        const { data, error } = await supabase.storage.from(HEADSHOT_BUCKET).list(lg, {
          limit: LIST_PAGE_SIZE,
          offset: page * LIST_PAGE_SIZE,
        })

        if (error) {
          console.error(`[headshot-storage] list failed for "${lg}":`, error.message)
          break
        }
        if (!data || data.length === 0) break

        for (const obj of data) {
          if (obj.name?.endsWith(".webp")) ids.push(obj.name.slice(0, -".webp".length))
        }
        if (data.length < LIST_PAGE_SIZE) break
      }

      return ids
    },
    STORED_INDEX_TTL_MS
  )
}

/**
 * Stored-headshot lookup for a league. `has(espnId)` is true when we serve that
 * player's photo ourselves.
 *
 * Never throws: headshots are cosmetic and must not be able to fail a props
 * response. A failure degrades to "nothing is stored", i.e. the ESPN fallback.
 */
export async function getStoredHeadshotIds(league: string): Promise<Set<string>> {
  try {
    return new Set(await fetchStoredIds(league))
  } catch {
    return new Set()
  }
}

/**
 * Best available headshot URL for one player, preferring our own copy.
 *
 * Order: stored WebP -> whatever ESPN URL the row already carried -> a URL
 * synthesised from espn_id. That last step is not a formality: `headshot_url` is
 * null on a slice of rows where `espn_id` is always present, and those nulls were
 * why half the prop cards arrived without a photo and each fired its own
 * `/api/players/headshot` request on mount.
 */
export function resolveHeadshotUrl(
  league: string,
  espnId: string | null | undefined,
  rowHeadshotUrl: string | null | undefined,
  storedIds: Set<string>,
  variant: HeadshotVariant = "sm"
): string | null {
  if (espnId && storedIds.has(espnId)) {
    const url = storedHeadshotUrl(league, espnId, variant)
    if (url) return url
  }
  if (rowHeadshotUrl) return rowHeadshotUrl
  if (espnId) return espnHeadshotUrl(league, espnId)
  return null
}
