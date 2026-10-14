/**
 * POST /api/arena/[gameId]/pair (design §3, D-5, D-18). The owner of a public
 * lobby nobody joined in time converts it, under the same lock and rev CAS real
 * seating uses, into a friendly match whose stake is refunded exactly once.
 *
 * Real route handlers run against the in-memory store. The edges are mocked:
 * auth (one user per request, bound with AsyncLocalStorage so concurrent
 * requests can't swap users), the rate limiter, the wallet RPCs (a ledger that
 * answers like the real RPCs), realtime, profile lookups, the opponent runner
 * and Redis.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const als = await vi.hoisted(async () => new (await import("node:async_hooks")).AsyncLocalStorage<string>())

const h = vi.hoisted(() => {
  /** A promise pair a mock can stop at: `arrive` when reached, wait for `release`. */
  const gate = () => {
    let arrive!: () => void
    let release!: () => void
    const reached = new Promise<void>((resolve) => (arrive = resolve))
    const released = new Promise<void>((resolve) => (release = resolve))
    return { reached, released, arrive, release }
  }
  return {
    gate,
    rate: null as null | { allowed: boolean; retryAfterMs: number },
    heldId: null as string | null,
    /** When set, the route's lock-free loadGame sees this owner; mutateGame still reads the stored record. */
    preCheckOwner: null as string | null,
    names: {} as Record<string, string>,
    takeAll: false,
    findTakenError: null as Error | null,
    /** AC-9: 0-5 ms of latency in the name check and the charge. */
    latency: false,
    gates: {
      charge: null as null | ReturnType<typeof gate>,
      findTaken: null as null | ReturnType<typeof gate>,
      refund: null as null | ReturnType<typeof gate>,
    },
    // The ledger: refund_arena_stake's answers (already_settled > duplicate > nothing_to_refund > completed).
    stakes: new Set<string>(),
    refunds: new Set<string>(),
    paidGames: new Set<string>(),
    refundResults: [] as string[],
    calls: [] as Array<{ op: "charge" | "refund" | "settle"; userId: string; gameId: string; result: string }>,
  }
})

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        const id = als.getStore()
        return { data: { user: id ? { id } : null } }
      },
    },
  }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: vi.fn(async () => h.rate ?? { allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/economy/wallet", () => {
  const pause = () => new Promise((resolve) => setTimeout(resolve, Math.random() * 5))
  return {
    chargeArenaStake: vi.fn(async ({ userId, gameId }: { userId: string; gameId: string }) => {
      if (h.latency) await pause()
      if (h.gates.charge) {
        h.gates.charge.arrive()
        await h.gates.charge.released
      }
      const key = `${userId}:${gameId}`
      const result = h.stakes.has(key) ? "duplicate" : "completed"
      h.stakes.add(key)
      h.calls.push({ op: "charge", userId, gameId, result })
      return result
    }),
    refundArenaStake: vi.fn(async ({ userId, gameId }: { userId: string; gameId: string }) => {
      if (h.gates.refund) await h.gates.refund.released
      const key = `${userId}:${gameId}`
      const result =
        h.refundResults.shift() ??
        (h.paidGames.has(gameId)
          ? "already_settled"
          : h.refunds.has(key)
            ? "duplicate"
            : h.stakes.has(key)
              ? "completed"
              : "nothing_to_refund")
      if (result === "completed") h.refunds.add(key)
      h.calls.push({ op: "refund", userId, gameId, result })
      return result
    }),
    settle1v1: vi.fn(async ({ gameId, winnerId }: { gameId: string; winnerId: string }) => {
      h.paidGames.add(gameId)
      h.calls.push({ op: "settle", userId: winnerId, gameId, result: "completed" })
      return "completed"
    }),
    awardCpuReward: vi.fn(async () => "completed"),
    grantWeeklyLevelBonus: vi.fn(async () => "completed"),
  }
})
vi.mock("@/lib/realtime/arena", async (orig) => ({
  ...(await orig<typeof import("@/lib/realtime/arena")>()),
  broadcastArenaUpdate: vi.fn(async () => {}),
  registerArenaChannelMember: vi.fn(async () => true),
}))
vi.mock("@/lib/arena/identity", () => ({
  lookupSeatName: vi.fn(async (userId: string) => h.names[userId] ?? null),
  findTakenNames: vi.fn(async (candidates: string[]) => {
    if (h.latency) await new Promise((resolve) => setTimeout(resolve, Math.random() * 5))
    if (h.gates.findTaken) {
      h.gates.findTaken.arrive()
      await h.gates.findTaken.released
    }
    if (h.findTakenError) throw h.findTakenError
    return h.takeAll ? new Set(candidates) : new Set<string>()
  }),
}))
vi.mock("@/lib/arena/botTurns", () => ({ runBotTurns: vi.fn(async () => {}) }))
// Never reach a real Redis (or its refund queue), whatever the shell exports (D-29).
vi.mock("@/lib/redis", () => ({ getRedisClient: () => null }))
vi.mock("@/lib/arena/matchmaking", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/matchmaking")>()
  return {
    ...real,
    removeOpenGame: vi.fn(real.removeOpenGame),
    queuePendingRefund: vi.fn(real.queuePendingRefund),
    getUserLobby: async () => h.heldId ?? null,
  }
})
vi.mock("@/lib/arena/store", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/store")>()
  return {
    ...real,
    // Only the routes' lock-free reads go through this export; mutateGame reads the stored record.
    loadGame: vi.fn(async (gameId: string) => {
      const g = await real.loadGame(gameId)
      return g && h.preCheckOwner ? { ...g, ownerUserId: h.preCheckOwner } : g
    }),
  }
})

