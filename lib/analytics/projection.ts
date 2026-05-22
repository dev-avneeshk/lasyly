/**
 * NBA Prop Projection Engine
 *
 * Implements the 3-layer projection formula:
 *   Layer 1 — Weighted Base Average:
 *     BaseAvg = (L3 × 0.45) + (L5 × 0.25) + (L10 × 0.20) + (Season × 0.10)
 *
 *   Layer 2 — Contextual Multipliers:
 *     Projection = BaseAvg × DefFactor × PaceFactor × VenueFactor × RestFactor × MinutesFactor
 *
 *   Layer 3 — Edge Score (requires book line, skipped when unavailable):
 *     Edge = Projection − BookLine
 *
 * Pure computation module — no side effects or database calls.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProjectionInput {
  /** Stat values, most recent first */
  recentGames: number[]
  /** Season average for this stat (all games) */
  seasonAvg: number
  /** Opponent defensive rank 1-30 for this stat category (1 = worst defense = allows most) */
  oppDefRank: number | null
  /** Opponent pace rank 1-30 (1 = fastest) */
  oppPaceRank: number | null
  /** Whether the player is home or away */
  venue: "home" | "away" | null
  /** Days of rest before this game (0 = back-to-back, 1 = normal, 2 = one extra day, 3+ = extended rest) */
  restDays: number | null
  /** Projected minutes (or recent average minutes) */
  minutesProjection: number | null
  /** Sportsbook line (null if unavailable — stops after Step 2) */
  bookLine: number | null
}

export interface ProjectionOutput {
  /** Weighted base average (Layer 1) */
  baseAvg: number
  /** Final projection after all multipliers (Layer 2) */
  projection: number
  /** Edge score: projection - bookLine (Layer 3, null if no book line) */
  edge: number | null
  /** Edge signal classification */
  edgeSignal: "strong" | "moderate" | "weak" | "no-edge" | null
  /** Individual multiplier values applied */
  multipliers: ProjectionMultipliers
  /** Which multipliers were available and applied */
  multipliersApplied: string[]
  /** Component averages used in base calculation */
  baseComponents: BaseComponents
}

export interface ProjectionMultipliers {
  defFactor: number
  paceFactor: number
  venueFactor: number
  restFactor: number
  minutesFactor: number
}

