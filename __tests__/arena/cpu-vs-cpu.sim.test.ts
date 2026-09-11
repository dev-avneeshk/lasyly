/**
 * CPU vs CPU tournament harness.
 *
 * Drives the REAL auction engine (auction.ts) + AI (ai.ts) + simulation
 * (simulation.ts) with a DIFFERENT strategy on each seat. No engine changes, no
 * fixed/rigged outcomes — every bid comes from decideAI() and every game from
 * simulateGame(). We just vary which (difficulty × personality) each seat uses,
 * play a full auction, simulate the game, and tally who wins.
 *
 * Run with:  npx vitest run __tests__/arena/cpu-vs-cpu.sim.test.ts --reporter=basic
 */

import { it } from "vitest"
import { writeFileSync } from "node:fs"
import {
  createGame,
  placeBid,
  resolveLot,
  openNextLot,
  type ArenaState,
} from "@/lib/arena/auction"
import { decideAI } from "@/lib/arena/ai"
import { runSimulation, difficultyEdge } from "@/lib/arena/game"
import { isRosterComplete } from "@/lib/arena/roster"
import {
  DEFAULT_CONFIG,
  type AIDifficulty,
  type AIPersonality,
  type TeamId,
} from "@/lib/arena/types"

const DIFFICULTIES: AIDifficulty[] = ["easy", "medium", "hard"]
const PERSONALITIES: AIPersonality[] = [
  "balanced",
  "aggressive",
  "value",
  "superstar",
  "defense",
  "offense",
]
const BUDGETS = [25, 50, 100]
const GAMES_PER_MATCHUP = 50

interface Strategy {
  difficulty: AIDifficulty
  personality: AIPersonality
}

const label = (s: Strategy) => `${s.difficulty}/${s.personality}`

/**
 * Run one full CPU-vs-CPU auction where P1 and P2 use DIFFERENT strategies.
 *
 * Since decideAI/walkAwayPrice read strategy from state.config, we temporarily
 * swap the config to the acting seat's strategy for each decision, then restore.
 * This lets the two seats genuinely play different approaches through the exact
 * same engine code.
 */
function driveAuctionTwoStrategies(state: ArenaState, sP1: Strategy, sP2: Strategy): void {
  const stratOf: Record<TeamId, Strategy> = { P1: sP1, P2: sP2 }
  const baseConfig = state.config

  // Hard cap on iterations so a bug can never hang the suite.
  let guard = 0
  while (state.status === "auction" && guard++ < 5000) {
    if (!state.lot) {
      const opened = openNextLot(state)
      if (!opened) break
      continue
    }

    let acted = false
    for (const seat of ["P1", "P2"] as TeamId[]) {
      if (!state.lot) break
      if (isRosterComplete(state.rosters[seat])) continue
      if (state.lot.highBidder === seat) continue

      // Swap in this seat's strategy for the decision.
      const strat = stratOf[seat]
      state.config = {
        ...baseConfig,
        difficulty: strat.difficulty,
        aiPersonality: strat.personality,
      }
      const decision = decideAI(state, seat)
      state.config = baseConfig

      if (decision.action === "bid") {
        const r = placeBid(state, seat, decision.amount)
        if (r.ok) acted = true
      }
    }

    // Nobody raised → the lot is settled; resolve it (mirrors timer expiry).
    if (!acted) {
      resolveLot(state)
    }
  }
}

interface MatchOutcome {
  winner: TeamId
  p1: number
  p2: number
}

/** Play ONE complete game (auction + sim) and return the outcome. */
function playGame(
  budget: number,
  sP1: Strategy,
  sP2: Strategy,
  seed: number
): MatchOutcome {
  const state = createGame({
    gameId: `sim-${budget}-${label(sP1)}-vs-${label(sP2)}-${seed}`,
    seed,
    vsAI: true,
    config: {
      ...DEFAULT_CONFIG,
      budgetPerPlayer: budget,
    },
  })
  // Both seats are CPU.
  state.isAI = { P1: true, P2: true }

  driveAuctionTwoStrategies(state, sP1, sP2)

  // Per-seat execution edge from each seat's OWN difficulty (not a shared one).
  const edges: Record<TeamId, number> = {
    P1: difficultyEdge(sP1.difficulty),
    P2: difficultyEdge(sP2.difficulty),
  }
  const result = runSimulation(state.rosters.P1, state.rosters.P2, state.season, state.seed, edges)
  return {
    winner: result.winner,
    p1: result.finalScore.p1,
    p2: result.finalScore.p2,
  }
}

interface Tally {
  wins: number
  played: number
}
const key = (s: Strategy) => label(s)

