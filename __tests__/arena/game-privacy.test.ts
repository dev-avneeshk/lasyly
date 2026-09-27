/**
 * Arena and NFL games are private to their two players.
 *
 * Three ways in used to be open to anyone who knew a gameId (it's in every
 * invite link):
 *   1. GET /api/{arena,nfl}/[gameId] fell back to the P1 view for non-players.
 *   2. GET /api/arena/[gameId]/players returned both players' profile cards.
 *   3. The realtime topic was `arena-game-${gameId}`, a public Supabase channel
 *      carrying the full view on every change, so anyone with the anon key could
 *      subscribe.
 *
 * (1) and (2) now 404 for non-players. (3) is an HMAC of the gameId under a
 * server secret, handed out only in responses to verified players.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

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
// The players route reaches for the service-role client only AFTER the seat
// check. If a non-player ever gets past it, this makes the test fail loudly.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("admin client must not be reached for a non-player")
  },
}))

import { GET as arenaGet } from "@/app/api/arena/[gameId]/route"
import { GET as arenaPlayers } from "@/app/api/arena/[gameId]/players/route"
import { GET as nflGet } from "@/app/api/nfl/[gameId]/route"
import * as arenaAuction from "@/lib/arena/auction"
import * as arenaStore from "@/lib/arena/store"
import { DEFAULT_CONFIG as ARENA_CONFIG } from "@/lib/arena/types"
import * as nflAuction from "@/lib/nfl/auction"
import * as nflStore from "@/lib/nfl/store"
import { DEFAULT_CONFIG as NFL_CONFIG } from "@/lib/nfl/types"
import { arenaChannelName, participantView } from "@/lib/realtime/arena"
import { serverView } from "@/lib/arena/server"

const OWNER = "user-owner"
const GUEST = "user-guest"
const STRANGER = "user-stranger"

function saveArena(gameId: string) {
  const state = arenaAuction.createGame({ gameId, config: { ...ARENA_CONFIG }, vsAI: false, seed: 3 })
  state.status = "auction"
  arenaAuction.openNextLot(state)
  return arenaStore.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: GUEST, state })
}

function saveNfl(gameId: string) {
  const state = nflAuction.createGame({ gameId, config: { ...NFL_CONFIG }, vsAI: false, seed: 3 })
  state.status = "auction"
  nflAuction.openNextLot(state)
  return nflStore.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: GUEST, state })
}

const get = (handler: typeof arenaGet, url: string, gameId: string) =>
  handler(new Request(`http://localhost${url}`), { params: Promise.resolve({ gameId }) })

beforeEach(() => {
  arenaStore._resetStore()
  nflStore._resetStore()
  auth.userId = null
})

describe("GET /api/arena/[gameId]", () => {
  it("404s a signed-in non-player, the same as a missing game", async () => {
    await saveArena("a-1")
    auth.userId = STRANGER

    const res = await get(arenaGet, "/api/arena/a-1", "a-1")
    const missing = await get(arenaGet, "/api/arena/nope", "nope")

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual(await missing.json())
    expect(missing.status).toBe(404)
  })

  it.each([
    [OWNER, "P1"],
    [GUEST, "P2"],
  ])("serves %s their own seat's view", async (userId, seat) => {
    await saveArena("a-2")
    auth.userId = userId

    const res = await get(arenaGet, "/api/arena/a-2", "a-2")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.viewer).toBe(seat)
    expect(body).toHaveProperty("channel")
  })
})

describe("GET /api/nfl/[gameId]", () => {
  it("404s a signed-in non-player", async () => {
    await saveNfl("n-1")
    auth.userId = STRANGER
    const res = await get(nflGet, "/api/nfl/n-1", "n-1")
    expect(res.status).toBe(404)
  })

  it.each([
    [OWNER, "P1"],
    [GUEST, "P2"],
  ])("serves %s their own seat's view", async (userId, seat) => {
    await saveNfl("n-2")
    auth.userId = userId
    const res = await get(nflGet, "/api/nfl/n-2", "n-2")
    expect(res.status).toBe(200)
    expect((await res.json()).viewer).toBe(seat)
  })
})

describe("GET /api/arena/[gameId]/players", () => {
  it("404s a signed-in non-player without touching profile data", async () => {
    await saveArena("p-1")
    auth.userId = STRANGER
    const res = await get(arenaPlayers, "/api/arena/p-1/players", "p-1")
    expect(res.status).toBe(404)
  })
})

describe("arena realtime channel name", () => {
  const SECRET = "x".repeat(40)
  let saved: { arena?: string; service?: string }

  beforeEach(() => {
    saved = { arena: process.env.ARENA_CHANNEL_SECRET, service: process.env.SUPABASE_SERVICE_ROLE_KEY }
  })
  afterEach(() => {
    const restore = (k: string, v?: string) => (v === undefined ? delete process.env[k] : (process.env[k] = v))
    restore("ARENA_CHANNEL_SECRET", saved.arena)
    restore("SUPABASE_SERVICE_ROLE_KEY", saved.service)
  })

  it("can't be derived from the gameId alone", () => {
    process.env.ARENA_CHANNEL_SECRET = SECRET
    const gameId = "8b0c1d9e-1111-4222-8333-444455556666"
    const name = arenaChannelName(gameId)!

    expect(name).toMatch(/^arena-[0-9a-f]{32}$/)
    expect(name).not.toContain(gameId)
    // The old, public topic.
    expect(name).not.toBe(`arena-game-${gameId}`)
  })

  it("is stable per game and different across games and secrets", () => {
    process.env.ARENA_CHANNEL_SECRET = SECRET
    const a = arenaChannelName("game-a")
    expect(arenaChannelName("game-a")).toBe(a)
    expect(arenaChannelName("game-b")).not.toBe(a)

    process.env.ARENA_CHANNEL_SECRET = "y".repeat(40)
    expect(arenaChannelName("game-a")).not.toBe(a)
  })

  it("falls back to the service-role key, and is off with no usable secret", () => {
    delete process.env.ARENA_CHANNEL_SECRET
    process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET
    expect(arenaChannelName("g")).toMatch(/^arena-/)

    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(arenaChannelName("g")).toBeNull()

    // Too short to be a real key: treated as unset rather than used.
    process.env.ARENA_CHANNEL_SECRET = "short"
    expect(arenaChannelName("g")).toBeNull()
  })

  it("is attached by participantView, and only there", () => {
    process.env.ARENA_CHANNEL_SECRET = SECRET
    const state = arenaAuction.createGame({ gameId: "pv", config: { ...ARENA_CONFIG }, vsAI: true, seed: 1 })
    const plain = serverView(state, "P1", 1)

    expect(plain).not.toHaveProperty("channel") // what broadcasts carry
    expect(participantView(plain).channel).toBe(arenaChannelName("pv"))
  })
})
