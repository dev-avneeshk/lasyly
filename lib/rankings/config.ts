/**
 * NBA Ranking Engine — Configuration (LPI v1)
 *
 * Configurable weights, thresholds, and constants for the ranking algorithm.
 * All formulas read from this file — changing weights here affects all rankings.
 *
 * To update the algorithm: bump ALGORITHM_VERSION, create a new ranking version,
 * and regenerate rankings. Historical versions remain untouched.
 */

import type {
  RankingConfig,
  RankingWeights,
  RankingTier,
  RankingType,
} from "./types"

// ─── Algorithm Version ────────────────────────────────────────────────────────

export const ALGORITHM_VERSION = "LPI-v2"

// ─── Season Weights (multi-season projection blending) ───────────────────────

/**
 * Raw season weights for multi-season projection blending.
 * Normalization happens DYNAMICALLY inside the blending function,
 * AFTER removing seasons unavailable for a specific player or metric.
 * Never divide by a fixed denominator of 4.5 when seasons are missing.
 */
export const SEASON_WEIGHTS: Record<string, number> = {
  "2025-26": 3.0,
  "2024-25": 1.0,
  "2023-24": 0.5,
}

export const MIN_SEASONS_FOR_BLENDING = 1

// ─── Overall Score Weights ────────────────────────────────────────────────────

/**
 * How component scores combine into the BASE OVERALL score.
 * Must sum to 1.0.
 *
 * LPI v2 invariant:
 *   overall = 0.30*impact + 0.26*off + 0.18*def + 0.14*play + 0.12*roleVolume
 *
 * Why these changed from v1 (0.55 off / 0.37 def / 0.08 play):
 *
 * 1. v1 had NO volume term. Every component was a rate percentile, so a
 *    22-mpg reserve competed head-to-head with a 35-mpg franchise guard.
 *    `impact` (VORP-anchored) and `roleVolume` (minutes) now carry 0.42
 *    combined, so producing value across a real workload counts.
 *
 * 2. Defense fell 0.37 -> 0.18. Box-score defense (DBPM/DWS/blk%/drb%) is
 *    noisy and structurally favors bigs, who accumulate blocks and rebounds
 *    regardless of actual defensive value. At 0.37 it was the single largest
 *    swing factor in the ranking and routinely lifted rim-running reserves
 *    above high-usage guards.
 *
 * 3. Playmaking rose 0.08 -> 0.14. At 0.08 an elite 31% assist rate was
 *    nearly worthless, which badly undervalued primary initiators.
 *
 * 4. Offense fell 0.55 -> 0.26 in nominal terms, but offensive value is now
 *    also expressed through `impact` (OBPM feeds BPM/VORP/WS48), so the real
 *    offensive share of the score is materially higher than 0.26 alone.
 */
export const OVERALL_WEIGHTS = {
  impact:     0.30,
  offense:    0.26,
  defense:    0.18,
  playmaking: 0.14,
  roleVolume: 0.12,
} as const satisfies Record<string, number>

// ─── Projection Adjustment Coefficients ──────────────────────────────────────

export const PROJECTION_WEIGHTS = {
  k_T:    1.0,    // Trend multiplier (applied after clamping to TREND_CLAMP)
  k_A:    0.1,    // Availability multiplier
  k_Age:  1.0,    // Age curve multiplier (1.0 = use curve as-is)
  k_Role: 0.0,    // Role-fit coefficient (v1: disabled)
  k_Team: 0.0,    // Team-fit coefficient (v1: disabled)
} as const

/** Trend adjustment clamped to this range BEFORE being added to BASE. */
export const TREND_CLAMP = { min: -3, max: 3 } as const

/** Availability adjustment clamped to this range. */
export const AVAIL_CLAMP = { min: -3, max: 1 } as const

// ─── Team Power Weights ───────────────────────────────────────────────────────

export const TEAM_POWER_WEIGHTS = {
  core:       0.60,
  depth:      0.15,
  star:       0.10,
  teamAvail:  0.10,
  continuity: 0.05,
} as const

/**
 * P1-P8 diminishing roster value coefficients (spec §23).
 * Sum = 5.06 (used as denominator for CORE calculation).
 */
export const ROSTER_SLOT_WEIGHTS = [1.00, 0.86, 0.74, 0.64, 0.55, 0.48, 0.42, 0.37] as const
export const ROSTER_SLOT_DENOMINATOR = 5.06

// ─── Component Score Weights ──────────────────────────────────────────────────

export const OFFENSE_SCORE_WEIGHTS = {
  obpm:       0.40,
  ts_pct:     0.25,
  usg_pct:    0.20,
  pts_per_100: 0.15,
} as const

/**
 * Impact component (LPI v2). VORP is volume-inclusive by construction (it is
 * BPM scaled by minutes), which is what stops small-sample reserves from
 * matching full-workload stars.
 */
export const IMPACT_SCORE_WEIGHTS = {
  bpm:       0.45,
  vorp:      0.35,
  ws_per_48: 0.20,
} as const

