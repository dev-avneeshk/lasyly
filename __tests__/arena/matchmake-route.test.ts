import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// REV-12: a repeat matchmake returned the user's held lobby before checking
// the requested stake, so re-queueing at 100 silently put them back at 50.
type DequeueCheck = (gameId: string) => Promise<"join" | "keep" | "drop">
const h = vi.hoisted(() => ({
  userId: "owner",
  heldId: "held" as string | null,
  /** Replaces the queue pop (the tests have no Redis); null = the real one, which finds nothing. */
  dequeue: null as null | ((check: DequeueCheck) => Promise<string | null>),
  names: {} as Record<string, string>,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: h.userId } } }) } }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/arena/matchmaking", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/matchmaking")>()
  return {
    ...real,
    getUserLobby: async () => h.heldId,
    dequeueOpenGame: (check: DequeueCheck) => (h.dequeue ? h.dequeue(check) : real.dequeueOpenGame(check)),
    queuePendingRefund: vi.fn(async () => {}),
  }
})
vi.mock("@/lib/economy/wallet", () => ({
  chargeArenaStake: vi.fn(async () => "completed"),
  refundArenaStake: vi.fn(async () => "completed"),
}))
vi.mock("@/lib/arena/identity", () => ({
  lookupSeatName: vi.fn(async (userId: string) => h.names[userId] ?? null),
  findTakenNames: vi.fn(async () => new Set<string>()),
}))
vi.mock("@/lib/realtime/arena", async (orig) => ({
  ...(await orig<typeof import("@/lib/realtime/arena")>()),
  broadcastArenaUpdate: vi.fn(async () => {}),
  registerArenaChannelMember: vi.fn(async () => true),
}))
// Lobby creation reaches the queue and slot helpers: keep them off any real Redis.
vi.mock("@/lib/redis", () => ({ getRedisClient: () => null }))

import { POST as matchmake } from "@/app/api/arena/matchmake/route"
import * as auction from "@/lib/arena/auction"
import * as store from "@/lib/arena/store"
import * as wallet from "@/lib/economy/wallet"
import { DEFAULT_CONFIG } from "@/lib/arena/types"
import { parseHeldLobby } from "@/lib/arena/clientRequests"
import { applyConversion, BOT_SEAT, type ConversionOutcome } from "@/lib/arena/botMatch"
import { BOT_FALLBACK_WAIT_MS } from "@/lib/arena/fallbackTiming"
import { LOBBY_MAX_AGE_MS, queuePendingRefund } from "@/lib/arena/matchmaking"
import { lookupSeatName } from "@/lib/arena/identity"

const req = (stake: number) =>
  new Request("http://localhost/api/arena/matchmake", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify({ stake }),
  })

