/**
 * Position parser for NBA player positions.
 * Handles multi-position strings (e.g., "PG-SG", "SF/PF") by extracting the first valid position.
 */

export type Position = "PG" | "SG" | "SF" | "PF" | "C"

const VALID_POSITIONS: ReadonlySet<string> = new Set(["PG", "SG", "SF", "PF", "C"])

/**
 * Type guard that checks if a string is a valid NBA position.
 */
export function isValidPosition(pos: string): pos is Position {
  return VALID_POSITIONS.has(pos)
}

/**
 * Parses a raw position string and returns the first valid position found.
 * Splits on "-" or "/" to handle multi-position formats like "PG-SG" or "SF/PF".
 * Returns null for null, undefined, or empty inputs, or if no valid position is found.
 */
export function parsePosition(raw: string | null | undefined): Position | null {
  if (raw == null || raw.trim() === "") {
    return null
  }

  const parts = raw.split(/[-\/]/)

  for (const part of parts) {
    const trimmed = part.trim().toUpperCase()
    if (isValidPosition(trimmed)) {
      return trimmed
    }
  }

  return null
}
