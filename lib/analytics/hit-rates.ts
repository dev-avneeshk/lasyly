/**
 * Multi-window hit rate computation module.
 * Pure computation — no side effects or external dependencies.
 */

export type WindowName = "L5" | "L10" | "L15" | "L20" | "Season" | "vsOpp"

export interface HitRateWindow {
  window: WindowName
  hitRate: number    // 0-100 integer percentage
  over: number      // games over line
  total: number     // total games in window
  available: boolean // false if < 3 games
}

export type ColorBand = "red" | "yellow" | "green"

const WINDOW_SIZES: { window: WindowName; size: number | null }[] = [
  { window: "L5", size: 5 },
  { window: "L10", size: 10 },
  { window: "L15", size: 15 },
  { window: "L20", size: 20 },
  { window: "Season", size: null }, // null = use all available games
]

/**
 * Computes hit rates across multiple sample windows.
 *
 * @param gameValues - Array of stat values, most recent first
 * @param propLine - The prop line to compare against
 * @param vsOppValues - Optional array of game values vs the specific opponent (most recent first)
 * @returns Array of HitRateWindow objects for each window
 */
export function computeHitRates(
  gameValues: number[],
  propLine: number,
  vsOppValues?: number[]
): HitRateWindow[] {
  const results: HitRateWindow[] = []

  for (const { window, size } of WINDOW_SIZES) {
    const windowSize = size ?? gameValues.length
    const sliced = gameValues.slice(0, windowSize)
    const total = sliced.length

    if (total < 3) {
      results.push({ window, hitRate: 0, over: 0, total, available: false })
    } else {
      const over = sliced.filter((v) => v >= propLine).length
      const hitRate = Math.round((over / total) * 100)
      results.push({ window, hitRate, over, total, available: true })
    }
  }

  // vsOpp window
  const vsOppData = vsOppValues ?? []
  const vsOppTotal = vsOppData.length

  if (vsOppTotal < 3) {
    results.push({ window: "vsOpp", hitRate: 0, over: 0, total: vsOppTotal, available: false })
  } else {
    const over = vsOppData.filter((v) => v >= propLine).length
    const hitRate = Math.round((over / vsOppTotal) * 100)
    results.push({ window: "vsOpp", hitRate, over, total: vsOppTotal, available: true })
  }

  return results
}

/**
 * Returns the color band for a given hit rate percentage.
 *
 * - red: 0-30% (boundary 30 belongs to red)
 * - yellow: 31-60% (boundary 60 belongs to yellow)
 * - green: 61-100%
 */
export function getColorBand(hitRate: number): ColorBand {
  if (hitRate <= 30) return "red"
  if (hitRate <= 60) return "yellow"
  return "green"
}
