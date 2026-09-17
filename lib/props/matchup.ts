/**
 * Resolves the opponent shown on a prop card.
 *
 * The engines are inconsistent here: NBA sets `upcomingOpponent`, while the NFL
 * engine leaves it null and puts a full `HOME-AWAY` key in `matchup` (e.g.
 * "TB-CLE"). Rendering `matchup` directly produces "TB @ TB-CLE", so the key has
 * to be split against the player's own team first.
 */

import { EnhancedPropCardData } from "@/lib/analytics/types"

/** `HOME-AWAY` team abbreviations, e.g. "LAL-GSW" or "TB-CLE". */
const MATCHUP_KEY = /^([A-Za-z]{2,4})-([A-Za-z]{2,4})$/

export interface ResolvedMatchup {
  /** Opponent abbreviation or name, null when unknown. */
  opponent: string | null
  /** "vs" when the player's team is at home, "@" when away, null when unknown. */
  prefix: "vs" | "@" | null
}

export function resolveMatchup(prop: EnhancedPropCardData): ResolvedMatchup {
  const team = (prop.team ?? "").toUpperCase()
  const venuePrefix = prop.venue === "home" ? "vs" : prop.venue === "away" ? "@" : null

  if (prop.upcomingOpponent) {
    return { opponent: prop.upcomingOpponent, prefix: venuePrefix ?? "vs" }
  }

  const key = prop.matchup?.trim() ?? ""
  const parts = key.match(MATCHUP_KEY)
  if (parts) {
    const [, home, away] = parts
    if (home.toUpperCase() === team) return { opponent: away.toUpperCase(), prefix: "vs" }
    if (away.toUpperCase() === team) return { opponent: home.toUpperCase(), prefix: "@" }
    // Team didn't match either side — show the other-looking side without
    // claiming a venue we can't determine.
    return { opponent: away.toUpperCase(), prefix: null }
  }

  if (key) return { opponent: key, prefix: venuePrefix ?? "vs" }
  return { opponent: null, prefix: null }
}
