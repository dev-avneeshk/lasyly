/**
 * Stored-headshot path conventions.
 *
 * Split out of headshot-storage.ts (which is `server-only`, because it reads the
 * bucket listing) so that client components can build the same URLs. The arena
 * and NFL auction cards render in the browser and cannot await the stored-object
 * index, so they build the deterministic URL directly and fall back to the
 * origin CDN on an image error — which only works if both sides agree on the
 * path, hence one definition rather than three.
 */

/** Must match BUCKET in scripts/db/create-headshot-bucket.mjs. */
export const HEADSHOT_BUCKET = "player-headshots"

/**
 * Stored size variants.
 *
 * `sm` (160px) is what cards use, and they are the case that matters: a props
 * page renders up to 50 avatars at 36-40 CSS px, so the difference between 4KB
 * and 9.6KB apiece is ~280KB across a full scroll. `lg` (320px) exists for
 * PlayerHero on the player detail page, which renders at 116 CSS px — one image,
 * where sharpness is worth the bytes.
 *
 * Both are written by the same backfill pass. `sm` is uploaded FIRST, so the
 * presence of the `lg` object implies `sm` also exists; that lets the stored
 * index be keyed on `lg` alone without risking a 404 on the card path.
 */
export type HeadshotVariant = "sm" | "lg"

/**
 * Namespaces inside the bucket.
 *
 * `nfl` / `nhl` are keyed by ESPN athlete id. `nbacdn` is keyed by NBA person id
 * and sourced from cdn.nba.com — a separate namespace because the two id spaces
 * are unrelated, and sharing one would let an ESPN id collide with an NBA person
 * id and serve one player another's face.
 */
export const NBA_CDN_NAMESPACE = "nbacdn"

/** Object path within the bucket for a given player + variant. */
export function headshotObjectPath(
  league: string,
  espnId: string,
  variant: HeadshotVariant = "lg"
): string {
  const lg = league.toLowerCase()
  return variant === "sm" ? `${lg}/sm/${espnId}.webp` : `${lg}/${espnId}.webp`
}

/** Public URL for a stored headshot. Bucket is public-read, so no signing. */
export function storedHeadshotUrl(
  league: string,
  espnId: string,
  variant: HeadshotVariant = "lg"
): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/${HEADSHOT_BUCKET}/${headshotObjectPath(league, espnId, variant)}`
}

/** ESPN's conventional headshot path, used when we have no stored object. */
export function espnHeadshotUrl(league: string, espnId: string): string {
  return `https://a.espncdn.com/i/headshots/${league.toLowerCase()}/players/full/${espnId}.png`
}

/** The NBA's own CDN path, used when we have no stored object. */
export function nbaCdnHeadshotUrl(nbaId: string | number): string {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaId}.png`
}