export interface BaseComponents {
  l3Avg: number
  l5Avg: number
  l10Avg: number
  seasonAvg: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Base average weights */
const BASE_WEIGHTS = {
  l3: 0.45,
  l5: 0.25,
  l10: 0.20,
  season: 0.10,
} as const

/** Defensive rank factor thresholds (rank 1 = allows most = best for player) */
function getDefFactor(rank: number): number {
  if (rank <= 5) return 1.12
  if (rank <= 10) return 1.06
  if (rank <= 20) return 1.02
  if (rank <= 25) return 0.96
  return 0.92 // rank 26-30
}

/** Pace rank factor thresholds (rank 1 = fastest) */
function getPaceFactor(rank: number): number {
  if (rank <= 5) return 1.06
  if (rank <= 10) return 1.04
  if (rank <= 20) return 1.02
  if (rank <= 25) return 0.98
  return 0.95 // rank 26-30
}

/** Venue factor */
function getVenueFactor(venue: "home" | "away"): number {
  return venue === "home" ? 1.03 : 0.97
}

/** Rest days factor */
function getRestFactor(restDays: number): number {
  if (restDays >= 3) return 1.04
  if (restDays === 2) return 1.01
  if (restDays === 1) return 1.00
  return 0.96 // 0 = back-to-back
}

/** Minutes factor */
function getMinutesFactor(minutes: number): number {
  if (minutes >= 36) return 1.08
  if (minutes >= 32) return 1.02
  if (minutes >= 28) return 1.00
  return 0.82 // < 28 minutes
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Computes the average of the first N values in an array.
 * Returns 0 if the array is empty.
 */
function avgOfFirst(values: number[], n: number): number {
  if (values.length === 0) return 0
  const slice = values.slice(0, Math.min(n, values.length))
  return slice.reduce((sum, v) => sum + v, 0) / slice.length
}

/**
 * Computes the L3 average (last 3 games).
 */
export function computeL3Average(games: number[]): number {
  if (games.length === 0) return 0
  const avg = avgOfFirst(games, 3)
  return Math.round(avg * 10) / 10
}

/**
 * Computes the season average (all games).
 */
export function computeSeasonAverage(games: number[]): number {
  if (games.length === 0) return 0
  const avg = games.reduce((sum, v) => sum + v, 0) / games.length
  return Math.round(avg * 10) / 10
}

/**
 * Computes rest days between two ISO date strings.
 * Returns the number of days between the two dates minus 1
 * (so consecutive days = 0 rest days = back-to-back).
 */
export function computeRestDays(
  currentGameDate: string,
  previousGameDate: string
): number {
  const current = new Date(currentGameDate)
  const previous = new Date(previousGameDate)
  const diffMs = current.getTime() - previous.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  // 1 day apart = back-to-back (0 rest days)
  // 2 days apart = 1 rest day (normal)
  // 3 days apart = 2 rest days
  return Math.max(0, diffDays - 1)
}

// ─── Edge Signal Classification ─────────────────────────────────────────────

/**
 * Classifies the edge score into a signal strength.
 *
 * | Edge     | Signal                          |
 * |----------|---------------------------------|
 * | < 0.5    | No edge — skip                  |
 * | 0.5–1.5  | Weak — only at -115 or better   |
 * | 1.5–3.0  | Moderate — standard play        |
 * | > 3.0    | Strong — max confidence         |
 */
export function classifyEdge(
  edge: number
): "strong" | "moderate" | "weak" | "no-edge" {
  const absEdge = Math.abs(edge)
  if (absEdge > 3.0) return "strong"
  if (absEdge >= 1.5) return "moderate"
  if (absEdge >= 0.5) return "weak"
  return "no-edge"
}

// ─── Main Projection Function ───────────────────────────────────────────────

/**
 * Computes the full projection for a player-stat prop.
 *
 * Layer 1: Weighted base average from L3, L5, L10, and season averages.
 * Layer 2: Multiply by contextual factors (defense, pace, venue, rest, minutes).
 * Layer 3: Compare to book line for edge score (only if book line provided).
 *
 * All multipliers default to 1.0 (neutral) when data is unavailable,
 * so the projection gracefully degrades with missing context.
 */
export function computeProjection(input: ProjectionInput): ProjectionOutput {
  const {
    recentGames,
    seasonAvg,
    oppDefRank,
    oppPaceRank,
    venue,
    restDays,
    minutesProjection,
    bookLine,
  } = input

  // ─── Layer 1: Weighted Base Average ─────────────────────────────────────

  const l3Avg = avgOfFirst(recentGames, 3)
  const l5Avg = avgOfFirst(recentGames, 5)
  const l10Avg = avgOfFirst(recentGames, 10)

  // Use available data for weighting — if fewer games exist, redistribute weights
  let baseAvg: number
  if (recentGames.length >= 10) {
    // Full formula
    baseAvg =
      l3Avg * BASE_WEIGHTS.l3 +
      l5Avg * BASE_WEIGHTS.l5 +
      l10Avg * BASE_WEIGHTS.l10 +
      seasonAvg * BASE_WEIGHTS.season
  } else if (recentGames.length >= 5) {
    // No L10 distinction — merge L10 weight into L5 and season
    baseAvg =
      l3Avg * 0.50 +
      l5Avg * 0.30 +
      seasonAvg * 0.20
  } else if (recentGames.length >= 3) {
    // Only L3 reliable
    baseAvg = l3Avg * 0.60 + seasonAvg * 0.40
  } else {
    // Very limited data — use season average
    baseAvg = seasonAvg > 0 ? seasonAvg : l3Avg
  }

  // ─── Layer 2: Contextual Multipliers ────────────────────────────────────

  const multipliersApplied: string[] = []
  const multipliers: ProjectionMultipliers = {
    defFactor: 1.0,
    paceFactor: 1.0,
    venueFactor: 1.0,
    restFactor: 1.0,
    minutesFactor: 1.0,
  }

  if (oppDefRank !== null && oppDefRank >= 1 && oppDefRank <= 30) {
    multipliers.defFactor = getDefFactor(oppDefRank)
    multipliersApplied.push("defense")
  }

  if (oppPaceRank !== null && oppPaceRank >= 1 && oppPaceRank <= 30) {
    multipliers.paceFactor = getPaceFactor(oppPaceRank)
    multipliersApplied.push("pace")
  }

  if (venue !== null) {
    multipliers.venueFactor = getVenueFactor(venue)
    multipliersApplied.push("venue")
  }

  if (restDays !== null) {
    multipliers.restFactor = getRestFactor(restDays)
    multipliersApplied.push("rest")
  }

  if (minutesProjection !== null && minutesProjection > 0) {
    multipliers.minutesFactor = getMinutesFactor(minutesProjection)
    multipliersApplied.push("minutes")
  }

  const projection =
    baseAvg *
    multipliers.defFactor *
    multipliers.paceFactor *
    multipliers.venueFactor *
    multipliers.restFactor *
    multipliers.minutesFactor

  // Round to 1 decimal
  const roundedProjection = Math.round(projection * 10) / 10

  // ─── Layer 3: Edge Score ────────────────────────────────────────────────

  let edge: number | null = null
  let edgeSignal: ProjectionOutput["edgeSignal"] = null

  if (bookLine !== null) {
    edge = Math.round((roundedProjection - bookLine) * 10) / 10
    edgeSignal = classifyEdge(edge)
  }

  return {
    baseAvg: Math.round(baseAvg * 10) / 10,
    projection: roundedProjection,
    edge,
    edgeSignal,
    multipliers,
    multipliersApplied,
    baseComponents: {
      l3Avg: Math.round(l3Avg * 10) / 10,
      l5Avg: Math.round(l5Avg * 10) / 10,
      l10Avg: Math.round(l10Avg * 10) / 10,
      seasonAvg: Math.round(seasonAvg * 10) / 10,
    },
  }
}
