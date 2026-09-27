/**
 * Every auction that reaches "lineup" must be simulatable.
 *
 * The auto-sim watchdog (lib/hooks/simWatchdog.ts) guarantees the handoff is
 * *attempted*; this guarantees the attempt can actually succeed. It drives the
 * real engine — createGame → openNextLot → decideAI → resolveLot → finalizeAuction
 * → runSimulation — the same way useArenaGame does, across every budget preset,
 * every difficulty, and the human behaviours that stress roster filling:
 *
 *   "idle"     — never bids at all, so P1's entire roster comes from the
 *                autoFillIfNeeded fallback. This is the path that could leave a
 *                roster with fewer than 5 starters (autoFillIfNeeded gives up
 *                with `break`), which buildSimTeam/chooseBallHandler would then
 *                dereference as undefined and throw on — surfacing to the player
 *                as a hung or blank simulation screen.
 *   "maxbid"   — spends everything on the first lots, so later slots have to be
 *                filled at the minimum and the budget floor is exercised.
 *   "minraise" — contests every lot, the longest auctions.
 *
 * Asserts the state machine lands on "lineup" with two complete rosters and that
 * the sim returns a usable result — including a non-empty `moments` array, since
 * SimulationScreen paces its reveal off those and an empty list would strand the
 * player on a 0-0 scoreboard.
 */

import { describe, it, expect } from "vitest"
import {
  createGame,
  placeBid,
  resolveLot,
  openNextLot,
  minRaise,
  type ArenaState,
} from "@/lib/arena/auction"
import { decideAI } from "@/lib/arena/ai"
import { runSimulation, difficultyEdge } from "@/lib/arena/game"
import { isRosterComplete, starters, bench } from "@/lib/arena/roster"
import { maxAffordable } from "@/lib/arena/budget"
import {
  DEFAULT_CONFIG,
  BUDGET_PRESETS,
  bidIncrementForBudget,
  bestPersonalityForDifficulty,
  type AIDifficulty,
  type BudgetPreset,
  type TeamId,
} from "@/lib/arena/types"

type Human = "idle" | "maxbid" | "minraise"

const HUMAN: TeamId = "P1"
const CPU: TeamId = "P2"

/** Plays one local vs-CPU auction to completion, mirroring useArenaGame's loop. */
function playAuction(budget: BudgetPreset, difficulty: AIDifficulty, human: Human, seed: number): ArenaState {
  const state = createGame({
    gameId: `handoff-${budget}-${difficulty}-${human}-${seed}`,
    config: {
      ...DEFAULT_CONFIG,
      season: "2025-26",
      budgetPerPlayer: budget,
      bidIncrement: bidIncrementForBudget(budget),
      difficulty,
      aiPersonality: bestPersonalityForDifficulty(difficulty),
    },
    vsAI: true,
    seed,
  })
  openNextLot(state)

  // Hard cap so a regression fails the assertion instead of hanging the suite.
  let guard = 0
  while (state.status === "auction" && guard++ < 20_000) {
    if (!state.lot) {
      if (!openNextLot(state)) break
      continue
    }

    // Human acts (bid / bidMax); "idle" just lets the clock run.
    if (state.lot.highBidder !== HUMAN) {
      if (human === "maxbid") {
        const max = maxAffordable(state.config.budgetPerPlayer, state.rosters[HUMAN])
        if (max > state.lot.currentBid) placeBid(state, HUMAN, max)
      } else if (human === "minraise") {
        const next = minRaise(state, HUMAN)
        if (next != null) placeBid(state, HUMAN, next)
      }
    }
    if (state.status !== "auction" || !state.lot) continue

    // CPU reaction, as the AI effect does.
    if (state.lot.highBidder !== CPU) {
      const decision = decideAI(state, CPU)
      if (decision.action === "bid") placeBid(state, CPU, decision.amount)
    }
    if (state.status !== "auction" || !state.lot) continue

    // Timer expiry.
    resolveLot(state)
  }

  return state
}

describe("auction → lineup → simulation handoff", () => {
  const cases: { budget: BudgetPreset; difficulty: AIDifficulty; human: Human }[] = []
  for (const budget of BUDGET_PRESETS) {
    for (const difficulty of ["easy", "medium", "hard"] as AIDifficulty[]) {
      for (const human of ["idle", "maxbid", "minraise"] as Human[]) {
        cases.push({ budget, difficulty, human })
      }
    }
  }

  it.each(cases)(
    "$budget / $difficulty / human=$human reaches a simulatable lineup",
    ({ budget, difficulty, human }) => {
      for (let seed = 1; seed <= 4; seed++) {
        const state = playAuction(budget, difficulty, human, seed)

        expect(state.status, `seed ${seed} never left the auction`).toBe("lineup")

        for (const team of [HUMAN, CPU] as TeamId[]) {
          expect(
            isRosterComplete(state.rosters[team]),
            `seed ${seed}: ${team} roster incomplete (${starters(state.rosters[team]).length} starters, bench=${bench(state.rosters[team]) ? 1 : 0})`
          ).toBe(true)
          // buildSimTeam assumes a full starting five; anything less throws
          // inside the sim and blanks the screen.
          expect(starters(state.rosters[team])).toHaveLength(5)
        }

        const result = runSimulation(state.rosters.P1, state.rosters.P2, state.season, state.seed, {
          P1: state.isAI.P1 ? difficultyEdge(state.config.difficulty) : 0,
          P2: state.isAI.P2 ? difficultyEdge(state.config.difficulty) : 0,
        })

        expect(typeof result.finalScore.p1).toBe("number")
        expect(typeof result.finalScore.p2).toBe("number")
        expect(result.winner === "P1" || result.winner === "P2").toBe(true)
        // SimulationScreen walks these to animate the scoreboard.
        expect(result.moments.length).toBeGreaterThan(0)
        expect(result.quarters.length).toBeGreaterThanOrEqual(4)
      }
    }
  )
})