/**
 * How many input factors each LPI component expects when data is complete.
 * Used to detect DEGRADED components: a component computed from a small
 * minority of its inputs still returns a plausible-looking 0-100 score, so the
 * shortfall has to be surfaced rather than inferred from the score alone.
 */
export const EXPECTED_FACTOR_COUNTS = {
  impact:     3,   // bpm, vorp, ws_per_48
  offense:    4,   // obpm, ts_pct, usg_pct, pts_per_100
  defense:    5,   // dbpm, dws, stl_pct, blk_pct, drb_pct
  playmaking: 2,   // ast_pct, ast_tov
  roleVolume: 2,   // total_minutes, minutes_per_game
} as const

/**
 * A component sourced from less than this share of its expected factors is
 * flagged degraded and the player is marked low_confidence.
 */
export const MIN_FACTOR_COVERAGE = 0.5

/** Role & Volume component (LPI v2) — workload actually absorbed. */
export const ROLE_VOLUME_SCORE_WEIGHTS = {
  total_minutes:   0.60,
  minutes_per_game: 0.40,
} as const

export const DEFENSE_SCORE_WEIGHTS = {
  dbpm:    0.50,
  dws:     0.20,
  stl_pct: 0.10,
  blk_pct: 0.10,
  drb_pct: 0.10,
} as const

export const PLAYMAKING_SCORE_WEIGHTS = {
  ast_pct: 0.70,   // absorbed the former 0.30 pga weight (pga removed — see playmaking.ts)
  ast_tov: 0.30,
} as const

// ─── Dedicated Leaderboard Weights ────────────────────────────────────────────

export const SCORING_SCORE_WEIGHTS = {
  volume:      0.35,   // points per 100 possessions
  ts_pct:      0.30,
  fg3_pct:     0.15,
  ft_creation: 0.10,   // fta_per_g from real league population
  consistency: 0.10,
} as const

export const SHOOTING_SCORE_WEIGHTS = {
  ts_pct:    0.35,
  efg_pct:   0.20,
  fg3_pct:   0.20,
  ft_pct:    0.10,
  fg3a_rate: 0.15,   // fg3a_per_g / fga_per_g
} as const

export const REBOUNDING_SCORE_WEIGHTS = {
  trb_pct: 0.55,
  drb_pct: 0.25,
  orb_pct: 0.20,
} as const

// ─── Tier Thresholds (score-based, NOT rank-based) ───────────────────────────
//
// LPI scores use percentile normalization + evidence shrinkage, producing a
// compressed distribution. An 82-game all-star peaks around 82-85.
// Thresholds are anchored to the ACTUAL output distribution, not a theoretical 0-100.
//
// Calibration anchor points (approximate):
//   ~83+   → top 1-3 players in the league        → Ω — Apex
//   ~80-83 → top 4-15 (All-NBA caliber)           → X — Mythic / S — Elite
//   ~75-80 → top 16-30 (All-Star level)           → A — Dominant / B — Impact
//   ~68-75 → solid starters                       → C — Rotation
//   ~58-68 → rotation players                     → D — Limited
//   <58    → fringe / end-of-bench               → E — Fringe

// Thresholds are anchored to the ACTUAL LPI v2 output distribution, NOT a
// theoretical 0-100 scale. Evidence shrinkage pulls every rate percentile toward
// 50, so scores compress: the league leader lands near 88 and the median
// qualified player near 54. Calibrated against the 2025-26 population
// (386 qualified players) so each tier maps to a real population share:
//
//   >= 84  top ~1%    (league-leader tier)      → Ω — Apex
//   >= 82  top ~2%                              → X — Mythic
//   >= 77.5 top ~5%   (All-NBA caliber)         → S — Elite
//   >= 73  top ~10%   (All-Star caliber)        → A — Dominant
//   >= 64  top ~25%   (quality starter)         → B — Impact
//   >= 54  top ~50%   (rotation regular)        → C — Rotation
//   >= 42  top ~80%   (limited role)            → D — Limited
//   <  42  bottom ~20%                          → E — Fringe
export const TIER_THRESHOLDS: Array<{ tier: RankingTier; min: number }> = [
  { tier: "Ω — Apex",      min: 84   },
  { tier: "X — Mythic",    min: 82   },
  { tier: "S — Elite",     min: 77.5 },
  { tier: "A — Dominant",  min: 73   },
  { tier: "B — Impact",    min: 64   },
  { tier: "C — Rotation",  min: 54   },
  { tier: "D — Limited",   min: 42   },
  { tier: "E — Fringe",    min: 0    },
]

export const TIER_COLORS: Record<RankingTier, string> = {
  "Ω — Apex":       "#FFD700",  // gold
  "X — Mythic":     "#F472B6",  // pink/mythic
  "S — Elite":      "#C084FC",  // purple
  "A — Dominant":   "#60A5FA",  // blue
  "B — Impact":     "#34D399",  // green
  "C — Rotation":   "#A3E635",  // lime
  "D — Limited":    "#94A3B8",  // slate
  "E — Fringe":     "#4B5563",  // dark gray
}

// ─── Age Adjustment Curve ─────────────────────────────────────────────────────

