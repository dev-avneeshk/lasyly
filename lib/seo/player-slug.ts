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

/**
 * Resolve a player slug back to a player name by querying the database.
 * Returns the player_name if found, or null if no match exists.
 */
export async function resolvePlayerSlug(slug: string): Promise<string | null> {
  const supabase = createAdminClient()

  // Query prop_line_history for distinct player names and check if any match the slug
  const { data, error } = await supabase
    .from("prop_line_history")
    .select("player_name")
    .limit(1000)

  if (error || !data) {
    return null
  }

  // Find a player whose name converts to the given slug
  const match = data.find(
    (row: { player_name: string }) => playerNameToSlug(row.player_name) === slug
  )

  return match ? match.player_name : null
}