import { POST as pair } from "@/app/api/arena/[gameId]/pair/route"
import { POST as join } from "@/app/api/arena/[gameId]/join/route"
import { POST as matchmake } from "@/app/api/arena/matchmake/route"
import { POST as create } from "@/app/api/arena/route"
import { GET as view } from "@/app/api/arena/[gameId]/route"
import { POST as simulate } from "@/app/api/arena/[gameId]/simulate/route"
import { createGame } from "@/lib/arena/auction"
import { BOT_SEAT } from "@/lib/arena/botMatch"
import { runBotTurns } from "@/lib/arena/botTurns"
import { BOT_FALLBACK_WAIT_MS } from "@/lib/arena/fallbackTiming"
import { findTakenNames } from "@/lib/arena/identity"
import { BOT_REFUND_BACKSTOP_MS, LOBBY_MAX_AGE_MS, queuePendingRefund, removeOpenGame } from "@/lib/arena/matchmaking"
import { HANDLE_RE } from "@/lib/arena/persona"
import { serverTick } from "@/lib/arena/server"
import * as store from "@/lib/arena/store"
import { DEFAULT_CONFIG } from "@/lib/arena/types"
import { stakePayout } from "@/lib/economy/arena"
import * as wallet from "@/lib/economy/wallet"
import { RATE_LIMITS, checkRateLimit } from "@/lib/rateLimit"
import { broadcastArenaUpdate } from "@/lib/realtime/arena"

const T0 = Date.UTC(2026, 9, 13, 18, 0, 0) // the fixture lobbies opened
const T_ELIGIBLE = T0 + BOT_FALLBACK_WAIT_MS
const OWNER = "owner"
const JOINER = "joiner"
const STRANGER = "stranger"
const STAKE = 25
const NOT_FOUND = JSON.stringify({ error: "Game not found." })
const INTERNAL = /bot-seat|botMatch|matchmadeLobby|seatNames|lastKey|shownConfig/

// ─── Requests, one user each ────────────────────────────────────────────────

const ctx = (gameId: string) => ({ params: Promise.resolve({ gameId }) })
const post = (path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
const path = (gameId: string, action = "") => `/api/arena/${encodeURIComponent(gameId)}${action}`
const pairAs = (userId: string, gameId: string) => als.run(userId, () => pair(post(path(gameId, "/pair")), ctx(gameId)))
const joinAs = (userId: string, gameId: string) => als.run(userId, () => join(post(path(gameId, "/join")), ctx(gameId)))
const getAs = (userId: string, gameId: string) =>
  als.run(userId, () => view(new Request(`http://localhost${path(gameId)}`), ctx(gameId)))
const simulateAs = (userId: string, gameId: string) =>
  als.run(userId, () => simulate(post(path(gameId, "/simulate")), ctx(gameId)))
const matchmakeAs = (userId: string, stake: number) =>
  als.run(userId, () => matchmake(post("/api/arena/matchmake", { stake })))
const createAs = (userId: string, body: unknown) => als.run(userId, () => create(post("/api/arena", body)))

// ─── Fixtures and ledger helpers ────────────────────────────────────────────

/** An open lobby as matchmake step 2 leaves it, the owner's stake already charged. Invite lobbies carry no marker. */
async function lobby(gameId: string, { openedAt = T0, matchmade = true } = {}) {
  const s = createGame({
    gameId,
    config: { ...DEFAULT_CONFIG, difficulty: "hard", aiPersonality: "aggressive" },
    vsAI: false,
    seed: 7,
  })
  s.isAI.P2 = false
  s.status = "lobby"
  s.econ = { mode: "pvp", amount: STAKE, settled: false }
  if (matchmade) s.matchmadeLobby = { openedAt }
  s.seatNames = { P1: "realowner" }
  h.stakes.add(`${OWNER}:${gameId}`)
  await store.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: null, state: s })
}

