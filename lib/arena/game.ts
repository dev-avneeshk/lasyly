/**
 * Top-level Arena facade — ties the engine pieces together for both the
 * client runner and the server routes.
 */

import type { AIDifficulty, GameResult, RosterState, Season, TeamId } from "./types"
import { simulateGame } from "./simulation"
import { analyzeResult } from "./analysis"
import { buildTeamProfile, type TeamProfile } from "./teamRating"

/**
 * A small per-possession shot-probability edge applied to a CPU seat based on
 * difficulty — the standard "AI plays better on higher difficulty" knob in
 * sports games, layered on top of drafting. Human seats get 0.
 */
export function difficultyEdge(difficulty: AIDifficulty): number {
  switch (difficulty) {
    case "easy": return -0.03 // CPU executes worse
    case "hard": return 0.035 // CPU executes better
    case "medium":
    default: return 0
  }
}

/** Run the simulation and attach the human-readable analysis. */
export function runSimulation(
  rosterP1: RosterState,
  rosterP2: RosterState,
  season: Season,
  seed: number,
  edges: Record<TeamId, number> = { P1: 0, P2: 0 }
): GameResult {
  const raw = simulateGame(rosterP1, rosterP2, season, seed, edges)
  return analyzeResult(raw, rosterP1, rosterP2)
}

export function teamProfiles(
  rosterP1: RosterState,
  rosterP2: RosterState
): Record<TeamId, TeamProfile> {
  return {
    P1: buildTeamProfile("P1", rosterP1),
    P2: buildTeamProfile("P2", rosterP2),
  }
}

export * from "./types"
export { getSeasonPlayers, findPlayer, AVAILABLE_SEASONS, DEFAULT_SEASON } from "./data"
export { DEFAULT_CONFIG } from "./types"
