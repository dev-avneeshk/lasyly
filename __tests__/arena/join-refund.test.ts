/**
 * RA-4: the invite join charges the stake before claiming the seat. It used to
 * refund only when the seat was taken, so a swept game (GameNotFoundError) or a
 * lock that stayed busy (GameBusyError) kept the joiner's coins.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const h = vi.hoisted(() => ({ mutateError: null as Error | null, seatFirst: false }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-guest" } } }) } }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/economy/wallet", () => ({
  chargeArenaStake: vi.fn(async () => "completed"),
  refundArenaStake: vi.fn(async () => "completed"),
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
      // A concurrent join by the same user seated them before this one failed.
      if (h.seatFirst) await real.mutateGame(args[0], (g) => void (g.guestUserId = "user-guest"))
      if (h.mutateError instanceof real.GameNotFoundError) await real.deleteGame(args[0])
      throw h.mutateError
    },
  }
})

import { POST as join } from "@/app/api/arena/[gameId]/join/route"
import { createGame } from "@/lib/arena/auction"
import { saveGame, _resetStore, GameBusyError, GameNotFoundError } from "@/lib/arena/store"
import { refundArenaStake } from "@/lib/economy/wallet"
import { DEFAULT_CONFIG } from "@/lib/arena/types"

async function lobby(gameId: string) {
  const state = createGame({ gameId, config: { ...DEFAULT_CONFIG }, vsAI: false, seed: 5 })
  state.isAI.P2 = false
  state.status = "lobby"
  state.econ = { mode: "pvp", amount: 50, settled: false }
  await saveGame({ rev: 1, ownerUserId: "user-owner", guestUserId: null, state })
}
const call = (gameId: string) =>
  join(new Request(`http://localhost/api/arena/${gameId}/join`, { method: "POST" }), { params: Promise.resolve({ gameId }) })

beforeEach(() => {
  _resetStore()
  Object.assign(h, { mutateError: null, seatFirst: false })
  vi.mocked(refundArenaStake).mockClear()
})

describe("arena invite join refunds the stake when the seat isn't committed (RA-4)", () => {
  it.each([
    ["the game was swept", new GameNotFoundError(), 404],
    ["the lock stayed busy", new GameBusyError(), 503],
  ])("refunds when %s (error response unchanged)", async (_label, err, status) => {
    await lobby("r-1")
    h.mutateError = err
    expect((await call("r-1")).status).toBe(status)
    expect(refundArenaStake).toHaveBeenCalledWith({ userId: "user-guest", gameId: "r-1" })
  })

  it("doesn't refund a user a concurrent join already seated", async () => {
    await lobby("r-2")
    Object.assign(h, { mutateError: new GameBusyError(), seatFirst: true })
    expect((await call("r-2")).status).toBe(503)
    expect(refundArenaStake).not.toHaveBeenCalled()
  })

  it("a normal join is charged and not refunded", async () => {
    await lobby("r-3")
    expect((await call("r-3")).status).toBe(200)
    expect(refundArenaStake).not.toHaveBeenCalled()
  })
})