const stored = async (gameId: string) => (await store.loadGame(gameId))!
const json = async (gameId: string) => JSON.stringify(await store.loadGame(gameId))
const refundsOf = (gameId: string, userId?: string) =>
  h.calls.filter((c) => c.op === "refund" && c.gameId === gameId && (!userId || c.userId === userId))
const completedRefunds = (gameId: string, userId?: string) => refundsOf(gameId, userId).filter((c) => c.result === "completed")
const chargesOf = (gameId: string, userId: string) =>
  h.calls.filter((c) => c.op === "charge" && c.gameId === gameId && c.userId === userId && c.result === "completed")
/** Coins a user got back (+) or paid (−) for one game, from the mocked RPC answers. */
const net = (gameId: string, userId: string) =>
  STAKE * (completedRefunds(gameId, userId).length - chargesOf(gameId, userId).length)

function expectNoWalletCall() {
  for (const fn of [
    wallet.chargeArenaStake,
    wallet.refundArenaStake,
    wallet.settle1v1,
    wallet.awardCpuReward,
    wallet.grantWeeklyLevelBonus,
  ]) {
    expect(fn).not.toHaveBeenCalled()
  }
}

/** Let fire-and-forget deferred work (afterResponse outside a request scope) settle. Real timers: only Date is faked. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 20))
/**
 * Retry an assertion until it holds. vi.waitFor would advance the faked Date by
 * its 50 ms interval on every check, which moves the clock these tests pin.
 */
async function eventually(assertion: () => unknown, timeoutMs = 2_000) {
  const deadline = performance.now() + timeoutMs
  for (;;) {
    try {
      await assertion()
      return
    } catch (error) {
      if (performance.now() > deadline) throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}
const refundIs = (gameId: string, status: "pending" | "confirmed" | "failed") =>
  eventually(async () => expect((await stored(gameId)).state.botMatch!.refund).toBe(status))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(T_ELIGIBLE)
  store._resetStore()
  vi.clearAllMocks()
  Object.assign(h, {
    rate: null,
    heldId: null,
    preCheckOwner: null,
    names: { [OWNER]: "realowner", [JOINER]: "realguest" },
    takeAll: false,
    findTakenError: null,
    latency: false,
    gates: { charge: null, findTaken: null, refund: null },
    refundResults: [],
    calls: [],
  })
  h.stakes.clear()
  h.refunds.clear()
  h.paidGames.clear()
})
afterEach(async () => {
  h.gates.charge?.release()
  h.gates.findTaken?.release()
  h.gates.refund?.release()
  await flush() // no deferred refund from this test may land in the next one
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ─── Conversion ─────────────────────────────────────────────────────────────

describe("POST /api/arena/[gameId]/pair: the owner converts an eligible lobby", () => {
  it("answers the P1 view and commits the conversion in one write, then refunds the stake once (AC-1)", async () => {
    await lobby("conv")
    h.gates.refund = h.gate() // hold the deferred refund to see the committed record first

    const res = await pairAs(OWNER, "conv")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      gameId: "conv",
      rev: 2,
      viewer: "P1",
      status: "auction",
      isAI: { P1: false, P2: false },
      econ: { mode: "friendly", amount: STAKE, returned: false },
    })
    expect(body.lot).not.toBeNull()
    expect(body.names.P1).toBe("realowner")
    expect(body.names.P2).toMatch(HANDLE_RE)

    const committed = await stored("conv")
    expect(committed.rev).toBe(2)
    expect(committed.guestUserId).toBe(BOT_SEAT)
    expect(committed.state.isAI.P2).toBe(true)
    expect(committed.state.botMatch).toMatchObject({
      convertedAt: T_ELIGIBLE,
      waitedMs: BOT_FALLBACK_WAIT_MS,
      refund: "pending",
      shownConfig: { difficulty: "hard", aiPersonality: "aggressive" },
    })
    expect(committed.state.config).toMatchObject({ difficulty: "medium", aiPersonality: "superstar" })
    expect(committed.state.econ).toEqual({ mode: "pvp", amount: STAKE, settled: true })
    expect(committed.state.seatNames).toEqual({ P1: "realowner", P2: body.names.P2 })

    // Post-commit: off the queue, a backstop due in 5 min, the broadcast and the runner.
    expect(removeOpenGame).toHaveBeenCalledTimes(1)
    expect(removeOpenGame).toHaveBeenCalledWith("conv")
    expect(queuePendingRefund).toHaveBeenCalledTimes(1)
    expect(queuePendingRefund).toHaveBeenCalledWith("conv", OWNER, T_ELIGIBLE + BOT_REFUND_BACKSTOP_MS)
    expect(runBotTurns).toHaveBeenCalledTimes(1)
    expect(runBotTurns).toHaveBeenCalledWith("conv")
    expect(broadcastArenaUpdate).toHaveBeenCalledTimes(1)
    const [pushedId, pushed] = vi.mocked(broadcastArenaUpdate).mock.calls[0]
    expect(pushedId).toBe("conv")
    expect(pushed).toMatchObject({ viewer: "P1", rev: 2, status: "auction", names: body.names })

    h.gates.refund.release()
    await refundIs("conv", "confirmed")
    expect(wallet.refundArenaStake).toHaveBeenCalledTimes(1)
    expect(wallet.refundArenaStake).toHaveBeenCalledWith({ userId: OWNER, gameId: "conv" })
    expect(completedRefunds("conv", OWNER)).toHaveLength(1)
    expect((await stored("conv")).rev).toBe(3) // the refund status is the only other write
    expect(wallet.chargeArenaStake).not.toHaveBeenCalled()
    expect(wallet.settle1v1).not.toHaveBeenCalled()
    expect(wallet.awardCpuReward).not.toHaveBeenCalled()
  })

  it("logs one info record with the stake, the wait and the refund outcome (AC-35)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    await lobby("logged")

    expect((await pairAs(OWNER, "logged")).status).toBe(200)

    await eventually(() =>
      expect(info).toHaveBeenCalledWith("[arena/fallback] converted", {
        gameId: "logged",
        stake: STAKE,
        waitedMs: BOT_FALLBACK_WAIT_MS,
        refund: "completed",
      }),
    )
    await flush()
    expect(info.mock.calls.filter(([msg]) => msg === "[arena/fallback] converted")).toHaveLength(1)
  })

  it("runs the opponent at BOT_DIFFICULTY even though the lobby asked for hard (AC-21)", async () => {
    vi.setSystemTime(T0)
    const opened = await als.run(OWNER, () =>
      matchmake(post("/api/arena/matchmake", { stake: STAKE, difficulty: "hard" })),
    )
    expect(opened.status).toBe(201)
    const { gameId } = await opened.json()
    expect((await stored(gameId)).state.config).toMatchObject({ difficulty: "hard", aiPersonality: "aggressive" })
    vi.setSystemTime(T0 + BOT_FALLBACK_WAIT_MS)

    const body = await (await pairAs(OWNER, gameId)).json()

    expect((await stored(gameId)).state.config).toMatchObject({ difficulty: "medium", aiPersonality: "superstar" })
    expect(body.config).toMatchObject({ difficulty: "hard", aiPersonality: "aggressive" }) // the lobby's own pick, shown
  })
})

