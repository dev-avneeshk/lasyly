/**
 * NBA Ranking Engine — Availability Score
 *
 * Measures a player's availability and reliability — NOT their talent.
 * A player who plays 82 games gets full marks; one who plays 20 gets low marks.
 *
 * This score is metadata only; it never enters core LPI. Projection uses the
 * separate locked games-played adjustment in projection.ts.
 *
 * Formula:
 *   60% games_played_pct   — games_played / 82
 *   25% minutes_reliability — low variance in minutes = reliable role
 *   15% historical_trend    — multi-season games average (is health improving?)
 *
 * Returns both the score and a `confidence` value (0-1) used to
 * scale down uncertain projections.
 */

import { clampScore, orDefault } from "../normalize"
const AVAILABILITY_SCORE_WEIGHTS = {
  games_played_pct: 0.60,
  minutes_reliability: 0.25,
  historical_trend: 0.15,
}

export interface AvailabilityScoreInput {
  games_played: number
  full_season_games: number    // 82 for full NBA season
  minutes_per_game: number
  prior_games_played: number[] // e.g., [65, 71, 58] from prior seasons, most recent first
}

export interface AvailabilityScoreResult {
  score: number          // 0-100
  confidence: number     // 0-100 public metadata scale
  games_played_pct: number
  minutes_reliability: number
  historical_trend: number
  low_confidence: boolean
}

export function computeAvailabilityScore(
  input: AvailabilityScoreInput
): AvailabilityScoreResult {
  const { games_played, full_season_games = 82, minutes_per_game, prior_games_played } = input

  // ── Games Played % (60%) ──────────────────────────────────────────────────
  const games_played_pct_raw = Math.min(games_played / full_season_games, 1)
  const games_played_pct = clampScore(games_played_pct_raw * 100)

  // ── Minutes Reliability (25%) ─────────────────────────────────────────────
  // A stable role (consistent minutes) = high reliability
  // Proxy: minutes_per_game as fraction of "full starter" minutes (36 mpg)
  // A player averaging 36 MPG with high variance is penalized here
  // We don't have per-game MPG variance here, so we use MPG as proxy:
  // 36+ MPG = 100, 30-35 = 80, 20-29 = 60, 10-19 = 40, <10 = 20
  const minutes_reliability =
    minutes_per_game >= 36 ? 100 :
    minutes_per_game >= 30 ? 80 :
    minutes_per_game >= 20 ? 60 :
    minutes_per_game >= 10 ? 40 : 20

  // ── Historical Trend (15%) ────────────────────────────────────────────────
  // Average games played across prior seasons (if available)
  let historical_trend = 50  // neutral if no prior data
  if (prior_games_played.length > 0) {
    const avgPriorGames = prior_games_played.reduce((s, g) => s + g, 0) / prior_games_played.length
    historical_trend = clampScore((avgPriorGames / full_season_games) * 100)
  }

  // ── Weighted Combination ──────────────────────────────────────────────────
  const score = clampScore(
    games_played_pct * AVAILABILITY_SCORE_WEIGHTS.games_played_pct +
    minutes_reliability * AVAILABILITY_SCORE_WEIGHTS.minutes_reliability +
    historical_trend * AVAILABILITY_SCORE_WEIGHTS.historical_trend
  )

  // ── Confidence ────────────────────────────────────────────────────────────
  // How much to trust this player's stats for projection purposes.
  // Based primarily on games played: 5 games = 0.10, 82 games = 1.0
  // Square root scale: penalizes small samples aggressively
  const confidence = clampScore(Math.sqrt(games_played_pct_raw) * 100)

  // ── Low Confidence Flag ───────────────────────────────────────────────────
  const low_confidence = games_played < 20

  return {
    score,
    confidence,
    games_played_pct,
    minutes_reliability,
    historical_trend,
    low_confidence,
  }
}
