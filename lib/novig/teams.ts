/**
 * ParlayAPI team names -> NBA 3-letter abbreviations (the engine's keys).
 * ParlayAPI writes "L.A. Clippers"; nba_games stores "Los Angeles Clippers".
 */
import { TEAM_NAME_TO_ABBR } from "@/lib/analytics/engine-v2"

function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

const TEAM_ALIASES: Readonly<Record<string, string>> = {
  "la clippers": "LAC",
  "l a clippers": "LAC",
  "la lakers": "LAL",
}

const BY_NORMALIZED_NAME: ReadonlyMap<string, string> = new Map([
  ...Object.entries(TEAM_NAME_TO_ABBR).map(([full, abbr]) => [normalizeTeamName(full), abbr] as const),
  ...Object.entries(TEAM_ALIASES),
])

const ABBRS: ReadonlySet<string> = new Set(Object.values(TEAM_NAME_TO_ABBR))

/** Abbreviation for a full team name (or an abbreviation already), else null. */
export function toNbaAbbr(name: string | null | undefined): string | null {
  if (!name) return null
  const trimmed = name.trim()
  if (ABBRS.has(trimmed.toUpperCase())) return trimmed.toUpperCase()
  return BY_NORMALIZED_NAME.get(normalizeTeamName(trimmed)) ?? null
}
