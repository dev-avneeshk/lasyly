/**
 * POST /api/arena/[gameId]/join registers the player's channel seat BEFORE it
 * responds with the channel name.
 *
 * Realtime checks permission at the moment the client subscribes, and the
 * client subscribes as soon as it has `channel`. If the seat were written after
 * the response (or not awaited), the guest's join would race it and be refused
 * for the whole game. The ordering assertion below pins that.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const h = vi.hoisted(() => ({
  userId: null as string | null,
  order: [] as string[],
  register: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.userId ? { id: h.userId } : null } }) },
  }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/economy/wallet", () => ({
  chargeArenaStake: vi.fn(async () => "completed"),
  refundArenaStake: vi.fn(async () => "completed"),
}))
vi.mock("@/lib/realtime/arena", async (orig) => {
  const real = await orig<typeof import("@/lib/realtime/arena")>()
  return {
    ...real,
    broadcastArenaUpdate: vi.fn(async () => {}),
    registerArenaChannelMember: h.register,
    participantView: (v: Parameters<typeof real.participantView>[0]) => {
      h.order.push("respond")
      return { ...v, channel: "arena-test-topic" }
    },
  }
})

import { POST as join } from "@/app/api/arena/[gameId]/join/route"
import { createGame } from "@/lib/arena/auction"
import { saveGame, loadGame, _resetStore } from "@/lib/arena/store"
import { DEFAULT_CONFIG } from "@/lib/arena/types"

const OWNER = "user-owner"
const GUEST = "user-guest"

async function lobby(gameId: string) {
  const state = createGame({ gameId, config: { ...DEFAULT_CONFIG }, vsAI: false, seed: 5 })
  state.isAI.P2 = false
  state.status = "lobby"
  await saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: null, state })
}

const call = (gameId: string) =>
  join(new Request(`http://localhost/api/arena/${gameId}/join`, { method: "POST" }), {
    params: Promise.resolve({ gameId }),
  })

beforeEach(() => {
  _resetStore()
  h.order.length = 0
  h.register.mockReset()
  h.register.mockImplementation(async (_g: string, _u: string, seat: string) => {
    // Record on COMPLETION, after a real delay, so a route that forgets to
    // await the registration responds first and fails the ordering check.
    await new Promise((r) => setTimeout(r, 5))
    h.order.push(`register:${seat}`)
    return true
  })
})

describe("join registers the channel seat", () => {
  it("seats a new guest as P2 and registers them before responding", async () => {
    await lobby("j-1")
    h.userId = GUEST

    const res = await call("j-1")

    expect(res.status).toBe(200)
    expect(h.register).toHaveBeenCalledWith("j-1", GUEST, "P2")
    expect(h.order).toEqual(["register:P2", "respond"])
    expect((await loadGame("j-1"))!.guestUserId).toBe(GUEST)
    expect((await res.json()).channel).toBe("arena-test-topic")
  })

  it("re-registers an already-seated player, so a retry repairs a failed registration", async () => {
    await lobby("j-2")
    h.userId = OWNER

    const res = await call("j-2")

    expect(res.status).toBe(200)
    expect(h.register).toHaveBeenCalledWith("j-2", OWNER, "P1")
    expect(h.order).toEqual(["register:P1", "respond"])
  })

  it("still seats the guest when registration fails (they just poll)", async () => {
    await lobby("j-3")
    h.userId = GUEST
    h.register.mockResolvedValue(false)

    const res = await call("j-3")

    expect(res.status).toBe(200)
    expect((await loadGame("j-3"))!.guestUserId).toBe(GUEST)
  })

  it("registers nobody when the game is full", async () => {
    await lobby("j-4")
    h.userId = GUEST
    await call("j-4")
    h.register.mockClear()

    h.userId = "user-late"
    const res = await call("j-4")

    expect(res.status).toBe(409)
    expect(h.register).not.toHaveBeenCalled()
  })
})
