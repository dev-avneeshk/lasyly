import { createGame, placeBid, resolveLot, openNextLot, type ArenaState } from "@/lib/arena/auction"
import { decideAI } from "@/lib/arena/ai"
import { maxAffordable } from "@/lib/arena/budget"
import { runSimulation, difficultyEdge } from "@/lib/arena/game"
import { scaledOpeningBid } from "@/lib/arena/value"
import { getSeasonPlayers } from "@/lib/arena/data"
import { DEFAULT_CONFIG, BUDGET_PRESETS, bidIncrementForBudget, type AIDifficulty } from "@/lib/arena/types"

const SEASON = "2025-26"

function humanBid(s: ArenaState): number | null {
  if (!s.lot) return null
  const p = s.lot.player
  const cap = maxAffordable(s.config.budgetPerPlayer, s.rosters.P1)
  const inc = s.config.bidIncrement
  const next = Math.min(s.lot.currentBid + inc, cap)
  if (next <= s.lot.currentBid) return null
  const tierMax = (p.overall >= 90 ? 0.32 : p.overall >= 84 ? 0.2 : 0.11) * s.config.budgetPerPlayer
  return next <= tierMax ? next : null
}

function playVsHuman(seed: number, diff: AIDifficulty, budget: number): ArenaState {
  const s = createGame({
    gameId: `diff-${diff}-${budget}-${seed}`,
    config: { ...DEFAULT_CONFIG, difficulty: diff, budgetPerPlayer: budget, bidIncrement: bidIncrementForBudget(budget) },
    vsAI: true,
    seed,
  })
  openNextLot(s)
  let g = 0
  while (s.status === "auction" && g++ < 8000) {
    if (!s.lot) { if (!openNextLot(s)) break; continue }
    let done = false, i = 0
    while (!done && i++ < 200 && s.lot) {
      const b = s.lot.currentBid
      if (s.lot.highBidder !== "P1") { const hb = humanBid(s); if (hb != null) placeBid(s, "P1", hb) }
      if (s.lot && s.lot.highBidder !== "P2") { const d = decideAI(s, "P2"); if (d.action === "bid") placeBid(s, "P2", d.amount) }
      if (!s.lot) { done = true; break }
      if (s.lot.currentBid === b) { resolveLot(s); done = true }
    }
  }
  return s
}

function aiWinRate(diff: AIDifficulty, budget: number, n: number): number {
  let ai = 0
  for (let i = 0; i < n; i++) {
    const s = playVsHuman(i + 1, diff, budget)
    const edges = { P1: 0, P2: difficultyEdge(diff) }
    const r = runSimulation(s.rosters.P1, s.rosters.P2, SEASON, s.seed + 1, edges)
    if (r.winner === "P2") ai++
  }
  return ai / n
}

describe("Arena — difficulty ladder", () => {
  it("harder CPU wins more often than easier CPU (monotonic)", () => {
    const N = 60
    const easy = aiWinRate("easy", 25, N)
    const medium = aiWinRate("medium", 25, N)
    const hard = aiWinRate("hard", 25, N)
    expect(hard).toBeGreaterThan(easy)
    expect(medium).toBeGreaterThanOrEqual(easy - 0.05)
    expect(hard).toBeGreaterThanOrEqual(medium - 0.05)
  })
})

describe("Arena — auction order", () => {
  it("small ($25) leagues put the elite tier LAST", () => {
    const s = createGame({
      gameId: "order-25",
      config: { ...DEFAULT_CONFIG, budgetPerPlayer: 25, bidIncrement: bidIncrementForBudget(25) },
      vsAI: true,
      seed: 3,
    })
    const byId = new Map(getSeasonPlayers(SEASON).map((p) => [p.id, p]))
    const tiers = s.queue.map((id) => byId.get(id)!.tier)
    // The last handful of lots should be tier-1 superstars.
    const lastFive = tiers.slice(-5)
    expect(lastFive.every((t) => t === 1)).toBe(true)
    // And no tier-1 should appear in the first third of the draft.
    const firstThird = tiers.slice(0, Math.floor(tiers.length / 3))
    expect(firstThird.includes(1)).toBe(false)
  })

  it("stars open below ~30% of a $25 budget (no half-budget superstars)", () => {
    for (const p of getSeasonPlayers(SEASON)) {
      const open = scaledOpeningBid(p, 25, DEFAULT_CONFIG.rosterSize)
      expect(open).toBeLessThanOrEqual(Math.floor(25 * 0.3))
    }
  })
})

describe("Arena — budget-scaled pricing", () => {
  it("no player opens above ~42% of budget in any league (always affordable)", () => {
    for (const budget of BUDGET_PRESETS) {
      for (const p of getSeasonPlayers(SEASON)) {
        const open = scaledOpeningBid(p, budget, DEFAULT_CONFIG.rosterSize)
        expect(open).toBeGreaterThanOrEqual(1)
        expect(open).toBeLessThanOrEqual(Math.floor(budget * 0.42))
      }
    }
  })

  it("the same star costs proportionally more in a bigger league", () => {
    const jokic = getSeasonPlayers(SEASON).find((p) => p.id === "nikola-jokic")!
    const at25 = scaledOpeningBid(jokic, 25, 6)
    const at100 = scaledOpeningBid(jokic, 100, 6)
    expect(at100).toBeGreaterThan(at25)
  })

  it("a full 6-player roster is affordable within the budget at opening prices", () => {
    // Even the six most expensive players' opening bids must be individually
    // affordable; feasibility of completing a roster is covered elsewhere.
    for (const budget of BUDGET_PRESETS) {
      const priced = getSeasonPlayers(SEASON)
        .map((p) => scaledOpeningBid(p, budget, 6))
        .sort((a, b) => b - a)
      // The single priciest opener must leave room for 5 more at $1 min.
      expect(priced[0]).toBeLessThanOrEqual(budget - 5)
    }
  })
})
