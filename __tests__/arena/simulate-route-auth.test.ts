/**
 * Authorization for POST /api/{arena,nfl}/[gameId]/simulate.
 *
 * Both routes used to resolve the caller's seat as
 * `seatForUser(game, user.id) ?? "P1"`, so any signed-in user who knew a gameId
 * could drive someone else's game to "complete" (on the arena route, that also
 * triggers coin settlement). They now reject non-participants with 403, the
 * same check the bid and pass routes already made.
 *
 * These call the real route handlers against the in-memory game store. Only
 * the edges are mocked: Supabase auth (to pick the caller), the rate limiter,
 * the realtime broadcast and the wallet RPCs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const auth = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: auth.userId ? { id: auth.userId } : null } }),
    },
  }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/realtime/arena", async (orig) => ({
  ...(await orig<typeof import("@/lib/realtime/arena")>()),
  broadcastArenaUpdate: vi.fn(async () => {}),
}))
vi.mock("@/lib/economy/wallet", () => ({
  awardCpuReward: vi.fn(async () => {}),
  settle1v1: vi.fn(async () => {}),
}))

import { POST as arenaSimulate } from "@/app/api/arena/[gameId]/simulate/route"
import { POST as nflSimulate } from "@/app/api/nfl/[gameId]/simulate/route"
import * as arenaAuction from "@/lib/arena/auction"
import * as arenaServer from "@/lib/arena/server"
import * as arenaStore from "@/lib/arena/store"
import { DEFAULT_CONFIG as ARENA_CONFIG } from "@/lib/arena/types"
import * as nflAuction from "@/lib/nfl/auction"
import * as nflServer from "@/lib/nfl/server"
import * as nflStore from "@/lib/nfl/store"
import { DEFAULT_CONFIG as NFL_CONFIG } from "@/lib/nfl/types"

const OWNER = "user-owner"
const GUEST = "user-guest"
const STRANGER = "user-stranger"

/** A 1v1 between two humans, played to "lineup" via the server clock only. */
function arenaLineup(gameId: string) {
  const s = arenaAuction.createGame({ gameId, config: { ...ARENA_CONFIG }, vsAI: false, seed: 11 })
  s.status = "auction"
  arenaAuction.openNextLot(s)
  let guard = 0
  while (s.status === "auction" && guard++ < 5000) arenaServer.serverTick(s, (s.lotDeadline ?? Date.now()) + 1)
  expect(s.status).toBe("lineup")
  return s
}

function nflLineup(gameId: string) {
  const s = nflAuction.createGame({ gameId, config: { ...NFL_CONFIG }, vsAI: false, seed: 11 })
  s.status = "auction"
  nflAuction.openNextLot(s)
  let guard = 0
  while (s.status === "auction" && guard++ < 5000) nflServer.serverTick(s, (s.lotDeadline ?? Date.now()) + 1)
  expect(s.status).toBe("lineup")
  return s
}

const call = (handler: typeof arenaSimulate, path: string, gameId: string) =>
  handler(new Request(`http://localhost${path}/${gameId}/simulate`, { method: "POST" }), {
    params: Promise.resolve({ gameId }),
  })

const suites = [
  {
    name: "arena",
    handler: arenaSimulate,
    path: "/api/arena",
    reset: arenaStore._resetStore,
    save: (gameId: string) =>
      arenaStore.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: GUEST, state: arenaLineup(gameId) }),
    load: async (gameId: string) => (await arenaStore.loadGame(gameId))!.state.status,
  },
  {
    name: "nfl",
    handler: nflSimulate,
    path: "/api/nfl",
    reset: nflStore._resetStore,
    save: (gameId: string) =>
      nflStore.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: GUEST, state: nflLineup(gameId) }),
    load: async (gameId: string) => (await nflStore.loadGame(gameId))!.state.status,
  },
]

describe.each(suites)("POST $path/[gameId]/simulate authorization", ({ handler, path, reset, save, load }) => {
  beforeEach(() => {
    reset()
    auth.userId = null
  })

  it("rejects a signed-in non-participant with 403 and leaves the game untouched", async () => {
    await save("g-stranger")
    auth.userId = STRANGER

    const res = await call(handler, path, "g-stranger")

    expect(res.status).toBe(403)
    expect(await load("g-stranger")).toBe("lineup")
  })

  it("rejects an unauthenticated caller with 401", async () => {
    await save("g-anon")
    const res = await call(handler, path, "g-anon")
    expect(res.status).toBe(401)
    expect(await load("g-anon")).toBe("lineup")
  })

  it.each([
    ["owner", OWNER, "P1"],
    ["guest", GUEST, "P2"],
  ])("lets the %s complete the game and returns their seat's view", async (_label, userId, seat) => {
    await save(`g-${userId}`)
    auth.userId = userId

    const res = await call(handler, path, `g-${userId}`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.viewer).toBe(seat)
    expect(body.status).toBe("complete")
    expect(await load(`g-${userId}`)).toBe("complete")
  })
})
