/**
 * Parlay computation module.
 * Pure computation — no side effects or external dependencies.
 *
 * Computes combined hit rates, correlation flags, and weak link identification
 * for multi-leg parlay selections.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParlayLeg {
  propId: string
  player: string
  statCategory: string
  propLine: number
  direction: "over" | "under"
  l10HitRate: number
  gameData: { date: string; value: number }[]
}

export interface ParlayLegResult {
  propId: string
  l10HitRate: number
  isWeakLink: boolean
  correlationFlag?: "correlated" | "conflict"
}

export interface CorrelationPair {
  propA: string
  propB: string
  coefficient: number
}

export interface ParlayResult {
  combinedHitRate: number | null // null if insufficient data
  overlappingDates: number
  legs: ParlayLegResult[]
  correlationPairs: CorrelationPair[]
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Identifies the weak link leg(s) — those with the lowest L10 hit rate.
 * If multiple legs share the same minimum, all are returned.
 *
 * @param legs - Array of legs with propId and l10HitRate
 * @returns Array of propIds that are weak links
 */
export function identifyWeakLink(
  legs: { propId: string; l10HitRate: number }[]
): string[] {
  if (legs.length === 0) return []

  const minRate = Math.min(...legs.map((l) => l.l10HitRate))
  return legs.filter((l) => l.l10HitRate === minRate).map((l) => l.propId)
}

/**
 * Computes combined parlay statistics including hit rate, correlation flags,
 * and weak link identification.
 *
 * @param legs - Array of parlay legs with game data
 * @param correlations - Pre-computed correlation pairs to check
 * @returns ParlayResult with combined analytics
 */
export function computeParlayStats(
  legs: ParlayLeg[],
  correlations: CorrelationPair[]
): ParlayResult {
  // Find overlapping dates (dates where ALL legs have game data)
  const overlappingDates = findOverlappingDates(legs)

  // Compute combined hit rate
  let combinedHitRate: number | null = null
  if (overlappingDates.length >= 5) {
    const allHitDates = countAllHitDates(legs, overlappingDates)
    const raw = (allHitDates / overlappingDates.length) * 100
    combinedHitRate = Math.round(raw * 10) / 10
  }

  // Identify weak link(s)
  const weakLinkIds = identifyWeakLink(
    legs.map((l) => ({ propId: l.propId, l10HitRate: l.l10HitRate }))
  )

  // Find relevant correlation pairs and build per-leg flags
  const relevantPairs = findRelevantCorrelations(legs, correlations)
  const legCorrelationFlags = buildLegCorrelationFlags(legs, relevantPairs)

  // Build leg results
  const legResults: ParlayLegResult[] = legs.map((leg) => {
    const result: ParlayLegResult = {
      propId: leg.propId,
      l10HitRate: leg.l10HitRate,
      isWeakLink: weakLinkIds.includes(leg.propId),
    }

    const flag = legCorrelationFlags.get(leg.propId)
    if (flag) {
      result.correlationFlag = flag
    }

    return result
  })

  return {
    combinedHitRate,
    overlappingDates: overlappingDates.length,
    legs: legResults,
    correlationPairs: relevantPairs,
  }
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Finds dates where ALL legs have game data.
 */
function findOverlappingDates(legs: ParlayLeg[]): string[] {
  if (legs.length === 0) return []

  // Get date sets for each leg
  const dateSets = legs.map(
    (leg) => new Set(leg.gameData.map((g) => g.date))
  )

  // Start with the first leg's dates and intersect with all others
  const intersection = [...dateSets[0]].filter((date) =>
    dateSets.every((set) => set.has(date))
  )

  return intersection
}

/**
 * Counts dates where ALL legs hit simultaneously.
 * A leg "hits" when:
 * - direction "over": value >= propLine
 * - direction "under": value < propLine
 */
function countAllHitDates(legs: ParlayLeg[], overlappingDates: string[]): number {
  let count = 0

  for (const date of overlappingDates) {
    const allHit = legs.every((leg) => {
      const game = leg.gameData.find((g) => g.date === date)
      if (!game) return false

      if (leg.direction === "over") {
        return game.value >= leg.propLine
      } else {
        return game.value < leg.propLine
      }
    })

    if (allHit) count++
  }

  return count
}

/**
 * Finds correlation pairs that involve any two legs in the parlay.
 */
function findRelevantCorrelations(
  legs: ParlayLeg[],
  correlations: CorrelationPair[]
): CorrelationPair[] {
  const legIds = new Set(legs.map((l) => l.propId))

  return correlations.filter(
    (c) => legIds.has(c.propA) && legIds.has(c.propB)
  )
}

/**
 * Builds a map of propId → correlation flag based on relevant pairs.
 * A leg gets "correlated" if any pair involving it has coefficient > 0.5.
 * A leg gets "conflict" if any pair involving it has coefficient < -0.3.
 * "correlated" and "conflict" are mutually exclusive per leg — if both apply,
 * the stronger signal (conflict) takes precedence since it's a warning.
 */
function buildLegCorrelationFlags(
  legs: ParlayLeg[],
  pairs: CorrelationPair[]
): Map<string, "correlated" | "conflict"> {
  const flags = new Map<string, "correlated" | "conflict">()

  for (const pair of pairs) {
    if (pair.coefficient > 0.5) {
      // Only set correlated if not already flagged as conflict
      if (!flags.has(pair.propA) || flags.get(pair.propA) !== "conflict") {
        flags.set(pair.propA, "correlated")
      }
      if (!flags.has(pair.propB) || flags.get(pair.propB) !== "conflict") {
        flags.set(pair.propB, "correlated")
      }
    } else if (pair.coefficient < -0.3) {
      // Conflict always overrides correlated
      flags.set(pair.propA, "conflict")
      flags.set(pair.propB, "conflict")
    }
  }

  return flags
}
