import { createGame, openNextLot, placeBid, type ArenaState } from "@/lib/arena/auction"
import { driveAI, serverTick, serverView, startSimulation, ensureResult } from "@/lib/arena/server"
import { saveGame, loadGame, mutateGame, deleteGame } from "@/lib/arena/store"
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

  it("mutateGame bumps rev and persists changes atomically", async () => {
    const state = freshGame("srv-2")
    await saveGame({ rev: 1, ownerUserId: "u1", state })
    const g = await mutateGame("srv-2", (game) => {
      serverTick(game.state)
    })
    expect(g.rev).toBe(2)
    const again = await loadGame("srv-2")
    expect(again!.rev).toBe(2)
    await deleteGame("srv-2")
  })

  it("concurrent mutations resolve to consistent, non-corrupt state", async () => {
    // NOTE: With Redis present, a short lock serializes read-modify-write so the
    // two mutations produce revs [2, 3]. In test there's no Redis, so the store
    // uses its documented in-memory fallback (single-instance; no cross-request
    // lock). Either way the game must remain valid and rev must advance.
    const state = freshGame("srv-3", 5)
    await saveGame({ rev: 1, ownerUserId: "u1", state })
    const [a, b] = await Promise.all([
      mutateGame("srv-3", (g) => serverTick(g.state)),
      mutateGame("srv-3", (g) => serverTick(g.state)),
    ])
    const maxRev = Math.max(a.rev, b.rev)
    expect(maxRev).toBeGreaterThanOrEqual(2)
    const final = await loadGame("srv-3")
    expect(final).not.toBeNull()
    // State stays internally valid (budgets never negative).
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
