/**
 * Matchup Grade Computation Module
 *
 * Computes a letter grade (A-F) representing how favorable the opposing
 * defense is for a specific stat category. Higher defensive value (more
 * points/stats allowed) = more favorable matchup = higher grade.
 *
 * Pure computation module with no side effects.
 */

export type MatchupGrade = "A" | "B" | "C" | "D" | "F";

/** @deprecated Use MatchupGrade instead */
export type Grade = MatchupGrade;

/**
 * Computes a matchup grade based on the opponent's defensive stat value
 * relative to all teams in the dataset.
 *
 * The grade is determined by percentile rank (sorted descending — highest
 * defensive value = most favorable = top percentile):
 * - A: top 20% (most favorable matchup)
 * - B: 21st–40th percentile
 * - C: 41st–60th percentile
 * - D: 61st–80th percentile
 * - F: bottom 20% (toughest defense)
 *
 * @param opponentDefensiveValue - The opponent's defensive stat value (e.g., points allowed per game)
 * @param allTeamValues - Array of all teams' defensive stat values for the same category
 * @param opponentGamesPlayed - Number of games the opponent has played (for minimum data check)
 * @returns The matchup grade, or null if insufficient data
 */
export function computeMatchupGrade(
  opponentDefensiveValue: number,
  allTeamValues: number[],
  opponentGamesPlayed?: number
): MatchupGrade | null {
  // Return null if fewer than 5 teams in dataset (percentile ranking unreliable)
  if (allTeamValues.length < 5) {
    return null;
  }

  // Return null if opponent has fewer than 3 games of defensive data
  if (opponentGamesPlayed !== undefined && opponentGamesPlayed < 3) {
    return null;
  }

  // Sort descending: highest value (most points allowed) = most favorable = rank 1
  const sorted = [...allTeamValues].sort((a, b) => b - a);

  // Find the rank of the opponent's value (1-indexed position in sorted array)
  // If the value appears multiple times, use the first occurrence (best rank)
  const index = sorted.indexOf(opponentDefensiveValue);

  // If the opponent's value isn't in the dataset, find where it would rank
  // by counting how many values are strictly greater
  const effectiveIndex =
    index >= 0 ? index : sorted.filter((v) => v > opponentDefensiveValue).length;

  // Compute percentile as (position + 1) / total — 1-indexed rank divided by count
  const percentile = (effectiveIndex + 1) / sorted.length;

  return percentileToGrade(percentile);
}

/**
 * Maps a percentile (0 to 1) to a matchup grade.
 * Percentile represents position from the top (lower = better rank).
 *
 * - Top 20% (percentile <= 0.20): A
 * - 21st–40th (percentile <= 0.40): B
 * - 41st–60th (percentile <= 0.60): C
 * - 61st–80th (percentile <= 0.80): D
 * - Bottom 20% (percentile > 0.80): F
 */
export function percentileToGrade(percentile: number): MatchupGrade {
  if (percentile <= 0.2) return "A";
  if (percentile <= 0.4) return "B";
  if (percentile <= 0.6) return "C";
  if (percentile <= 0.8) return "D";
  return "F";
}

/**
 * Returns the display color for a matchup grade.
 *
 * - green: A or B (favorable matchup)
 * - yellow: C (neutral matchup)
 * - red: D or F (tough matchup)
 */
export function getGradeColor(grade: MatchupGrade): "green" | "yellow" | "red" {
  switch (grade) {
    case "A":
    case "B":
      return "green";
    case "C":
      return "yellow";
    case "D":
    case "F":
      return "red";
  }
}
