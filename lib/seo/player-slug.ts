import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Map of URL-safe sport slugs to their display names and database identifiers.
 * Covers all 12 supported sports/leagues.
 */
export const SPORT_SLUG_MAP: Record<string, { name: string; dbSport: string }> = {
  nba: { name: "NBA", dbSport: "Basketball" },
  nfl: { name: "NFL", dbSport: "American Football" },
  nhl: { name: "NHL", dbSport: "Hockey" },
  mlb: { name: "MLB", dbSport: "Baseball" },
  "premier-league": { name: "Premier League", dbSport: "Football" },
  "champions-league": { name: "Champions League", dbSport: "Football" },
  mls: { name: "MLS", dbSport: "Football" },
  atp: { name: "ATP Tennis", dbSport: "Tennis" },
  wta: { name: "WTA Tennis", dbSport: "Tennis" },
  ufc: { name: "UFC", dbSport: "MMA" },
  f1: { name: "Formula 1", dbSport: "F1" },
  cricket: { name: "Cricket", dbSport: "Cricket" },
}

/**
 * Convert a player name to a URL-safe slug.
 * - Lowercases the name
 * - Strips diacritics (é → e, ñ → n, etc.)
 * - Replaces non-alphanumeric characters with hyphens
 * - Trims leading/trailing hyphens
 */
export function playerNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
}

/** Escape LIKE metacharacters so a slug segment can't act as a pattern. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * `ilike` patterns (without the surrounding `%`) for finding a slug's player,
 * narrowest first. Callers try each in turn and slug-match the candidates.
 *
 * - Every segment in order ("jaren%jackson%jr"). Surname alone is too loose for
 *   short or common surnames: "li", "v" and "martin" each match 500+ rows,
 *   pushing the real player past any sane limit.
 * - The same with diacritic-prone letters as `_` (the single-character
 *   wildcard). The slug strips diacritics and ilike can't see through them, so
 *   "topic" never matches "Topić", but "n_k_l_%t_p__" does.
 * - Surname alone, as a last resort.
 *
 * Slug segments are [a-z0-9] only, so the wildcard form needs no escaping.
 * Verified against every distinct name in prop_line_history (805, all resolve).
 */
export function slugSearchPatterns(slug: string): string[] {
  const segments = slug.split("-").filter(Boolean)
  if (segments.length === 0) return []
  return [
    ...new Set([
      segments.map(escapeLike).join("%"),
      segments.map((s) => s.replace(/[aeiouycnszrgl]/g, "_")).join("%"),
      escapeLike(segments[segments.length - 1]),
    ]),
  ]
}

/**
 * Resolve a player slug back to a player name by querying the database.
 * Returns the player_name if found, or null if no match exists.
 *
 * Narrowed by surname rather than scanned. The previous implementation read
 * `prop_line_history` with `.limit(1000)` and slug-matched in memory, which was
 * wrong in both directions: the table holds 49,994 rows so it only ever saw 2%
 * of them (PostgREST caps a response at 1000 and reports no error), and it
 * transferred 1000 rows to answer what is a single-row lookup. Any player whose
 * rows fell outside that arbitrary window resolved to null and 404'd.
 *
 * The last slug segment is the surname for essentially every name stored here,
 * so an `ilike` narrows the table to a handful of candidates that can then be
 * slug-matched exactly — which is also what makes diacritics work, since
 * `playerNameToSlug` strips them and SQL would not.
 */
export async function resolvePlayerSlug(slug: string): Promise<string | null> {
  const patterns = slugSearchPatterns(slug)
  if (patterns.length === 0) return null

  const supabase = createAdminClient()

  for (const pattern of patterns) {
    const { data, error } = await supabase
      .from("prop_line_history")
      .select("player_name")
      .ilike("player_name", `%${pattern}%`)
      .limit(500)

    if (error || !data) return null

    // Find a player whose name converts to the given slug
    const match = data.find(
      (row: { player_name: string }) => playerNameToSlug(row.player_name) === slug
    )
    if (match) return match.player_name
  }

  return null
}
