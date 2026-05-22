/**
 * Derived stats computation module.
 *
 * Computes advanced basketball metrics from raw per-game and advanced stats.
 * All functions are pure computations — no side effects or external dependencies.
 *
 * Formulas:
 * - ePPS: PTS / (FGA + 0.44 × FTA)
 * - Self-Created FGA: FGA × (1 - assistedPct)
 * - PGA Conversion Rate: (AST / PGA) × 100
 * - Projected Rebounds: (TRB% / 100) × teamTotalReb
 * - Stocks: STL + BLK
 * - Fouls Drawn: FTA / 1.8
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface DerivedStatsInput {
  fgaPerGame: number
  ftaPerGame: number
  ptsPerGame: number
  astPerGame: number
  tovPerGame: number
  stlPerGame: number
  blkPerGame: number
  /** Percentage of FGA near the rim (0-3 ft), 0-100. Null if unavailable. */
  fgaPct0_3ft: number | null
  /** Mid-range percentage of FGA (sum of mid-range zones), 0-100. Null if unavailable. */
  fgaPctMidRange: number | null
  /** Percentage of 2P FG that are assisted, 0-100. Null if unavailable. */
  pct2pAssisted: number | null
  /** Percentage of 3P FG that are assisted, 0-100. Null if unavailable. */
  pct3pAssisted: number | null
  /** Percentage of FGA that are 3-pointers, 0-100. Null if unavailable. */
  fgaPct3pt: number | null
  /** Total rebound percentage, 0-100. Null if unavailable. */
  trbPct: number | null
  /** Potential Game Assists per game. Null if unavailable. */
  pgaPerGame: number | null
  /** Team total rebounds per game. Null if unavailable. */
  teamTotalRebPerGame: number | null
}

export interface DerivedStat {
  value: number
  /** Formula with actual numeric values substituted, e.g. "18.5 / (16.2 + 0.44 × 8.1)" */
  formula: string
  /** Computed result string, e.g. "= 0.92" */
  formulaResult: string
  /** Empty if all inputs available; otherwise lists missing input names */
  missingInputs: string[]
}

