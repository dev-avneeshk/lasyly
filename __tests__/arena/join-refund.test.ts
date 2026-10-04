/**
 * RA-4: the invite join charges the stake before claiming the seat. It used to
 * refund only when the seat was taken, so a swept game (GameNotFoundError) kept
 * the joiner's coins. The refund must not fire while the seat is still open,
 * though: the ARENA_STAKE row survives a refund, so a retry would be charged
 * "duplicate" and seated for free (final review, security #1).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const h = vi.hoisted(() => ({
  mutateError: null as Error | null,
  seatFirst: null as string | null,
  // Mirrors start_arena_stake / refund_arena_stake: one stake row per
  // (user, game); a refund adds a refund row but leaves the stake row in place.
  staked: new Set<string>(),
  refunded: new Set<string>(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-guest" } } }) } }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/economy/wallet", () => ({
  chargeArenaStake: vi.fn(async ({ userId, gameId }: { userId: string; gameId: string }) => {
    const key = `${userId}:${gameId}`
    if (h.staked.has(key)) return "duplicate"
    h.staked.add(key)
    return "completed"
  }),
  refundArenaStake: vi.fn(async ({ userId, gameId }: { userId: string; gameId: string }) => {
    h.refunded.add(`${userId}:${gameId}`)
    return "completed"
  }),
}))
vi.mock("@/lib/realtime/arena", async (orig) => ({
  ...(await orig<typeof import("@/lib/realtime/arena")>()),
  broadcastArenaUpdate: vi.fn(async () => {}),
  registerArenaChannelMember: vi.fn(async () => true),
}))
vi.mock("@/lib/arena/store", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/store")>()
  return {
    ...real,
    mutateGame: async (...args: Parameters<typeof real.mutateGame>) => {
      if (!h.mutateError) return real.mutateGame(...args)
      // A concurrent join seated someone (maybe this same user) before this one failed.
      const seat = h.seatFirst
      if (seat) await real.mutateGame(args[0], (g) => void (g.guestUserId = seat))
      if (h.mutateError instanceof real.GameNotFoundError) await real.deleteGame(args[0])
      throw h.mutateError
    },
  }
})

import { POST as join } from "@/app/api/arena/[gameId]/join/route"
import { createGame } from "@/lib/arena/auction"
import { saveGame, loadGame, _resetStore, GameBusyError, GameNotFoundError } from "@/lib/arena/store"
import { refundArenaStake } from "@/lib/economy/wallet"
import { DEFAULT_CONFIG } from "@/lib/arena/types"

const STAKE = 50

async function lobby(gameId: string) {
  const state = createGame({ gameId, config: { ...DEFAULT_CONFIG }, vsAI: false, seed: 5 })
  state.isAI.P2 = false
  state.status = "lobby"
  state.econ = { mode: "pvp", amount: STAKE, settled: false }
  await saveGame({ rev: 1, ownerUserId: "user-owner", guestUserId: null, state })
}
const call = (gameId: string) =>
  join(new Request(`http://localhost/api/arena/${gameId}/join`, { method: "POST" }), { params: Promise.resolve({ gameId }) })
const netDebit = (gameId: string) => {
  const key = `user-guest:${gameId}`
  return (h.staked.has(key) ? STAKE : 0) - (h.refunded.has(key) ? STAKE : 0)
}

beforeEach(() => {
  _resetStore()
  Object.assign(h, { mutateError: null, seatFirst: null })
  h.staked.clear()
  h.refunded.clear()
  vi.mocked(refundArenaStake).mockClear()
})

describe("arena invite join refunds the stake only when a retry can't win the seat (RA-4)", () => {
  it("refunds when the game was swept (error response unchanged)", async () => {
    await lobby("r-1")
    h.mutateError = new GameNotFoundError()
    expect((await call("r-1")).status).toBe(404)
    expect(refundArenaStake).toHaveBeenCalledWith({ userId: "user-guest", gameId: "r-1" })
    expect(netDebit("r-1")).toBe(0)
  })

  it("refunds when another user took the seat under the lock", async () => {
    await lobby("r-4")
    Object.assign(h, { mutateError: new GameBusyError(), seatFirst: "user-other" })
    expect((await call("r-4")).status).toBe(503)
    expect(netDebit("r-4")).toBe(0)
  })

  it("busy lock with the seat still open keeps the charge, and the retry is seated paying the stake once", async () => {
    await lobby("r-5")
    h.mutateError = new GameBusyError()
    expect((await call("r-5")).status).toBe(503)
    expect(refundArenaStake).not.toHaveBeenCalled()

    h.mutateError = null
    expect((await call("r-5")).status).toBe(200)
    expect((await loadGame("r-5"))?.guestUserId).toBe("user-guest")
    expect(netDebit("r-5")).toBe(STAKE)
  })

  it("doesn't refund a user a concurrent join already seated", async () => {
    await lobby("r-2")
    Object.assign(h, { mutateError: new GameBusyError(), seatFirst: "user-guest" })
    expect((await call("r-2")).status).toBe(503)
    expect(refundArenaStake).not.toHaveBeenCalled()
  })

  it("a normal join is charged and not refunded", async () => {
    await lobby("r-3")
    expect((await call("r-3")).status).toBe(200)
    expect(refundArenaStake).not.toHaveBeenCalled()
    expect(netDebit("r-3")).toBe(STAKE)
  })
})