// ─── Refusals ───────────────────────────────────────────────────────────────

describe("POST /api/arena/[gameId]/pair: refusals change nothing", () => {
  it("one ms before the threshold → 409 NOT_YET with the remaining time, before any name check (AC-2)", async () => {
    await lobby("early")
    vi.setSystemTime(T0 + BOT_FALLBACK_WAIT_MS - 1)
    const before = await json("early")

    const res = await pairAs(OWNER, "early")

    expect(res.status).toBe(409)
    expect(res.headers.get("Retry-After")).toBe("1")
    expect(await res.json()).toEqual({ error: "Still looking for an opponent.", code: "NOT_YET", retryAfterMs: 1 })
    expect(await json("early")).toBe(before)
    expect(findTakenNames).not.toHaveBeenCalled()
    await flush()
    expectNoWalletCall()
  })

  it("a non-owner gets GET's byte-identical 404 for an open, a converted and a seated lobby (AC-3)", async () => {
    await lobby("open")
    await lobby("converted")
    expect((await pairAs(OWNER, "converted")).status).toBe(200)
    await refundIs("converted", "confirmed")
    await lobby("seated")
    expect((await joinAs(JOINER, "seated")).status).toBe(200)
    const missing = await getAs(STRANGER, "no-such-game")
    expect(missing.status).toBe(404)
    const getBody = await missing.text()
    expect(getBody).toBe(NOT_FOUND)
    vi.clearAllMocks()

    for (const id of ["open", "converted", "seated"]) {
      const before = await json(id)
      const res = await pairAs(STRANGER, id)
      expect(res.status).toBe(404)
      expect(await res.text()).toBe(getBody)
      const asGet = await getAs(STRANGER, id) // and what GET tells the same stranger
      expect(asGet.status).toBe(404)
      expect(await asGet.text()).toBe(getBody)
      expect(await json(id)).toBe(before)
    }
    expect(findTakenNames).not.toHaveBeenCalled()
    await flush()
    expectNoWalletCall()
  })

  it("an owner check that fails only inside the lock → the same 404, no write, and a warning (AC-3, finding 1)", async () => {
    await lobby("lock")
    const before = await json("lock")
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    h.preCheckOwner = STRANGER // the lock-free pre-check reads a copy the stranger "owns"

    const res = await pairAs(STRANGER, "lock")
    h.preCheckOwner = null

    expect(res.status).toBe(404)
    expect(await res.text()).toBe(NOT_FOUND)
    expect(findTakenNames).toHaveBeenCalledTimes(1) // it got past the pre-check and picked a name
    expect(warn).toHaveBeenCalledWith("[arena/fallback] owner mismatch inside the lock", { gameId: "lock" })
    expect(await json("lock")).toBe(before)
    expect(removeOpenGame).not.toHaveBeenCalled()
    expect(queuePendingRefund).not.toHaveBeenCalled()
    expect(runBotTurns).not.toHaveBeenCalled()
    expect(broadcastArenaUpdate).not.toHaveBeenCalled()
    await flush()
    expectNoWalletCall()
  })

  it.each([["bad id!"], ["a".repeat(65)]])("a malformed id (%j) → the same 404 without a read", async (gameId) => {
    const res = await pairAs(OWNER, gameId)
    expect(res.status).toBe(404)
    expect(await res.text()).toBe(NOT_FOUND)
    expect(store.loadGame).not.toHaveBeenCalled()
  })

  it("an invite lobby is never paired, even an hour later (AC-4)", async () => {
    vi.setSystemTime(T0)
    const created = await createAs(OWNER, { mode: "human", stake: STAKE })
    expect(created.status).toBe(201)
    const { gameId } = await created.json()
    expect((await stored(gameId)).state.matchmadeLobby).toBeUndefined()
    vi.setSystemTime(T0 + 60 * 60_000)
    const before = await json(gameId)

    const res = await pairAs(OWNER, gameId)

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "This search can't be paired.", code: "UNAVAILABLE" })
    expect(await json(gameId)).toBe(before)
    expect(findTakenNames).not.toHaveBeenCalled()
    await flush()
    expect(wallet.refundArenaStake).not.toHaveBeenCalled()
  })

  it("a lobby without the public marker (a pre-deploy lobby) is refused too (AC-4)", async () => {
    // The fixture shape matchmake-route.test.ts uses for a held lobby.
    const s = createGame({ gameId: "premarker", config: { ...DEFAULT_CONFIG }, vsAI: false })
    s.isAI.P2 = false
    s.status = "lobby"
    s.econ = { mode: "pvp", amount: 50, settled: false }
    await store.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: null, state: s })
    const before = await json("premarker")

    const res = await pairAs(OWNER, "premarker")

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("UNAVAILABLE")
    expect(await json("premarker")).toBe(before)
    await flush()
    expectNoWalletCall()
  })

  it("a swept lobby → 409 UNAVAILABLE; a missing record → 404; no wallet call (AC-5)", async () => {
    await lobby("swept")
    await store.mutateGame("swept", (g) => {
      g.guestUserId = "lobby-closed"
    })
    const before = await json("swept")

    const closed = await pairAs(OWNER, "swept")
    const missing = await pairAs(OWNER, "gone")

    expect(closed.status).toBe(409)
    expect(await closed.json()).toEqual({ error: "This search can't be paired.", code: "UNAVAILABLE" })
    expect(await json("swept")).toBe(before)
    expect(missing.status).toBe(404)
    expect(await missing.text()).toBe(NOT_FOUND)
    await flush()
    expectNoWalletCall()
  })

  it("a lobby at LOBBY_MAX_AGE_MS is left to the sweep, with an info log; a lobby with no stake is refused", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    await lobby("old")
    await lobby("free")
    await store.mutateGame("free", (g) => {
      delete g.state.econ
    })
    vi.setSystemTime(T0 + LOBBY_MAX_AGE_MS)

    const old = await pairAs(OWNER, "old")
    const free = await pairAs(OWNER, "free")

    expect(old.status).toBe(409)
    expect((await old.json()).code).toBe("UNAVAILABLE")
    expect(info).toHaveBeenCalledWith("[arena/fallback] lobby too old to pair", { gameId: "old" })
    expect(free.status).toBe(409)
    expect((await free.json()).code).toBe("UNAVAILABLE")
    expect(info).toHaveBeenCalledTimes(1) // not_pvp logs nothing
    expect((await stored("old")).state.botMatch).toBeUndefined()
    await flush()
    expectNoWalletCall()
  })

  it("rate limited → 429 with Retry-After, before any read; no session → 401", async () => {
    await lobby("limited")
    h.rate = { allowed: false, retryAfterMs: 4_500 }

    const limited = await pairAs(OWNER, "limited")

    expect(limited.status).toBe(429)
    expect(limited.headers.get("Retry-After")).toBe("5")
    expect(await limited.json()).toEqual({ error: "Too many attempts. Slow down." })
    expect(checkRateLimit).toHaveBeenCalledWith(`arena-pair:${OWNER}`, RATE_LIMITS.arenaJoin)
    expect(store.loadGame).not.toHaveBeenCalled()

    const anonymous = await pair(post(path("limited", "/pair")), ctx("limited")) // outside als.run: no user
    expect(anonymous.status).toBe(401)
    expect(await anonymous.json()).toEqual({ error: "Authentication required." })
    expect((await stored("limited")).state.botMatch).toBeUndefined()
  })

  it("a failed name check → 503 with Retry-After: 2 and nothing changed; so are 12 taken candidates", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await lobby("busy")
    const before = await json("busy")
    h.findTakenError = new Error("profiles lookup timed out")

    const failed = await pairAs(OWNER, "busy")

    expect(failed.status).toBe(503)
    expect(failed.headers.get("Retry-After")).toBe("2")
    expect(await failed.json()).toEqual({ error: "That game is busy right now. Retry in a moment." })
    expect(warn).toHaveBeenCalledWith("[arena/fallback] name check failed", { gameId: "busy" })
    expect(await json("busy")).toBe(before)

    h.findTakenError = null
    h.takeAll = true
    vi.mocked(findTakenNames).mockClear()

    const taken = await pairAs(OWNER, "busy")

    expect(taken.status).toBe(503)
    expect(taken.headers.get("Retry-After")).toBe("2")
    expect(findTakenNames).toHaveBeenCalledTimes(2) // two rounds of 6, all taken
    expect(await json("busy")).toBe(before)
    expect(removeOpenGame).not.toHaveBeenCalled()
    await flush()
    expectNoWalletCall()
  })
})

