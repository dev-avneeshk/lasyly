import { createGame, openNextLot, placeBid, type ArenaState } from "@/lib/arena/auction"
import { driveAI, serverTick, serverView, startSimulation, ensureResult } from "@/lib/arena/server"
import { saveGame, loadGame, mutateGame, deleteGame, needsServerTick } from "@/lib/arena/store"
import { DEFAULT_CONFIG } from "@/lib/arena/types"

// These exercise the server-authoritative helpers + store WITHOUT HTTP/Supabase.
// Redis is absent in test, so the store uses its in-memory fallback.

function freshGame(gameId: string, seed = 1): ArenaState {
  const s = createGame({ gameId, config: { ...DEFAULT_CONFIG }, vsAI: true, seed })
  openNextLot(s)
  driveAI(s)
  return s
}

describe("Arena server — store", () => {
  it("saves, loads, and deletes a game (in-memory fallback)", async () => {
    const state = freshGame("srv-1")
    await saveGame({ rev: 1, ownerUserId: "u1", state })
    const loaded = await loadGame("srv-1")
    expect(loaded).not.toBeNull()
    expect(loaded!.state.gameId).toBe("srv-1")
    await deleteGame("srv-1")
    expect(await loadGame("srv-1")).toBeNull()
  })

  it("mutateGame does NOT bump rev when the mutator changes nothing", async () => {
    // This is the contract that makes bidding work. `rev` used to be bumped on
    // every call, including read-only polls and rejected actions, which meant
    // the bid handler's optimistic-concurrency check failed for legitimate bids
    // (both players polled every 900ms, so rev moved ~2x/second).
    const state = freshGame("srv-2")
    await saveGame({ rev: 1, ownerUserId: "u1", state })

    const noop = await mutateGame("srv-2", () => {
      /* touch nothing */
    })
    expect(noop.changed).toBe(false)
    expect(noop.game.rev).toBe(1)
    expect((await loadGame("srv-2"))!.rev).toBe(1)

    // A real transition does bump it.
    const real = await mutateGame("srv-2", (game) => {
      game.state.lotDeadline = 0 // force the clock to resolve the lot
      serverTick(game.state)
    })
    expect(real.changed).toBe(true)
    expect(real.game.rev).toBe(2)
    expect((await loadGame("srv-2"))!.rev).toBe(2)

    await deleteGame("srv-2")
  })

  it("a poll-shaped tick on an idle clock is a no-op", async () => {
    // The GET route only escalates to a locked mutate when needsServerTick()
    // says the clock has work. Even if it did call mutateGame, an idle tick must
    // not write.
    const state = freshGame("srv-2b")
    await saveGame({ rev: 7, ownerUserId: "u1", state })
    for (let i = 0; i < 5; i++) {
      const r = await mutateGame("srv-2b", (g) => serverTick(g.state))
      expect(r.changed).toBe(false)
    }
    expect((await loadGame("srv-2b"))!.rev).toBe(7)
    await deleteGame("srv-2b")
  })

  it("concurrent mutations are serialized and produce consecutive revs", async () => {
    // With no Redis configured the store uses its in-memory mode, where the
    // in-process mutex IS genuine mutual exclusion (single instance). The old
    // implementation had no local lock at all and, when Redis errored, returned
    // `true` from acquireLock() — so concurrent writers silently lost updates.
    const state = freshGame("srv-3", 5)
    await saveGame({ rev: 1, ownerUserId: "u1", state })

    const [a, b] = await Promise.all([
      mutateGame("srv-3", (g) => {
        g.state.lotDeadline = 0
        serverTick(g.state)
      }),
      mutateGame("srv-3", (g) => {
        g.state.lotDeadline = 0
        serverTick(g.state)
      }),
    ])

    // Serialized: whichever ran second saw the first one's write.
    const revs = [a.game.rev, b.game.rev].sort((x, y) => x - y)
    expect(revs[0]).toBeLessThan(revs[1])

    const final = await loadGame("srv-3")
    expect(final).not.toBeNull()
    expect(final!.rev).toBe(revs[1])

    // State stays internally valid (budgets never negative / overspent).
    for (const team of ["P1", "P2"] as const) {
      const spent = Object.values(final!.state.rosters[team].slots).reduce((s, o) => s + (o?.price ?? 0), 0)
      expect(spent).toBeLessThanOrEqual(DEFAULT_CONFIG.budgetPerPlayer)
    }
    await deleteGame("srv-3")
  })
})