export interface DerivedStatsData {
  midRangeAttemptsPerGame: DerivedStat | null
  rimAttemptsPerGame: DerivedStat | null
  ePPS: DerivedStat | null
  selfCreatedFGAPerGame: DerivedStat | null
  astTovRatio: DerivedStat | null
  pgaConversionRate: DerivedStat | null
  projectedReboundsPerGame: DerivedStat | null
  stocksPerGame: DerivedStat | null
  foulsDrawnPerGame: DerivedStat | null
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Round a number to the specified number of decimal places.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

/**
 * Determine color code based on player value vs league average.
 * - "green" when player exceeds league average by more than 10%
 * - "red" when player is below league average by more than 10%
 * - "default" when within 10% (inclusive)
 */
export function getColorCode(
  playerValue: number,
  leagueAverage: number
): "green" | "red" | "default" {
  if (leagueAverage <= 0) return "default"

  if (playerValue > leagueAverage * 1.1) return "green"
  if (playerValue < leagueAverage * 0.9) return "red"
  return "default"
}

// ---------------------------------------------------------------------------
// Individual computation functions
// ---------------------------------------------------------------------------

/**
 * Compute Expected Points Per Shot Attempted (ePPS).
 * Formula: PTS / (FGA + 0.44 × FTA)
 * Returns 0 when denominator is 0 (division by zero guard).
 */
export function computeEPPS(pts: number, fga: number, fta: number): number {
  const denominator = fga + 0.44 * fta
  if (denominator === 0) return 0
  return pts / denominator
}

/**
 * Compute Self-Created FGA per game.
 * assistedPct = (pct2pAssisted/100 × (1 - fgaPct3pt/100)) + (pct3pAssisted/100 × fgaPct3pt/100)
 * selfCreatedFGA = fga × (1 - assistedPct)
 */
export function computeSelfCreatedFGA(
  fga: number,
  pct2pAssisted: number,
  pct3pAssisted: number,
  fgaPct3pt: number
): number {
  const assistedPct =
    (pct2pAssisted / 100) * (1 - fgaPct3pt / 100) +
    (pct3pAssisted / 100) * (fgaPct3pt / 100)
  return fga * (1 - assistedPct)
}

/**
 * Compute PGA Conversion Rate.
 * Formula: (AST / PGA) × 100
 * Returns null when PGA is 0 (division by zero guard).
 */
export function computePGAConversionRate(
  ast: number,
  pga: number
): number | null {
  if (pga === 0) return null
  return (ast / pga) * 100
}

/**
 * Compute Projected Rebounds per game.
 * Formula: (TRB% / 100) × teamTotalReb
 */
export function computeProjectedRebounds(
  trbPct: number,
  teamTotalReb: number
): number {
  return (trbPct / 100) * teamTotalReb
}

/**
 * Compute Stocks (steals + blocks) per game.
 */
export function computeStocks(stl: number, blk: number): number {
  return stl + blk
}

/**
 * Compute Fouls Drawn per game.
 * Formula: FTA / 1.8 (league average free throws per foul)
 */
export function computeFoulsDrawn(fta: number): number {
  return fta / 1.8
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Compute all derived stats from the given input.
 * Returns DerivedStatsData with formula strings showing actual values.
 * Individual stats are null when required inputs are unavailable.
 */
export function computeDerivedStats(input: DerivedStatsInput): DerivedStatsData {
  const {
    fgaPerGame,
    ftaPerGame,
    ptsPerGame,
    astPerGame,
    tovPerGame,
    stlPerGame,
    blkPerGame,
    fgaPct0_3ft,
    fgaPctMidRange,
    pct2pAssisted,
    pct3pAssisted,
    fgaPct3pt,
    trbPct,
    pgaPerGame,
    teamTotalRebPerGame,
  } = input

  // Mid-range attempts per game
  let midRangeAttemptsPerGame: DerivedStat | null = null
  if (fgaPctMidRange !== null) {
    const value = roundTo(fgaPerGame * (fgaPctMidRange / 100), 1)
    midRangeAttemptsPerGame = {
      value,
      formula: `${fgaPerGame} × (${fgaPctMidRange} / 100)`,
      formulaResult: `= ${value}`,
      missingInputs: [],
    }
  }

  // Rim attempts per game
  let rimAttemptsPerGame: DerivedStat | null = null
  if (fgaPct0_3ft !== null) {
    const value = roundTo(fgaPerGame * (fgaPct0_3ft / 100), 1)
    rimAttemptsPerGame = {
      value,
      formula: `${fgaPerGame} × (${fgaPct0_3ft} / 100)`,
      formulaResult: `= ${value}`,
      missingInputs: [],
    }
  }

  // ePPS
  let ePPS: DerivedStat | null = null
  const eppsDenominator = fgaPerGame + 0.44 * ftaPerGame
  if (eppsDenominator > 0) {
    const value = roundTo(computeEPPS(ptsPerGame, fgaPerGame, ftaPerGame), 2)
    ePPS = {
      value,
      formula: `${ptsPerGame} / (${fgaPerGame} + 0.44 × ${ftaPerGame})`,
      formulaResult: `= ${value}`,
      missingInputs: [],
    }
  }

  // Self-created FGA per game
  let selfCreatedFGAPerGame: DerivedStat | null = null
  if (
    pct2pAssisted !== null &&
    pct3pAssisted !== null &&
    fgaPct3pt !== null
  ) {
    const value = roundTo(
      computeSelfCreatedFGA(fgaPerGame, pct2pAssisted, pct3pAssisted, fgaPct3pt),
      1
    )
    selfCreatedFGAPerGame = {
      value,
      formula: `${fgaPerGame} × (1 - ((${pct2pAssisted}/100 × (1 - ${fgaPct3pt}/100)) + (${pct3pAssisted}/100 × ${fgaPct3pt}/100)))`,
      formulaResult: `= ${value}`,
      missingInputs: [],
    }
  }

  // AST/TOV ratio
  let astTovRatio: DerivedStat | null = null
  if (tovPerGame > 0) {
    const value = roundTo(astPerGame / tovPerGame, 2)
    astTovRatio = {
      value,
      formula: `${astPerGame} / ${tovPerGame}`,
      formulaResult: `= ${value}`,
      missingInputs: [],
    }
  }

  // PGA conversion rate
  let pgaConversionRate: DerivedStat | null = null
  if (pgaPerGame !== null) {
    if (pgaPerGame === 0) {
      // Division by zero — display N/A via null
      pgaConversionRate = null
    } else {
      const value = roundTo(
        computePGAConversionRate(astPerGame, pgaPerGame)!,
        1
      )
      pgaConversionRate = {
        value,
        formula: `(${astPerGame} / ${pgaPerGame}) × 100`,
        formulaResult: `= ${value}`,
        missingInputs: [],
      }
    }
  }

  // Projected rebounds per game
  let projectedReboundsPerGame: DerivedStat | null = null
  if (trbPct !== null && teamTotalRebPerGame !== null) {
    const value = roundTo(
      computeProjectedRebounds(trbPct, teamTotalRebPerGame),
      1
    )
    projectedReboundsPerGame = {
      value,
      formula: `(${trbPct} / 100) × ${teamTotalRebPerGame}`,
      formulaResult: `= ${value}`,
      missingInputs: [],
    }
  }

  // Stocks per game
  const stocksValue = roundTo(computeStocks(stlPerGame, blkPerGame), 1)
  const stocksPerGame: DerivedStat = {
    value: stocksValue,
    formula: `${stlPerGame} + ${blkPerGame}`,
    formulaResult: `= ${stocksValue}`,
    missingInputs: [],
  }

  // Fouls drawn per game
  const foulsDrawnValue = roundTo(computeFoulsDrawn(ftaPerGame), 1)
  const foulsDrawnPerGame: DerivedStat = {
    value: foulsDrawnValue,
    formula: `${ftaPerGame} / 1.8`,
    formulaResult: `= ${foulsDrawnValue}`,
    missingInputs: [],
  }

  return {
    midRangeAttemptsPerGame,
    rimAttemptsPerGame,
    ePPS,
    selfCreatedFGAPerGame,
    astTovRatio,
    pgaConversionRate,
    projectedReboundsPerGame,
    stocksPerGame,
    foulsDrawnPerGame,
  }
}