// ─── Race safety ────────────────────────────────────────────────────────────

describe("POST /api/arena/[gameId]/pair: a real opponent seated first wins", () => {
  it("answers the real match, converts nothing and refunds nobody; the match then settles as today (AC-7)", async () => {
    await lobby("real")
    vi.setSystemTime(T0 + 5_000)
    expect((await joinAs(JOINER, "real")).status).toBe(200)
    vi.setSystemTime(T_ELIGIBLE)
    const seated = await stored("real")

    const res = await pairAs(OWNER, "real")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      viewer: "P1",
      status: "auction",
      rev: seated.rev,
      isAI: { P1: false, P2: false },
      names: { P1: "realowner", P2: "realguest" },
      econ: { mode: "pvp", amount: STAKE, settled: false },
    })
    expect(await json("real")).toBe(JSON.stringify(seated))
    expect(removeOpenGame).not.toHaveBeenCalled()
    await flush()
    expect(refundsOf("real")).toEqual([])

    await store.mutateGame("real", (g) => {
      for (let i = 0; g.state.status === "auction" && i < 5000; i++) serverTick(g.state, (g.state.lotDeadline ?? Date.now()) + 1)
    })
    expect((await stored("real")).state.status).toBe("lineup")
    expect((await simulateAs(OWNER, "real")).status).toBe(200)
    expect(wallet.settle1v1).toHaveBeenCalledTimes(1)
    expect(wallet.settle1v1).toHaveBeenCalledWith(expect.objectContaining({ gameId: "real", payout: stakePayout(STAKE) }))
  })

  it("50 concurrent pair + join runs each end in exactly one outcome, and both outcomes occur (AC-9)", async () => {
    h.latency = true
    const outcomes = { botSeated: 0, realSeated: 0 }

    for (let i = 0; i < 50; i++) {
      const id = `race-${i}`
      await lobby(id, { openedAt: T_ELIGIBLE - 20_000 })

      const [paired, joined] = await Promise.all([pairAs(OWNER, id), joinAs(JOINER, id)])
      const pairBody = await paired.json()
      expect(paired.status).toBe(200)
      const record = await stored(id)

      if (record.guestUserId === BOT_SEAT) {
        outcomes.botSeated++
        expect(joined.status).toBe(409)
        expect(await joined.json()).toEqual({ error: "This game is already full." })
        expect(pairBody.names.P2).toMatch(HANDLE_RE)
        await refundIs(id, "confirmed")
        expect(completedRefunds(id, OWNER)).toHaveLength(1)
        expect(chargesOf(id, JOINER).length).toBeLessThanOrEqual(1) // charged unless the pre-check saw the conversion
        expect(net(id, JOINER)).toBe(0)
      } else {
        outcomes.realSeated++
        expect(record.guestUserId).toBe(JOINER)
        expect(record.state.botMatch).toBeUndefined()
        expect(joined.status).toBe(200)
        expect(pairBody.names.P2).toBe("realguest")
        expect(pairBody.isAI).toEqual({ P1: false, P2: false })
        await flush()
        expect(refundsOf(id)).toEqual([])
        expect(chargesOf(id, JOINER)).toHaveLength(1)
      }
    }

    expect(outcomes.botSeated + outcomes.realSeated).toBe(50)
    expect(outcomes.botSeated).toBeGreaterThan(0)
    expect(outcomes.realSeated).toBeGreaterThan(0)
  })

  it("gated: the conversion commits before the joiner's seat claim, so the joiner is refunded (AC-9)", async () => {
    await lobby("gate-bot", { openedAt: T_ELIGIBLE - 20_000 })
    h.gates.charge = h.gate()

    const joining = joinAs(JOINER, "gate-bot")
    await h.gates.charge.reached // the join passed its pre-check and is being charged
    const paired = await pairAs(OWNER, "gate-bot") // the conversion commits meanwhile
    h.gates.charge.release()
    const joined = await joining

    expect(paired.status).toBe(200)
    expect(joined.status).toBe(409)
    expect((await stored("gate-bot")).guestUserId).toBe(BOT_SEAT)
    await refundIs("gate-bot", "confirmed")
    expect(chargesOf("gate-bot", JOINER)).toHaveLength(1)
    expect(completedRefunds("gate-bot", JOINER)).toHaveLength(1)
    expect(completedRefunds("gate-bot", OWNER)).toHaveLength(1)
  })

  it("gated: the joiner commits while the pair request checks its name, so the owner gets the real match (AC-9)", async () => {
    await lobby("gate-real", { openedAt: T_ELIGIBLE - 20_000 })
    h.gates.findTaken = h.gate()

    const pairing = pairAs(OWNER, "gate-real")
    await h.gates.findTaken.reached // the pre-check found it eligible
    const joined = await joinAs(JOINER, "gate-real") // the real joiner commits first
    h.gates.findTaken.release()
    const paired = await pairing

    expect(joined.status).toBe(200)
    expect(paired.status).toBe(200)
    expect((await paired.json()).names).toEqual({ P1: "realowner", P2: "realguest" })
    const record = await stored("gate-real")
    expect(record.guestUserId).toBe(JOINER)
    expect(record.state.botMatch).toBeUndefined()
    expect(removeOpenGame).not.toHaveBeenCalled()
    await flush()
    expect(refundsOf("gate-real")).toEqual([])
    expect(chargesOf("gate-real", JOINER)).toHaveLength(1)
  })
})

