/**
 * Utility functions for organizing and filtering match data.
 */

import { LiveMatch } from "@/types"

/**
 * Group matches by their league field.
 * Returns a record where keys are league names and values are arrays of matches.
 */
export function groupByLeague(matches: LiveMatch[]): Record<string, LiveMatch[]> {
  const groups: Record<string, LiveMatch[]> = {}
  for (const match of matches) {
    if (!groups[match.league]) {
      groups[match.league] = []
    }
    groups[match.league].push(match)
  }
  return groups
}

/**
 * Sort matches within a group:
 * 1. Live matches (In Progress, Halftime, Q1-Q4, OT, First Half, Second Half) first
 * 2. Finished matches second
 * 3. Not Started / upcoming matches last (sorted ascending by clock/time)
 */
export function sortMatchesInGroup(matches: LiveMatch[]): LiveMatch[] {
  return [...matches].sort((a, b) => {
    const priorityA = getStatusPriority(a.status)
    const priorityB = getStatusPriority(b.status)

    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }

    // Within the same priority group, sort upcoming by clock (time string)
    if (priorityA === 3 && a.clock && b.clock) {
      return a.clock.localeCompare(b.clock)
    }

    return 0
  })
}

/**
 * Filter matches by sport. Returns all matches when sport is "All".
 */
export function filterBySport(matches: LiveMatch[], sport: string): LiveMatch[] {
  if (sport === "All") return matches
  return matches.filter((m) => m.sport === sport)
}

// ─── Internal ────────────────────────────────────────────────────────────────

function getStatusPriority(status: string): number {
  switch (status) {
    case "In Progress":
    case "Halftime":
    case "First Half":
    case "Second Half":
    case "Q1":
    case "Q2":
    case "Q3":
    case "Q4":
    case "OT":
      return 1 // Live — highest priority
    case "Finished":
      return 2
    case "Not Started":
      return 3
    case "Postponed":
      return 4
    default:
      return 1 // Unknown status treated as live
  }
}
