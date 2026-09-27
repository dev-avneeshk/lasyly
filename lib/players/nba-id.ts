import { NBA_IDS } from "@/lib/arena/data/nba-ids"

/**
 * Resolve an NBA player name to their official NBA person id.
 *
 * NBA prop cards have no ESPN athlete id available anywhere in our data —
 * nba_player_stats carries only the player's name, and espn_players holds zero
 * `league='nba'` rows — so the only id we can reach is the NBA person id in the
 * arena's generated map. That id is also what cdn.nba.com keys photos on, which
 * is why stored NBA headshots live under the `nbacdn` namespace.
 *
 * The map is keyed by slug, and this reproduces the generator's slug rule.
 * Imports `nba-ids.ts` (~20KB) rather than the arena's full player pool (~383KB),
 * since only the ids are needed here.
 */

/**
 * Slugify a player name the way scripts/resolve-nba-ids.ts does.
 *
 * Apostrophes and periods are REMOVED rather than turned into separators, which
 * is the part that is easy to get wrong: the map holds "deaaron-fox",
 * "tj-mcconnell", "royce-oneale" and "pj-washington", so treating `'` and `.` as
 * word boundaries yields "de-aaron-fox" and misses 21 players outright.
 * Diacritics are stripped, so "Alperen Şengün" and "Nikola Jokić" resolve.
 */
export function nbaSlugForName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** The player's NBA person id, or null if they are not in the generated map. */
export function nbaIdForName(name: string): number | null {
  if (!name) return null
  return NBA_IDS[nbaSlugForName(name)] ?? null
}