describe("POST /api/arena/[gameId]/pair: repeats never double-refund", () => {
  it("a repeat request answers the same persona with no state change; one refund in total (AC-12)", async () => {
    await lobby("again")
    const first = await (await pairAs(OWNER, "again")).json()
    await refundIs("again", "confirmed")
    const after = await json("again")

    const res = await pairAs(OWNER, "again")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.names.P2).toBe(first.names.P2)
    expect(body.rev).toBe(JSON.parse(after).rev)
    expect(await json("again")).toBe(after)
    expect(findTakenNames).toHaveBeenCalledTimes(1) // the repeat stopped at the pre-check
    expect(removeOpenGame).toHaveBeenCalledTimes(1)
    await flush()
    expect(completedRefunds("again")).toHaveLength(1)
  })

  it("three concurrent owner requests convert once: same persona, one completed refund, one stake back (AC-12)", async () => {
    await lobby("triple")

    const responses = await Promise.all([pairAs(OWNER, "triple"), pairAs(OWNER, "triple"), pairAs(OWNER, "triple")])

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200])
    const bodies = await Promise.all(responses.map((r) => r.json()))
    const persona = (await stored("triple")).state.seatNames!.P2
    expect(bodies.map((b) => b.names.P2)).toEqual([persona, persona, persona])
    await refundIs("triple", "confirmed")
    await flush()
    // The post-commit work ran once, so one request converted.
    expect(removeOpenGame).toHaveBeenCalledTimes(1)
    expect(queuePendingRefund).toHaveBeenCalledTimes(1)
    expect(runBotTurns).toHaveBeenCalledTimes(1)
    expect((await stored("triple")).rev).toBe(3) // conversion + the refund status
    expect(completedRefunds("triple")).toHaveLength(1)
    expect(refundsOf("triple").every((c) => c.result === "completed" || c.result === "duplicate")).toBe(true)
    expect(net("triple", OWNER)).toBe(STAKE)
  })

  it("a refund that errors at conversion stays pending; a repeat request retries it to confirmed", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    h.refundResults = ["error"]
    await lobby("retry")

    expect((await pairAs(OWNER, "retry")).status).toBe(200)
    await eventually(() => expect(refundsOf("retry")).toHaveLength(1))
    await flush()
    expect((await stored("retry")).state.botMatch!.refund).toBe("pending")
    expect(error).toHaveBeenCalledWith("[arena/refund] failed", { gameId: "retry", userId: OWNER })

    expect((await pairAs(OWNER, "retry")).status).toBe(200)

    await refundIs("retry", "confirmed")
    expect(refundsOf("retry").map((c) => c.result)).toEqual(["error", "completed"])
  })

  it("does not touch the queue on already, seated or not_yet (AC-11, NIT 15)", async () => {
    await lobby("ny")
    vi.setSystemTime(T0 + 1_000)
    expect((await pairAs(OWNER, "ny")).status).toBe(409)

    await lobby("st")
    expect((await joinAs(JOINER, "st")).status).toBe(200)
    vi.setSystemTime(T_ELIGIBLE)
    expect((await pairAs(OWNER, "st")).status).toBe(200)

    await lobby("al")
    expect((await pairAs(OWNER, "al")).status).toBe(200)
    expect(removeOpenGame).toHaveBeenCalledTimes(1) // the conversion itself
    await refundIs("al", "confirmed")
    vi.mocked(removeOpenGame).mockClear()
    expect((await pairAs(OWNER, "al")).status).toBe(200)

    expect(removeOpenGame).not.toHaveBeenCalled()
  })
})

