import { createGame, placeBid, resolveLot, openNextLot, type ArenaState } from "@/lib/arena/auction"
import { decideAI } from "@/lib/arena/ai"
import { maxAffordable } from "@/lib/arena/budget"
import { isRosterComplete } from "@/lib/arena/roster"
import { runSimulation } from "@/lib/arena/game"
import { DEFAULT_CONFIG } from "@/lib/arena/types"

/**
 * Simulates a realistic HUMAN opponent (P1) against the AI (P2), draft + game,
 * many times, and checks the AI wins a healthy share. The "human" here uses a
 * decent-but-not-perfect strategy: chase value, don't overpay wildly.
 */

function humanBid(state: ArenaState): number | null {
  if (!state.lot) return null
  const roster = state.rosters.P1
  const player = state.lot.player
  const cap = maxAffordable(state.config.budgetPerPlayer, roster)
  const inc = state.config.bidIncrement || 1
  // First bid on an unclaimed lot takes it at the opening price; else raise by step.
  const next = state.lot.highBidder === null ? state.lot.currentBid : state.lot.currentBid + inc
  if (next > cap) return null
  // Human willingness: pay up to a budget-relative fraction based on tier.
  const frac = { 1: 0.34, 2: 0.22, 3: 0.14, 4: 0.09 }[player.tier]
  const tierMax = Math.max(1, Math.round(state.config.budgetPerPlayer * frac))
  if (next <= Math.min(tierMax, cap)) return next
  return null
}

function playDraft(seed: number): ArenaState {
  const state = createGame({ gameId: `h2h-${seed}`, config: { ...DEFAULT_CONFIG }, vsAI: true, seed })
  openNextLot(state)
  let guard = 0
  while (state.status === "auction" && guard++ < 6000) {
    if (!state.lot) { if (!openNextLot(state)) break; continue }
    let settled = false
    let inner = 0
    while (!settled && inner++ < 100 && state.lot) {
      const before = state.lot.currentBid
      // Human acts if not leading.
      if (state.lot.highBidder !== "P1") {
        const hb = humanBid(state)
        if (hb != null) placeBid(state, "P1", hb)
      }
      // AI acts if not leading.
      if (state.lot && state.lot.highBidder !== "P2") {
        const d = decideAI(state, "P2")
        if (d.action === "bid") placeBid(state, "P2", d.amount)
      }
      if (!state.lot) { settled = true; break }
      if (state.lot.currentBid === before) {
        resolveLot(state) // neither raised → award/skip
        settled = true
      }
    }
  }
  return state
}

describe("Arena — AI is competitive vs a decent human", () => {
  it("both rosters complete and AI wins a fair share of games", () => {
    let aiWins = 0
    const N = 40
    for (let i = 0; i < N; i++) {
      const state = playDraft(1000 + i)
      expect(isRosterComplete(state.rosters.P1)).toBe(true)
      expect(isRosterComplete(state.rosters.P2)).toBe(true)
      const r = runSimulation(state.rosters.P1, state.rosters.P2, "2025-26", state.seed + 1)
      if (r.winner === "P2") aiWins++
    }
    // Medium AI vs a reasonable human should be roughly competitive (~30%+).
    // (Hard difficulty adds a simulation execution edge on top of this; that's
    // exercised via runSimulation edges in the difficulty tests.)
    expect(aiWins).toBeGreaterThanOrEqual(N * 0.3)
    expect(aiWins).toBeLessThanOrEqual(N) // sanity
  })
})
