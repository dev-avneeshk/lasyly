/**
 * Regression tests for auction lot selection.
 *
 * Bug: with the human needing PF + C and the CPU needing only its bench slot,
 * the engine put a PG/SG up for auction on one of the last lots. The human got
 * "No open slot for this player" and, with the queue exhausted, was silently
 * auto-filled with $1 scrubs instead of ever being offered a PF or a C.
 */

import {
  createGame,
  openNextLot,
  buildAuctionOrder,
  placeBid,
  resolveLot,
  type ArenaState,
} from "@/lib/arena/auction"
import { decideAI } from "@/lib/arena/ai"
import { getSeasonPlayers } from "@/lib/arena/data"
import {
  emptyRoster,
  placePlayer,
  eligiblePositions,
  isRosterComplete,
  orderedRoster,
} from "@/lib/arena/roster"
import { DEFAULT_CONFIG, POSITIONS, type Position, type TeamId } from "@/lib/arena/types"
import { mulberry32 } from "@/lib/arena/rng"

const SEASON = "2025-26"
const pool = () => getSeasonPlayers(SEASON)

/** First pool player eligible for `pos` that isn't already used. */
function pick(used: Set<string>, pos: Position | "ANY") {
  const p = pool().find(
    (x) =>
      !used.has(x.id) &&
      (pos === "ANY" || eligiblePositions(x).includes(pos))
  )
  if (!p) throw new Error(`no player available for ${pos}`)
  used.add(p.id)
  return p
}

function baseGame(): ArenaState {
  const state = createGame({
    gameId: "lot-selection-test",
    seed: 42,
    vsAI: true,
    config: { ...DEFAULT_CONFIG, budgetPerPlayer: 50 },
  })
  state.isAI = { P1: false, P2: true }
  return state
}

describe("lot selection — need-aware ordering", () => {
  it("offers a needed starter position instead of bench-only fodder", () => {
    const state = baseGame()
    const used = new Set<string>()

    // P1 (human): PG, SG, SF, BENCH filled → still needs PF and C.
    let p1 = emptyRoster()
    for (const pos of ["PG", "SG", "SF"] as Position[]) {
      p1 = placePlayer(p1, pick(used, pos), 5, pos)
    }
    p1 = placePlayer(p1, pick(used, "ANY"), 5, "BENCH")

    // P2 (CPU): all five starters filled → only BENCH open.
    let p2 = emptyRoster()
    for (const pos of POSITIONS) {
      p2 = placePlayer(p2, pick(used, pos), 5, pos)
    }

    state.rosters = { P1: p1, P2: p2 }

    // Queue: a bench-only guard first (fits nobody's starter need), then a real
    // PF and C that P1 desperately needs.
    const guard = pool().find(
      (p) => !used.has(p.id) && eligiblePositions(p).every((pos) => pos === "PG" || pos === "SG")
    )!
    const pf = pool().find((p) => !used.has(p.id) && p.id !== guard.id && eligiblePositions(p).includes("PF"))!
    const c = pool().find(
      (p) => !used.has(p.id) && p.id !== guard.id && p.id !== pf.id && eligiblePositions(p).includes("C")
    )!
    state.queue = [guard.id, pf.id, c.id]

    openNextLot(state)

    // The engine must NOT open the guard — P1 can't roster him and he fills no
    // open starter slot for anyone.
    expect(state.lot).not.toBeNull()
    expect(state.lot!.player.id).not.toBe(guard.id)
    expect([pf.id, c.id]).toContain(state.lot!.player.id)
  })

  it("prioritizes a position whose remaining supply is critically low", () => {
    const state = baseGame()
    const used = new Set<string>()

    // P1 needs only C. P2 needs only BENCH.
    let p1 = emptyRoster()
    for (const pos of ["PG", "SG", "SF", "PF"] as Position[]) {
      p1 = placePlayer(p1, pick(used, pos), 5, pos)
    }
    p1 = placePlayer(p1, pick(used, "ANY"), 5, "BENCH")

    let p2 = emptyRoster()
    for (const pos of POSITIONS) {
      p2 = placePlayer(p2, pick(used, pos), 5, pos)
    }
    state.rosters = { P1: p1, P2: p2 }

    // Two non-centers ahead of the single remaining center.
    const nonCs = pool()
      .filter((p) => !used.has(p.id) && !eligiblePositions(p).includes("C"))
      .slice(0, 2)
    const theC = pool().find(
      (p) => !used.has(p.id) && !nonCs.some((n) => n.id === p.id) && eligiblePositions(p).includes("C")
    )!
    state.queue = [...nonCs.map((p) => p.id), theC.id]

    openNextLot(state)

    // The last remaining center must jump the queue — otherwise P1 can never
    // legally fill its C slot.
    expect(state.lot!.player.id).toBe(theC.id)
  })

  it("never discounts an elite player to a team's final $1", () => {
    const state = baseGame()
    state.config.budgetPerPlayer = 100

    const curry = pool().find((player) => player.id === "stephen-curry")!
    const used = new Set<string>([curry.id])

    // Reproduce the reported state: P1 has five starters, one bench slot, and
    // only $1 left. P2 has a complete roster, so its remaining $4 is locked.
    let p1 = emptyRoster()
    const p1Prices = [9, 28, 26, 1, 35]
    POSITIONS.forEach((pos, index) => {
      p1 = placePlayer(p1, pick(used, pos), p1Prices[index], pos)
    })

    let p2 = emptyRoster()
    const p2Prices = [11, 8, 18, 13, 38]
    POSITIONS.forEach((pos, index) => {
      p2 = placePlayer(p2, pick(used, pos), p2Prices[index], pos)
    })
    p2 = placePlayer(p2, pick(used, "ANY"), 8, "BENCH")

    state.rosters = { P1: p1, P2: p2 }
    state.queue = [curry.id]

    openNextLot(state)

    // An unaffordable star must not have his reserve collapsed from a realistic
    // opener to $1. With no normally affordable lot left, a low-value fallback
    // completes the roster instead.
    expect(state.status).toBe("lineup")
    expect(state.lot).toBeNull()
    expect(state.rosters.P1.slots.BENCH).not.toBeNull()
    expect(state.rosters.P1.slots.BENCH!.player.id).not.toBe(curry.id)
    expect(state.results.some((result) => result.playerId === curry.id)).toBe(false)
  })
})