// ─── What the owner sees ────────────────────────────────────────────────────

describe("POST /api/arena/[gameId]/pair: one persona everywhere, no internals (AC-27, AC-30)", () => {
  it("the pair response, a later GET, the broadcast and a /join re-entry all show the same persona as a person", async () => {
    await lobby("same")
    const pairText = await (await pairAs(OWNER, "same")).text()
    const persona = JSON.parse(pairText).names.P2
    await refundIs("same", "confirmed")
    vi.setSystemTime(T_ELIGIBLE + 3_000)
    const getText = await (await getAs(OWNER, "same")).text()
    const joinRes = await joinAs(OWNER, "same")
    expect(joinRes.status).toBe(200)
    const joinText = await joinRes.text()
    const pushes = vi.mocked(broadcastArenaUpdate).mock.calls.map(([, pushed]) => JSON.stringify(pushed))
    expect(pushes.length).toBeGreaterThanOrEqual(1)

    for (const text of [pairText, getText, joinText, ...pushes]) {
      expect(text).not.toMatch(INTERNAL)
      const payload = JSON.parse(text)
      expect(payload.names).toEqual({ P1: "realowner", P2: persona })
      expect(payload.isAI).toEqual({ P1: false, P2: false })
      expect(payload.config.difficulty).toBe("hard")
      expect(payload.viewer).toBe("P1")
    }
  })
})