beforeEach(async () => {
  store._resetStore()
  vi.clearAllMocks()
  Object.assign(h, { userId: "owner", heldId: "held", dequeue: null, names: {} })
  const s = auction.createGame({ gameId: "held", config: { ...DEFAULT_CONFIG }, vsAI: false })
  s.isAI.P2 = false
  s.status = "lobby"
  s.econ = { mode: "pvp", amount: 50, settled: false }
  await store.saveGame({ rev: 1, ownerUserId: "owner", guestUserId: null, state: s })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("matchmake with a held lobby", () => {
  it("same stake returns the held lobby without a new charge", async () => {
    const res = await matchmake(req(50))
    expect(res.status).toBe(200)
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
  })

  it("different stake → 409 naming the open lobby (was: silently the old stake)", async () => {
    const res = await matchmake(req(100))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual(expect.objectContaining({ gameId: "held", stake: 50 }))
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
  })

  it("resume from the 409 (held stake fed back) returns the held lobby, no charge", async () => {
    const conflict = await matchmake(req(100))
    const held = parseHeldLobby(conflict.status, await conflict.json())
    expect(held).toEqual({ gameId: "held", stake: 50 })
    const res = await matchmake(req(held!.stake))
    expect(res.status).toBe(200)
    expect((await res.json()).gameId).toBe("held")
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
    expect(wallet.refundArenaStake).not.toHaveBeenCalled()
  })
})

// ─── Seat names, the public marker, and converted lobbies (design §1, §4, §8.2) ──

const T = Date.UTC(2026, 9, 13, 18, 0, 0)
const STAKE = 25
const PERSONA = "hoopsjunkie23"

/** A lobby another player ("rival") opened through matchmake step 2, old enough to convert. */
async function rivalLobby(gameId: string) {
  const s = auction.createGame({ gameId, config: { ...DEFAULT_CONFIG }, vsAI: false })
  s.isAI.P2 = false
  s.status = "lobby"
  s.econ = { mode: "pvp", amount: STAKE, settled: false }
  s.matchmadeLobby = { openedAt: T - BOT_FALLBACK_WAIT_MS }
  s.seatNames = { P1: "realowner" }
  await store.saveGame({ rev: 1, ownerUserId: "rival", guestUserId: null, state: s })
}
/** The rival's pair request committing (lib/arena/botMatch.ts), as the pair route will run it. */
async function convert(gameId: string) {
  let outcome = null as ConversionOutcome | null
  const { changed } = await store.mutateGame(gameId, (g) => {
    outcome = applyConversion(g, { userId: "rival", name: PERSONA, now: Date.now(), maxAgeMs: LOBBY_MAX_AGE_MS })
  })
  expect(outcome).toEqual({ kind: "converted" })
  expect(changed).toBe(true)
}

describe("matchmake records seat names and refuses converted lobbies", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(T)
    h.userId = "joiner"
    h.heldId = null
  })

  it('the dequeue check returns "drop" for a converted record (AC-11)', async () => {
    await rivalLobby("conv")
    await convert("conv")
    let verdict = null as string | null
    h.dequeue = async (check) => {
      verdict = await check("conv")
      return null
    }

    const res = await matchmake(req(STAKE))

    expect(verdict).toBe("drop")
    expect(res.status).toBe(201) // nobody to join: the caller opens their own lobby
    expect(wallet.chargeArenaStake).toHaveBeenCalledTimes(1)
    expect(wallet.chargeArenaStake).not.toHaveBeenCalledWith(expect.objectContaining({ gameId: "conv" }))
  })

  it("a joiner who reaches the seat after a conversion is refunded once and gets their own lobby (AC-8)", async () => {
    await rivalLobby("conv")
    let popped = null as string | null
    let converted = ""
    h.dequeue = async (check) => {
      popped = await check("conv") // still an open lobby when it was popped…
      await convert("conv") // …and converted before the joiner's seat mutator runs
      converted = JSON.stringify(await store.loadGame("conv"))
      return "conv"
    }

    const res = await matchmake(req(STAKE))

    expect(popped).toBe("join")
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.gameId).not.toBe("conv")
    expect(body.viewer).toBe("P1")
    expect(wallet.refundArenaStake).toHaveBeenCalledTimes(1)
    expect(wallet.refundArenaStake).toHaveBeenCalledWith({ userId: "joiner", gameId: "conv" })
    expect(queuePendingRefund).not.toHaveBeenCalled()
    const stored = await store.loadGame("conv")
    expect(JSON.stringify(stored)).toBe(converted) // the converted record is untouched
    expect(stored!.guestUserId).toBe(BOT_SEAT)
  })

  it("step 2 persists the public marker at the server's now and the owner's seat name", async () => {
    h.userId = "opener"
    h.names = { opener: "realopener" }

    const res = await matchmake(req(STAKE))

    expect(res.status).toBe(201)
    const body = await res.json()
    const stored = await store.loadGame(body.gameId)
    expect(stored!.ownerUserId).toBe("opener")
    expect(stored!.state.matchmadeLobby).toEqual({ openedAt: T })
    expect(stored!.state.seatNames).toEqual({ P1: "realopener" })
    expect(body.names).toEqual({ P1: "realopener", P2: null })
    expect(JSON.stringify(body)).not.toMatch(/matchmadeLobby|seatNames/)
    expect(lookupSeatName).toHaveBeenCalledTimes(1)
    expect(lookupSeatName).toHaveBeenCalledWith("opener")
  })

  it("step 2 with no name writes no seatNames", async () => {
    h.userId = "opener"

    const res = await matchmake(req(STAKE))

    expect(res.status).toBe(201)
    const body = await res.json()
    const stored = await store.loadGame(body.gameId)
    expect(stored!.state.matchmadeLobby).toEqual({ openedAt: T })
    expect("seatNames" in stored!.state).toBe(false)
    expect(body.names).toEqual({ P1: null, P2: null })
  })

  it("step 1 records the joiner's seatNames.P2, and the P2 view carries both names", async () => {
    await rivalLobby("open1")
    h.names = { joiner: "realguest" }
    h.dequeue = async (check) => ((await check("open1")) === "join" ? "open1" : null)

    const res = await matchmake(req(STAKE))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      gameId: "open1",
      viewer: "P2",
      status: "auction",
      names: { P1: "realowner", P2: "realguest" },
    })
    const stored = await store.loadGame("open1")
    expect(stored!.guestUserId).toBe("joiner")
    expect(stored!.state.seatNames).toEqual({ P1: "realowner", P2: "realguest" })
    expect(lookupSeatName).toHaveBeenCalledTimes(1)
  })

  it("looks the caller up once when step 1 loses the seat and falls through to step 2", async () => {
    await rivalLobby("full")
    await store.mutateGame("full", (g) => {
      g.guestUserId = "someone" // seated between the pop and the lock
      g.state.status = "auction"
      auction.openNextLot(g.state)
    })
    h.names = { joiner: "realguest" }
    h.dequeue = async () => "full"

    const res = await matchmake(req(STAKE))

    expect(res.status).toBe(201)
    expect(lookupSeatName).toHaveBeenCalledTimes(1)
    expect(lookupSeatName).toHaveBeenCalledWith("joiner")
    const stored = await store.loadGame((await res.json()).gameId)
    expect(stored!.state.seatNames).toEqual({ P1: "realguest" })
    expect(wallet.refundArenaStake).toHaveBeenCalledWith({ userId: "joiner", gameId: "full" })
  })

  it("a lost-race refund that errors is logged and queued for the jobs cron (D-27)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    await rivalLobby("conv")
    await convert("conv")
    h.dequeue = async () => "conv" // popped just before the conversion committed
    vi.mocked(wallet.refundArenaStake).mockResolvedValueOnce("error")

    const res = await matchmake(req(STAKE))

    expect(res.status).toBe(201)
    expect(wallet.refundArenaStake).toHaveBeenCalledWith({ userId: "joiner", gameId: "conv" })
    expect(error).toHaveBeenCalledWith("[arena] lost-race refund failed", { gameId: "conv", userId: "joiner" })
    expect(queuePendingRefund).toHaveBeenCalledTimes(1)
    expect(queuePendingRefund).toHaveBeenCalledWith("conv", "joiner")
  })
})