it(
  "CPU vs CPU tournament: which approach wins",
  { timeout: 600_000 },
  () => {
    const strategies: Strategy[] = []
    for (const d of DIFFICULTIES) {
      for (const p of PERSONALITIES) {
        strategies.push({ difficulty: d, personality: p })
      }
    }

    const out: string[] = []
    const p = (s = "") => out.push(s)

    // Combined tally across ALL budgets/modes.
    const global = new Map<string, Tally>()
    for (const s of strategies) global.set(key(s), { wins: 0, played: 0 })

    // Per-difficulty and per-personality aggregate (isolating each dimension).
    const byDifficulty = new Map<string, Tally>()
    const byPersonality = new Map<string, Tally>()
    for (const d of DIFFICULTIES) byDifficulty.set(d, { wins: 0, played: 0 })
    for (const pn of PERSONALITIES) byPersonality.set(pn, { wins: 0, played: 0 })

    for (const budget of BUDGETS) {
      const overall = new Map<string, Tally>()
      for (const s of strategies) overall.set(key(s), { wins: 0, played: 0 })

      for (let i = 0; i < strategies.length; i++) {
        for (let j = i + 1; j < strategies.length; j++) {
          const a = strategies[i]
          const b = strategies[j]
          let aWins = 0
          let bWins = 0
          // Alternate which strategy sits in the P1 seat every other game to
          // cancel any first-possession / seat bias. Same seeds either way.
          for (let g = 0; g < GAMES_PER_MATCHUP; g++) {
            const seed = (budget * 1_000_003 + i * 9973 + j * 97 + g * 7 + 1) >>> 0
            const swap = g % 2 === 1
            const sP1 = swap ? b : a
            const sP2 = swap ? a : b
            const res = playGame(budget, sP1, sP2, seed)
            const winnerStrat = res.winner === "P1" ? sP1 : sP2
            if (winnerStrat === a) aWins++
            else bWins++
          }
          for (const [strat, w] of [
            [a, aWins],
            [b, bWins],
          ] as const) {
            overall.get(key(strat))!.wins += w
            overall.get(key(strat))!.played += GAMES_PER_MATCHUP
            global.get(key(strat))!.wins += w
            global.get(key(strat))!.played += GAMES_PER_MATCHUP
            byDifficulty.get(strat.difficulty)!.wins += w
            byDifficulty.get(strat.difficulty)!.played += GAMES_PER_MATCHUP
            byPersonality.get(strat.personality)!.wins += w
            byPersonality.get(strat.personality)!.played += GAMES_PER_MATCHUP
          }
        }
      }

      const ranked = rank(overall)
      p(`\n================ BUDGET $${budget} / player ================`)
      p(`Strategies ranked by win% (${GAMES_PER_MATCHUP} games/matchup, ${strategies.length} strategies):`)
      for (const r of ranked) p(fmtRow(r))
    }

    p(`\n\n########  GLOBAL RANKING (all 3 budgets combined)  ########`)
    p(`Each strategy = a (difficulty × personality) approach. Higher win% = better.`)
    for (const r of rank(global)) p(fmtRow(r))

    p(`\n----  Isolated by DIFFICULTY (averaged over all personalities/budgets)  ----`)
    for (const r of rank(byDifficulty)) p(fmtRow(r))

    p(`\n----  Isolated by PERSONALITY (averaged over all difficulties/budgets)  ----`)
    for (const r of rank(byPersonality)) p(fmtRow(r))

    const best = rank(global)[0]
    p(`\n>>> BEST OVERALL APPROACH: ${best.k}  (${best.pct.toFixed(1)}% win rate over ${best.played} games)`)

    // ── PHASE 2: personality-only tournament at FIXED difficulty ────────────
    // Difficulty dwarfs personality, so to fairly compare APPROACHES we lock
    // both seats to the same difficulty and vary only personality. Run at each
    // difficulty so we can see if the best personality changes with skill.
    p(`\n\n########  PERSONALITY-ONLY (both seats same difficulty)  ########`)
    for (const diff of DIFFICULTIES) {
      const pTally = new Map<string, Tally>()
      for (const pn of PERSONALITIES) pTally.set(pn, { wins: 0, played: 0 })
      for (const budget of BUDGETS) {
        for (let i = 0; i < PERSONALITIES.length; i++) {
          for (let j = i + 1; j < PERSONALITIES.length; j++) {
            const a: Strategy = { difficulty: diff, personality: PERSONALITIES[i] }
            const b: Strategy = { difficulty: diff, personality: PERSONALITIES[j] }
            let aWins = 0
            let bWins = 0
            for (let g = 0; g < GAMES_PER_MATCHUP; g++) {
              const seed = (budget * 7_000_037 + i * 6971 + j * 131 + g * 11 + 3) >>> 0
              const swap = g % 2 === 1
              const sP1 = swap ? b : a
              const sP2 = swap ? a : b
              const res = playGame(budget, sP1, sP2, seed)
              const winnerStrat = res.winner === "P1" ? sP1 : sP2
              if (winnerStrat.personality === a.personality) aWins++
              else bWins++
            }
            pTally.get(a.personality)!.wins += aWins
            pTally.get(a.personality)!.played += GAMES_PER_MATCHUP
            pTally.get(b.personality)!.wins += bWins
            pTally.get(b.personality)!.played += GAMES_PER_MATCHUP
          }
        }
      }
      p(`\n--- difficulty=${diff} (personalities head-to-head, all budgets) ---`)
      for (const r of rank(pTally)) p(fmtRow(r))
      p(`   winner @ ${diff}: ${rank(pTally)[0].k}`)
    }

    const text = out.join("\n")
    writeFileSync("/Users/ayushkumar/development/betroom/.backups/cpu-vs-cpu-results.txt", text)
    // eslint-disable-next-line no-console
    console.log(text)
  }
)

function rank(m: Map<string, Tally>) {
  return [...m.entries()]
    .map(([k, t]) => ({ k, ...t, pct: t.played ? (t.wins / t.played) * 100 : 0 }))
    .sort((x, y) => y.pct - x.pct)
}

function fmtRow(r: { k: string; wins: number; played: number; pct: number }): string {
  return `  ${r.k.padEnd(22)} ${r.wins.toString().padStart(5)}/${r.played
    .toString()
    .padEnd(5)}  ${r.pct.toFixed(1)}%`
}
