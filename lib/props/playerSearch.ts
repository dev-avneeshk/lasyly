/**
 * Free-text player matching shared by the props API and the prop engines.
 *
 * The player detail page (/analysis/<slug>) only has the URL slug, built by
 * playerSlug() in components/analysis/playerHref.ts: lowercase, and every run of
 * characters outside [a-z0-9] becomes "-". The page searches with the slug's
 * dashes turned into spaces, so "Shai Gilgeous-Alexander" arrives as
 * "shai gilgeous alexander", "De'Andre Hunter" as "de andre hunter", "Gary
 * Trent Jr." as "gary trent jr " and "Kasparas Jakučionis" as "kasparas jaku
 * ionis". A plain substring match against the stored name missed every one of
 * those, so clicking any such player showed "No data available for this player".
 */

/** Lowercase, accents folded (č → c), every other non-alphanumeric run → one space. */
export function foldPlayerText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** The words of a playerSlug() URL slug: accented letters are dropped, not folded. */
function slugWords(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

/**
 * True when `search` matches `name`, whether it was typed ("jokic",
 * "o'neale", "caldwell-pope") or derived from a detail-page URL slug.
 */
export function playerNameMatches(name: string, search: string): boolean {
  if (name.toLowerCase().includes(search.toLowerCase())) return true
  const q = foldPlayerText(search)
  if (!q) return false
  return foldPlayerText(name).includes(q) || slugWords(name).includes(q)
}
