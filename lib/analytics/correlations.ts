/**
 * Pearson correlation computation module.
 *
 * Pure computation — no database or network dependencies.
 * Used by the Correlation Engine to compute pairwise correlations
 * between player-stat combinations.
 *
 * Requirements: 5.1, 5.5, 5.6, 5.9
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CorrelationResult {
  propA: string
  propB: string
  coefficient: number
  overlappingGames: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Minimum overlapping games required to compute a correlation */
const MIN_OVERLAPPING_GAMES = 10

/** Maximum unique player-stat combinations per sport per computation cycle */
const DEFAULT_MAX_PROPS = 500

// ─── Core Computation ───────────────────────────────────────────────────────

/**
 * Computes the Pearson correlation coefficient between two arrays of values.
 *
 * Formula:
 *   r = (n * Σ(xy) - Σx * Σy) / sqrt((n * Σ(x²) - (Σx)²) * (n * Σ(y²) - (Σy)²))
 *
 * @param valuesA - First array of numeric values
 * @param valuesB - Second array of numeric values
 * @returns The Pearson r coefficient clamped to [-1, 1], or null if:
 *   - Arrays have different lengths
 *   - Fewer than 10 values (minimum overlapping games)
 *   - Standard deviation of either array is 0 (constant values)
 */
export function computePearsonCorrelation(
  valuesA: number[],
  valuesB: number[]
): number | null {
  // Validate: arrays must have the same length
  if (valuesA.length !== valuesB.length) {
    return null
  }

  const n = valuesA.length

  // Validate: minimum overlapping games requirement
  if (n < MIN_OVERLAPPING_GAMES) {
    return null
  }

  // Compute sums needed for the Pearson formula
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (let i = 0; i < n; i++) {
    const x = valuesA[i]
    const y = valuesB[i]
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
    sumY2 += y * y
  }

  // Compute denominator components
  const denominatorA = n * sumX2 - sumX * sumX
  const denominatorB = n * sumY2 - sumY * sumY

  // If either array has zero variance (constant values), return null
  if (denominatorA === 0 || denominatorB === 0) {
    return null
  }

  const denominator = Math.sqrt(denominatorA * denominatorB)

  // Safety check for floating point edge cases
  if (denominator === 0) {
    return null
  }

  const numerator = n * sumXY - sumX * sumY
  const r = numerator / denominator

  // Clamp to [-1, 1] for floating point safety
  return Math.max(-1, Math.min(1, r))
}

// ─── Batch Computation ──────────────────────────────────────────────────────

/**
 * Computes pairwise Pearson correlations for all prop pairs with sufficient
 * overlapping data.
 *
 * @param props - Array of props with their game values (id is the player-stat identifier)
 * @param maxProps - Maximum number of props to process (default 500, per requirement 5.9)
 * @returns Array of correlation results for all valid pairs
 */
export function computeAllCorrelations(
  props: { id: string; values: number[] }[],
  maxProps: number = DEFAULT_MAX_PROPS
): CorrelationResult[] {
  // Cap at maxProps unique player-stat combinations per sport per cycle
  const capped = props.slice(0, maxProps)
  const results: CorrelationResult[] = []

  // Compute pairwise correlations
  for (let i = 0; i < capped.length; i++) {
    for (let j = i + 1; j < capped.length; j++) {
      const propA = capped[i]
      const propB = capped[j]

      // Determine overlapping games (use the shorter length as the overlap)
      const overlapLength = Math.min(propA.values.length, propB.values.length)

      // Skip if insufficient overlap
      if (overlapLength < MIN_OVERLAPPING_GAMES) {
        continue
      }

      // Use the first `overlapLength` values from each (aligned by game index)
      const valuesA = propA.values.slice(0, overlapLength)
      const valuesB = propB.values.slice(0, overlapLength)

      const coefficient = computePearsonCorrelation(valuesA, valuesB)

      if (coefficient !== null) {
        results.push({
          propA: propA.id,
          propB: propB.id,
          coefficient,
          overlappingGames: overlapLength,
        })
      }
    }
  }

  return results
}
