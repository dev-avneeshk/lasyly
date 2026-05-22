/**
 * Advanced filter logic for enhanced prop cards.
 * All filters are applied as logical AND — a prop must satisfy every active filter.
 */

import { EnhancedPropCardData, AdvancedFilterState } from "./types"

// ─── Default Filter State ───────────────────────────────────────────────────

export const DEFAULT_FILTERS: AdvancedFilterState = {
  withoutPlayer: "",
  homeAway: "all",
  opposingTeam: null,
  opposingPlayer: null,
  minConfidence: 1,
  direction: "all",
  hitRateMin: 0,
  hitRateMax: 100,
}

// ─── Filter Application ─────────────────────────────────────────────────────

/**
 * Applies all active advanced filters to an array of enhanced prop cards.
 * Filters are combined with logical AND — only props satisfying ALL active
 * filter conditions are returned.
 *
 * @param props - Array of enhanced prop card data to filter
 * @param filters - Current advanced filter state
 * @returns Filtered array of props satisfying all conditions
 */
export function applyAdvancedFilters(
  props: EnhancedPropCardData[],
  filters: AdvancedFilterState
): EnhancedPropCardData[] {
  return props.filter((prop) => {
    // withoutPlayer: if non-empty, only include props where the filter has been applied at data level
    if (filters.withoutPlayer.trim() !== "") {
      if (!prop.withoutPlayerApplied) {
        return false
      }
    }

    // homeAway: if not "all", filter by venue context
    if (filters.homeAway !== "all") {
      if (prop.venue !== filters.homeAway) {
        return false
      }
    }

    // opposingTeam: if not null, only include props where upcoming opponent matches
    if (filters.opposingTeam !== null) {
      if (
        prop.upcomingOpponent === null ||
        prop.upcomingOpponent.toLowerCase() !== filters.opposingTeam.toLowerCase()
      ) {
        return false
      }
    }

    // minConfidence: only include props with confidence.stars >= minConfidence
    if (filters.minConfidence > 1) {
      if (prop.confidence === null || prop.confidence.stars < filters.minConfidence) {
        return false
      }
    }

    // direction: filter props that have the matching direction (skip if "all")
    if (filters.direction !== "all" && prop.direction !== filters.direction) {
      return false
    }

    // hitRateMin/hitRateMax: only include props whose L10 hit rate falls within [min, max]
    const l10Window = prop.hitRateWindows.find((w) => w.window === "L10")
    if (l10Window && l10Window.available) {
      if (l10Window.hitRate < filters.hitRateMin || l10Window.hitRate > filters.hitRateMax) {
        return false
      }
    } else if (filters.hitRateMin > 0) {
      // If L10 is unavailable and a minimum hit rate is required, exclude the prop
      return false
    }

    return true
  })
}

// ─── Active Filter Count ────────────────────────────────────────────────────

/**
 * Counts how many filters differ from their default values.
 * Used to display the active filter count badge.
 *
 * @param filters - Current advanced filter state
 * @returns Number of filters that differ from defaults
 */
export function getActiveFilterCount(filters: AdvancedFilterState): number {
  let count = 0

  if (filters.withoutPlayer !== DEFAULT_FILTERS.withoutPlayer) count++
  if (filters.homeAway !== DEFAULT_FILTERS.homeAway) count++
  if (filters.opposingTeam !== DEFAULT_FILTERS.opposingTeam) count++
  if (filters.minConfidence !== DEFAULT_FILTERS.minConfidence) count++
  if (filters.direction !== DEFAULT_FILTERS.direction) count++
  if (filters.hitRateMin !== DEFAULT_FILTERS.hitRateMin) count++
  if (filters.hitRateMax !== DEFAULT_FILTERS.hitRateMax) count++

  return count
}
