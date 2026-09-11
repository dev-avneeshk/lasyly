/**
 * Server-side orchestration helpers for the authoritative Arena API.
 *
 * Keeps route handlers thin: they load state, apply a validated transition,
 * let the AI seat respond, tick the clock, persist, and return a client-safe
 * view. The client never decides budgets, ownership, or winners — it only
 * proposes bids/passes which the server validates against the same pure engine.
 */

import {
  placeBid,
  resolveLot,
  openNextLot,
  minRaise,
  type ArenaState,
} from "./auction"
import { decideAI } from "./ai"
import { snapshot } from "./budget"
import { runSimulation, difficultyEdge } from "./game"
import type { GameResult, GameStatus, TeamId } from "./types"
import type { StoredGame } from "./store"

/**
 * Resolve which seat a user controls, or null if they're a spectator/unknown.
 * Owner → P1, joined guest → P2. For CPU games only the owner (P1) is a human.
 */
export function seatForUser(game: StoredGame, userId: string): TeamId | null {
  if (game.ownerUserId === userId) return "P1"
  if (game.guestUserId && game.guestUserId === userId) return "P2"
  return null
}

/** Advance all AI seats until it's the humans' turn or the lot resolves. */
export function driveAI(state: ArenaState, maxSteps = 20): void {
  if (state.status !== "auction") return
  let steps = 0
  while (state.lot && steps++ < maxSteps) {
    let acted = false
    for (const seat of ["P1", "P2"] as TeamId[]) {
      if (!state.isAI[seat]) continue
      if (!state.lot) break
      if (state.lot.highBidder === seat) continue
      const d = decideAI(state, seat)
      if (d.action === "bid") {
        const r = placeBid(state, seat, d.amount)
        if (r.ok) acted = true
      }
      // If the AI declines, it does NOT call pass() — that would auto-resolve
      // the lot instantly (the "sold every bid" bug). Instead it stands pat and
      // the countdown deadline resolves the lot via serverTick, giving a real
      // "going once… SOLD" beat. (Mirrors the local client behavior.)
    }
    if (!acted) break
  }
}

/**
 * Apply the server clock: if the lot deadline passed, resolve it and open the
 * next lot; then let AI respond to the new lot.
 */
export function serverTick(state: ArenaState, now = Date.now()): void {
  if (state.status !== "auction") return
  if (!state.lot) {
    openNextLot(state)
  } else if (state.lotDeadline !== null && now >= state.lotDeadline) {
    resolveLot(state)
  }
  driveAI(state)
  // If the auction just finished (resolveLot/openNextLot can flip status to
  // "lineup"), precompute + cache the sim once here — inside the mutate — so
  // it's persisted and never recomputed on polls. (Cast: TS can't see that the
  // calls above mutated `status` away from "auction".)
  if ((state.status as GameStatus) === "lineup") ensureResult(state)
}

/**
 * Compute the simulation ONCE and cache it on the state. This MUST only be
 * called inside a mutateGame (so the cached result is persisted). Calling it
 * from a read path would re-simulate on every request.
 */
export function ensureResult(state: ArenaState): GameResult | null {
  if (state.status === "lobby" || state.status === "auction") return null
  if (state.result) return state.result
  const edges: Record<TeamId, number> = {
    P1: state.isAI.P1 ? difficultyEdge(state.config.difficulty) : 0,
    P2: state.isAI.P2 ? difficultyEdge(state.config.difficulty) : 0,
  }
  state.result = runSimulation(state.rosters.P1, state.rosters.P2, state.season, state.seed, edges)
  return state.result
}

/**
 * A client-safe projection of the game. We expose everything both participants
 * are allowed to see (this is a 1v1 open-information auction), plus derived
 * budgets and the human's legal min-raise, but the AUTHORITY stays server-side.
 */
export function serverView(state: ArenaState, viewer: TeamId, rev: number) {
  // Read-only: never simulate here. The result is computed once inside a
  // mutate (serverTick → lineup, or startSimulation) and persisted on state.
  const result = state.result ?? null
  return {
    rev,
    gameId: state.gameId,
    season: state.season,
    status: state.status,
    config: state.config,
    viewer,
    lot: state.lot,
    lotDeadline: state.lotDeadline,
    passed: state.passed,
    isAI: state.isAI,
    rosters: state.rosters,
    results: state.results,
    history: state.history.slice(-20),
    budgets: {
      P1: snapshot(state.config.budgetPerPlayer, state.rosters.P1),
      P2: snapshot(state.config.budgetPerPlayer, state.rosters.P2),
    },
    minRaise: {
      P1: minRaise(state, "P1"),
      P2: minRaise(state, "P2"),
    },
    result,
    completedAt: state.completedAt,
  }
}

export type ArenaServerView = ReturnType<typeof serverView>

/** Force the game into simulation/complete (used by the "simulate" action). */
export function startSimulation(state: ArenaState): void {
  if (state.status === "lineup") {
    ensureResult(state)
    state.status = "complete"
    state.completedAt = Date.now()
  }
}