describe("Arena server — view + authority", () => {
  it("serverView never leaks negative budgets and always sums correctly", () => {
    const state = freshGame("srv-4", 9)
    const view = serverView(state, "P1", 1)
    expect(view.budgets.P1.remaining).toBeGreaterThanOrEqual(0)
    expect(view.budgets.P2.remaining).toBeGreaterThanOrEqual(0)
    expect(view.budgets.P1.spent + view.budgets.P1.remaining).toBe(DEFAULT_CONFIG.budgetPerPlayer)
  })

  it("server rejects an illegal (over-max) human bid via the engine", () => {
    const state = freshGame("srv-5", 3)
    // Human = P1. Try to bid beyond max affordable.
    const res = placeBid(state, "P1", 999)
    expect(res.ok).toBe(false)
  })

  it("full server-driven auction completes and simulation produces a stored result", () => {
    const state = freshGame("srv-6", 77)
    // Human passes on everything; AI (P2) plus timer resolution drives to done.
    let guard = 0
    while (state.status === "auction" && guard++ < 4000) {
      if (!state.lot) { serverTick(state); continue }
      // Human declines; force clock expiry to resolve.
      state.lotDeadline = 0
      serverTick(state)
    }
    expect(["lineup", "complete"]).toContain(state.status)
    startSimulation(state)
    const result = ensureResult(state)
    expect(result).not.toBeNull()
    expect(["P1", "P2"]).toContain(result!.winner)
    // ensureResult memoizes — second call returns the same object.
    expect(ensureResult(state)).toBe(result)
  })
})

describe("Arena — abuse resistance", () => {
  /**
   * Human-vs-human fixture. Deliberately does NOT call driveAI: freshGame()
   * creates a CPU game and lets the AI act, so the lot may already have a high
   * bidder before the test starts.
   */
  function freshHumanGame(gameId: string, seed: number): ArenaState {
    const s = createGame({ gameId, config: { ...DEFAULT_CONFIG }, vsAI: false, seed })
    s.isAI.P1 = false
    s.isAI.P2 = false
    openNextLot(s)
    return s
  }

  it("refuses to let a team outbid ITSELF (double-click on Bid)", () => {
    const state = freshHumanGame("outbid-1", 11)

    const opening = state.lot!.currentBid
    const first = placeBid(state, "P1", opening)
    expect(first.ok).toBe(true)
    expect(state.lot!.highBidder).toBe("P1")

    // The re-render bumps minRaise to opening+1 and the second click fires. This
    // used to succeed, raising P1's own winning price against nobody.
    const second = placeBid(state, "P1", opening + 1)
    expect(second.ok).toBe(false)
    expect(second.error).toMatch(/already the high bidder/i)
    expect(state.lot!.currentBid).toBe(opening)
  })

  it("still allows a genuine counter-bid from the other seat", () => {
    const state = freshHumanGame("outbid-2", 12)

    const opening = state.lot!.currentBid
    expect(placeBid(state, "P1", opening).ok).toBe(true)
    const counter = placeBid(state, "P2", opening + 1)
    expect(counter.ok).toBe(true)
    expect(state.lot!.highBidder).toBe("P2")

    // And now P1 may raise again, because they are no longer leading.
    expect(placeBid(state, "P1", opening + 2).ok).toBe(true)
  })

  it("needsServerTick is false while a lot is live, true once it expires", () => {
    const state = freshGame("tick-1", 13)
    expect(needsServerTick(state)).toBe(false)

    state.lotDeadline = Date.now() - 1
    expect(needsServerTick(state)).toBe(true)

    // No open lot during an auction also needs the clock.
    state.lot = null
    state.lotDeadline = null
    expect(needsServerTick(state)).toBe(true)
  })

  it("needsServerTick repairs a finished auction whose result never persisted", () => {
    const state = freshGame("tick-2", 14)
    state.status = "lineup"
    state.lot = null
    state.lotDeadline = null
    state.result = null
    expect(needsServerTick(state)).toBe(true)

    state.result = { winner: "P1" } as unknown as NonNullable<typeof state.result>
    expect(needsServerTick(state)).toBe(false)
  })

  it("a completed game never needs the clock", () => {
    const state = freshGame("tick-3", 15)
    state.status = "complete"
    expect(needsServerTick(state)).toBe(false)
  })
})