export const AGE_ADJUSTMENT: Record<number, number> = {
  18: 2.0,
  19: 2.0,
  20: 2.0,
  21: 2.0,
  22: 1.0,
  23: 1.0,
  24: 0.0,
  25: 0.0,
  26: 0.0,
  27: 0.0,
  28: -0.5,
  29: -0.5,
  30: -0.5,
  31: -1.0,
  32: -1.0,
  33: -1.5,
  34: -1.5,
  35: -2.0,
  36: -2.0,
  37: -2.0,
  38: -2.0,
  39: -2.0,
  40: -2.0,
}

export function getAgeAdjustment(age: number | null): number {
  if (age === null) return 0
  const clamped = Math.max(18, Math.min(40, age))
  return AGE_ADJUSTMENT[clamped] ?? 0
}

// ─── Qualification Thresholds ─────────────────────────────────────────────────

export const MIN_GAMES_FOR_RANKING = 20
export const MIN_MINUTES_FOR_RANKING = 400  // total minutes played this season

/** Never rank anyone below this many games, even in the season's first week. */
export const EARLY_SEASON_GAMES_FLOOR = 3
/** Minutes threshold is derived from the games threshold at this rate. */
export const MINUTES_PER_GAME_THRESHOLD = MIN_MINUTES_FOR_RANKING / MIN_GAMES_FOR_RANKING // 20

/**
 * Resolves the games/minutes thresholds for a run, ramping them up early in the
 * season. `maxLeagueGames` is the highest games-played count in the league for
 * the target season; pass 0/undefined for a completed season to use the full
 * 20-game / 400-minute bar.
 *
 * Why: daily in-season regeneration starts in late October when nobody has 20
 * games yet. A fixed 20-game bar would leave the board empty for ~6 weeks. The
 * threshold scales to half the league leader's games (floored at 3) and caps at
 * the full 20 once the leader passes 40 games — roughly late December.
 */
export function resolveQualification(maxLeagueGames = 0): { games: number; minutes: number } {
  if (!maxLeagueGames || maxLeagueGames >= MIN_GAMES_FOR_RANKING * 2) {
    return { games: MIN_GAMES_FOR_RANKING, minutes: MIN_MINUTES_FOR_RANKING }
  }
  const games = Math.max(
    EARLY_SEASON_GAMES_FLOOR,
    Math.min(MIN_GAMES_FOR_RANKING, Math.round(maxLeagueGames * 0.5))
  )
  return { games, minutes: games * MINUTES_PER_GAME_THRESHOLD }
}

/**
 * Single canonical qualification check — must be enforced everywhere.
 * Requires BOTH games AND minutes to prevent 1-game-wonder eligibility.
 *
 * Pass the resolved thresholds from resolveQualification() for in-season runs;
 * the defaults preserve the historical full-season 20/400 behavior so existing
 * callers are unchanged.
 */
export function isQualified(
  games_played: number,
  minutes_played: number,
  thresholds: { games: number; minutes: number } = { games: MIN_GAMES_FOR_RANKING, minutes: MIN_MINUTES_FOR_RANKING }
): boolean {
  return games_played >= thresholds.games && minutes_played >= thresholds.minutes
}

// ─── Leaderboard-Specific Thresholds ─────────────────────────────────────────

export const YOUNG_MAX_AGE = 25               // inclusive — age <= YOUNG_MAX_AGE
export const BREAKOUT_SCORE_DELTA = 5.0       // LPI must improve by at least this much
export const BREAKOUT_MIN_SCORE = 65          // LPI_26-27 must be >= this
export const DECLINE_SCORE_DELTA = -5.0       // LPI must decrease by at least this much (negative)

// ─── Tie-Breaking Order ───────────────────────────────────────────────────────

export const TIE_BREAKER_ORDER = [
  "score",
  "offense_score",
  "defense_score",
  "player_name",
] as const

// ─── Full Default Config ──────────────────────────────────────────────────────

export function buildDefaultConfig(
  season: string,
  historicalSeason: string,
  rankingVersion: string,
  rankingMode: import("./types").RankingMode = "projected",
  isDryRun = false
): RankingConfig {
  const weights: RankingWeights = {
    overall: OVERALL_WEIGHTS,
    team: TEAM_POWER_WEIGHTS as any,
    seasons: SEASON_WEIGHTS,
    projection: PROJECTION_WEIGHTS,
  }

  const rankingTypes: RankingType[] = [
    "overall",
    "offense",
    "defense",
    "scoring",
    "playmaking",
    "rebounding",
    "shooting",
    "two_way",
    "young",
    "breakout",
    "decline"
  ]

  return {
    season,
    historical_season: historicalSeason,
    ranking_version: rankingVersion,
    ranking_mode: rankingMode,
    algorithm_version: ALGORITHM_VERSION,
    weights,
    ranking_types: rankingTypes,
    min_games_for_ranking: MIN_GAMES_FOR_RANKING,
    min_minutes_for_ranking: MIN_MINUTES_FOR_RANKING,
    min_games_for_top100: MIN_GAMES_FOR_RANKING,
    top_n: 100,
    is_projection: rankingMode === "projected",
    dry_run: isDryRun,
  }
}