describe("auction board — positional coverage", () => {
  it("always includes enough eligible players for both teams at every position", () => {
    for (const budget of [25, 50, 100]) {
      for (let seed = 1; seed <= 40; seed++) {
        const ids = buildAuctionOrder(mulberry32(seed), pool(), budget)
        const board = ids.map((id) => pool().find((p) => p.id === id)!)
        for (const pos of POSITIONS) {
          const n = board.filter((p) => eligiblePositions(p).includes(pos)).length
          expect(
            n,
            `budget ${budget} seed ${seed}: only ${n} player(s) eligible at ${pos}`
          ).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })
})

/**
 * End-to-end guard: the auction must actually SELL enough players to fill both
 * rosters. The bug this pins down: ~9 lots per game were passed out and deleted
 * from the board forever, so with only 20 lots for 12 slots the board died and
 * both benches (plus the odd starter) were silently auto-filled with $1 scrubs.
 */
describe("auction completeness — no silent auto-fill", () => {
  function playToCompletion(budget: number, seed: number) {
    const state = createGame({
      gameId: `complete-${budget}-${seed}`,
      seed,
      vsAI: true,
      config: { ...DEFAULT_CONFIG, budgetPerPlayer: budget, difficulty: "medium" },
    })
    state.isAI = { P1: true, P2: true }

    let guard = 0
    while (state.status === "auction" && guard++ < 5000) {
      if (!state.lot) {
        if (!openNextLot(state)) break
        continue
      }
      let acted = false
      for (const seat of ["P1", "P2"] as TeamId[]) {
        if (!state.lot) break
        if (isRosterComplete(state.rosters[seat])) continue
        if (state.lot.highBidder === seat) continue
        const d = decideAI(state, seat)
        if (d.action === "bid" && placeBid(state, seat, d.amount).ok) acted = true
      }
      if (!acted) resolveLot(state)
    }

    // A player never present in `history` was never bid on → auto-filled.
    const bidOn = new Set(state.history.map((h) => h.playerId))
    let autoFilled = 0
    for (const seat of ["P1", "P2"] as TeamId[]) {
      for (const o of orderedRoster(state.rosters[seat])) {
        if (!bidOn.has(o.player.id)) autoFilled++
      }
    }
    return { state, autoFilled }
  }

  it("always terminates with two complete, legally-slotted rosters", () => {
    for (const budget of [25, 50, 100]) {
      for (let seed = 1; seed <= 40; seed++) {
        const { state } = playToCompletion(budget, seed * 17 + budget)
        expect(state.status).not.toBe("auction")
        for (const seat of ["P1", "P2"] as TeamId[]) {
          const roster = state.rosters[seat]
          expect(
            isRosterComplete(roster),
            `budget ${budget} seed ${seed} ${seat} incomplete`
          ).toBe(true)
          // Every player must legally belong in the slot they occupy.
          for (const o of orderedRoster(roster)) {
            if (o.slot !== "BENCH") {
              expect(eligiblePositions(o.player)).toContain(o.slot)
            }
          }
        }
      }
    }
  })

  it("fills rosters by real bidding, not the auto-fill fallback", () => {
    let totalSlots = 0
    let autoFilled = 0
    for (const budget of [25, 50, 100]) {
      for (let seed = 1; seed <= 40; seed++) {
        const r = playToCompletion(budget, seed * 17 + budget)
        totalSlots += 12
        autoFilled += r.autoFilled
      }
    }
    const rate = autoFilled / totalSlots
    // Was ~14% when the board died before benches were bought. The remaining
    // fraction is cheap role players filling a late bench slot, never stars.
    expect(rate, `auto-fill rate ${(rate * 100).toFixed(1)}%`).toBeLessThan(0.04)
  })

  it("NEVER auto-fills an elite (tier 1/2) player when a team is out of money", () => {
    // The reported bug: with $1 left, the game dropped a superstar onto the
    // bench for nothing. The emergency fallback must only ever place low-value
    // role players — an elite player must always require a real, funded bid.
    for (const budget of [25, 50, 100]) {
      for (let seed = 1; seed <= 40; seed++) {
        const { state } = playToCompletion(budget, seed * 17 + budget)
        const bidOn = new Set(state.history.map((h) => h.playerId))
        for (const seat of ["P1", "P2"] as TeamId[]) {
          for (const owned of orderedRoster(state.rosters[seat])) {
            if (bidOn.has(owned.player.id)) continue // won by real bidding — fine
            expect(
              owned.player.tier,
              `budget ${budget} seed ${seed}: auto-filled elite ${owned.player.name} (tier ${owned.player.tier}) at ${owned.slot}`
            ).toBeGreaterThan(2)
          }
        }
      }
    }
  })
})