describe("held lobby, then the fallback (AC-37, NIT 15)", () => {
  it("a held lobby keeps its openedAt across Resume, and converts only once the threshold has passed", async () => {
    const T = T0 + 10 * 60_000
    vi.setSystemTime(T)
    const opened = await matchmakeAs(OWNER, STAKE)
    expect(opened.status).toBe(201)
    const { gameId } = await opened.json()
    expect(wallet.chargeArenaStake).toHaveBeenCalledTimes(1)
    h.heldId = gameId

    vi.setSystemTime(T + 5_000)
    const bigger = await matchmakeAs(OWNER, 100)
    expect(bigger.status).toBe(409)
    expect(await bigger.json()).toEqual(expect.objectContaining({ gameId, stake: STAKE }))
    const resumed = await matchmakeAs(OWNER, STAKE)
    expect(resumed.status).toBe(200)
    expect((await resumed.json()).gameId).toBe(gameId)
    expect(wallet.chargeArenaStake).toHaveBeenCalledTimes(1)
    expect((await stored(gameId)).state.matchmadeLobby).toEqual({ openedAt: T })

    vi.setSystemTime(T + BOT_FALLBACK_WAIT_MS - 1)
    const early = await pairAs(OWNER, gameId)
    expect(early.status).toBe(409)
    expect(await early.json()).toMatchObject({ code: "NOT_YET", retryAfterMs: 1 })
    expect((await stored(gameId)).state.botMatch).toBeUndefined()

    vi.setSystemTime(T + BOT_FALLBACK_WAIT_MS)
    const paired = await pairAs(OWNER, gameId)
    expect(paired.status).toBe(200)
    expect((await stored(gameId)).guestUserId).toBe(BOT_SEAT)
    await refundIs(gameId, "confirmed")
    expect(completedRefunds(gameId, OWNER)).toHaveLength(1)
    expect(net(gameId, OWNER)).toBe(0) // charged at step 2, refunded at conversion
  })
})
