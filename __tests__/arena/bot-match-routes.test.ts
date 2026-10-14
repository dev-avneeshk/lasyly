/**
 * Bot matches through the real bid, pass and GET routes (design §6.4, AC-21 to
 * AC-24). The opponent never answers inside the human's request: each clock
 * step only plans its move 0.7-2.2 s out, and a GET at the due time lands it
 * (the runner that normally does is mocked here and unit-tested in
 * bot-turns.test.ts). Real 1v1s and server CPU games are unchanged.
 *
 * Lobbies come from matchmake step 2 (difficulty "hard") under a faked Date and
 * are converted by the owner's pair request 15 s later. The opponent's
 * decisions are forced per test through the decideAI pass-through mock.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { AIDecision } from "@/lib/arena/ai"
import type { ArenaState } from "@/lib/arena/auction"
import type { TeamId } from "@/lib/arena/types"

const h = vi.hoisted(() => ({
  userId: "owner",
  decide: null as null | ((s: ArenaState, t: TeamId) => AIDecision),
  names: {} as Record<string, string>,
  stakes: new Set<string>(),
  refunds: new Set<string>(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: h.userId } } }) } }),
}))
vi.mock("@/lib/rateLimit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rateLimit")>()),
  checkRateLimit: async () => ({ allowed: true, retryAfterMs: 0 }),
}))
vi.mock("@/lib/economy/wallet", () => ({
  chargeArenaStake: vi.fn(async ({ userId, gameId }: { userId: string; gameId: string }) => {
    const key = `${userId}:${gameId}`
    if (h.stakes.has(key)) return "duplicate"
    h.stakes.add(key)
    return "completed"
  }),
  refundArenaStake: vi.fn(async ({ userId, gameId }: { userId: string; gameId: string }) => {
    const key = `${userId}:${gameId}`
    if (h.refunds.has(key)) return "duplicate"
    if (!h.stakes.has(key)) return "nothing_to_refund"
    h.refunds.add(key)
    return "completed"
  }),
  settle1v1: vi.fn(async () => "completed"),
  awardCpuReward: vi.fn(async () => "completed"),
  grantWeeklyLevelBonus: vi.fn(async () => "completed"),
}))
vi.mock("@/lib/realtime/arena", async (orig) => ({
  ...(await orig<typeof import("@/lib/realtime/arena")>()),
  broadcastArenaUpdate: vi.fn(async () => {}),
  registerArenaChannelMember: vi.fn(async () => true),
}))
vi.mock("@/lib/arena/identity", () => ({
  lookupSeatName: vi.fn(async (userId: string) => h.names[userId] ?? null),
  findTakenNames: vi.fn(async () => new Set<string>()),
}))
vi.mock("@/lib/arena/botTurns", () => ({ runBotTurns: vi.fn(async () => {}) }))
// Never reach a real Redis (or its refund queue), whatever the shell exports (D-29).
vi.mock("@/lib/redis", () => ({ getRedisClient: () => null }))
vi.mock("@/lib/arena/ai", async (orig) => {
  const real = await orig<typeof import("@/lib/arena/ai")>()
  return {
    ...real,
    decideAI: vi.fn((s: ArenaState, t: TeamId) => (h.decide ? h.decide(s, t) : real.decideAI(s, t))),
  }
})

import * as pairRoute from "@/app/api/arena/[gameId]/pair/route"
import * as getRoute from "@/app/api/arena/[gameId]/route"
import * as bidRoute from "@/app/api/arena/[gameId]/bid/route"
import * as passRoute from "@/app/api/arena/[gameId]/pass/route"
import * as simulateRoute from "@/app/api/arena/[gameId]/simulate/route"
import { POST as join } from "@/app/api/arena/[gameId]/join/route"
import { POST as matchmake } from "@/app/api/arena/matchmake/route"
import { POST as create } from "@/app/api/arena/route"
import { minRaise } from "@/lib/arena/auction"
import { BOT_DEADLINE_MARGIN_MS, BOT_THINK_MAX_MS, BOT_THINK_MIN_MS, lotKey } from "@/lib/arena/botMatch"
import { runBotTurns } from "@/lib/arena/botTurns"
import { BOT_FALLBACK_WAIT_MS } from "@/lib/arena/fallbackTiming"
import * as store from "@/lib/arena/store"
import { broadcastArenaUpdate } from "@/lib/realtime/arena"

const T0 = Date.UTC(2026, 9, 13, 18, 0, 0) // the lobby opened
const T_CONVERT = T0 + BOT_FALLBACK_WAIT_MS
const OWNER = "owner"
const JOINER = "joiner"
const STAKE = 25
const INTERNAL = /bot-seat|botMatch|matchmadeLobby|seatNames|lastKey|shownConfig/

type Decide = (s: ArenaState, t: TeamId) => AIDecision
const decline: Decide = () => ({ action: "pass" })
const bidMin: Decide = (s, t) => ({ action: "bid", amount: minRaise(s, t)! })

const ctx = (gameId: string) => ({ params: Promise.resolve({ gameId }) })
const post = (path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
const getView = async (gameId: string) => {
  const res = await getRoute.GET(new Request(`http://localhost/api/arena/${gameId}`), ctx(gameId))
  expect(res.status).toBe(200)
  return res.json()
}
const stored = async (gameId: string) => (await store.loadGame(gameId))!

interface ViewBid {
  bidder: TeamId
  playerId: string
  ts: number
}
const p2Bids = (history: ViewBid[]) => history.filter((b) => b.bidder === "P2")

/** Open a public lobby through matchmake step 2. */
async function openLobby(): Promise<string> {
  vi.setSystemTime(T0)
  h.userId = OWNER
  const res = await matchmake(post("/api/arena/matchmake", { stake: STAKE, difficulty: "hard" }))
  expect(res.status).toBe(201)
  return (await res.json()).gameId
}

/** A public lobby converted by its owner 15 s after it opened; `decide` is the opponent's lot-1 call (decline: it stands pat). */
async function botMatch(decide: Decide = decline): Promise<string> {
  const gameId = await openLobby()
  vi.setSystemTime(T_CONVERT)
  h.decide = decide
  const res = await pairRoute.POST(post(`/api/arena/${gameId}/pair`), ctx(gameId))
  expect(res.status).toBe(200)
  // The conversion's own refund runs after the response: let it record its result first.
  await eventually(async () => expect((await stored(gameId)).state.botMatch!.refund).toBe("confirmed"))
  vi.clearAllMocks()
  return gameId
}

/** The human claims the open lot at the minimum, at `at`, confirming the lot it is bidding on. */
async function humanBids(gameId: string, at: number) {
  vi.setSystemTime(at)
  const s = (await stored(gameId)).state
  const res = await bidRoute.POST(
    post(`/api/arena/${gameId}/bid`, { amount: minRaise(s, "P1"), lotPlayerId: s.lot!.player.id }),
    ctx(gameId),
  )
  expect(res.status).toBe(200)
  return res.json()
}

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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(T0)
  store._resetStore()
  vi.clearAllMocks()
  h.userId = OWNER
  h.decide = null
  h.names = { [OWNER]: "realowner", [JOINER]: "realguest" }
  h.stakes.clear()
  h.refunds.clear()
})
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 20)) // let deferred work from this test settle
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("bid route, bot match: the opponent's reply is deferred (AC-22)", () => {
  it("the bid response carries no opponent move; the reply is planned 0.7-2.2 s out, before the deadline margin", async () => {
    const id = await botMatch() // stands pat on lot 1
    h.decide = bidMin // it will answer the human's bid
    const bidAt = T_CONVERT + 1_000

    const body = await humanBids(id, bidAt)

    expect(body.lot.highBidder).toBe("P1")
    expect(body.history.at(-1)).toMatchObject({ bidder: "P1", ts: bidAt })
    expect(p2Bids(body.history)).toEqual([])
    expect(JSON.stringify(body)).not.toMatch(INTERNAL)
    const s = (await stored(id)).state
    const p = s.botMatch!.pending!
    expect(p).toMatchObject({ kind: "bid", key: lotKey(s) })
    expect(p.dueAt).toBeGreaterThanOrEqual(bidAt + BOT_THINK_MIN_MS)
    expect(p.dueAt).toBeLessThanOrEqual(bidAt + BOT_THINK_MAX_MS)
    expect(p.dueAt).toBeLessThan(s.lotDeadline! - BOT_DEADLINE_MARGIN_MS)
    expect(runBotTurns).toHaveBeenCalledTimes(1)
    expect(runBotTurns).toHaveBeenCalledWith(id)
  })

  it("a GET at the due time takes the slow path, lands the reply and broadcasts it; nothing new is then pending", async () => {
    const id = await botMatch()
    h.decide = bidMin
    const bidAt = T_CONVERT + 1_000
    await humanBids(id, bidAt)
    const before = await stored(id)
    const p = before.state.botMatch!.pending!
    vi.mocked(runBotTurns).mockClear()
    vi.mocked(broadcastArenaUpdate).mockClear()
    vi.setSystemTime(p.dueAt)

    const body = await getView(id)

    const replies = p2Bids(body.history)
    expect(replies).toHaveLength(1)
    expect(replies[0].ts).toBe(p.dueAt)
    expect(replies[0].ts).toBeGreaterThanOrEqual(bidAt + BOT_THINK_MIN_MS)
    expect(body.lot.highBidder).toBe("P2")
    expect(body.rev).toBe(before.rev + 1)
    expect(broadcastArenaUpdate).toHaveBeenCalledTimes(1)
    expect(vi.mocked(broadcastArenaUpdate).mock.calls[0][1]).toMatchObject({ rev: body.rev, viewer: "P1" })
    expect((await stored(id)).state.botMatch!.pending).toBeNull() // P2 leads: nothing to plan
    expect(runBotTurns).not.toHaveBeenCalled()
  })

  it("a planned reply overtaken by the lot resolving is never placed; the next lot gets a fresh plan", async () => {
    const id = await botMatch()
    h.decide = bidMin
    await humanBids(id, T_CONVERT + 1_000)
    const before = (await stored(id)).state
    const lot1 = before.lot!.player.id
    expect(before.botMatch!.pending).toMatchObject({ kind: "bid" })
    vi.mocked(runBotTurns).mockClear()
    vi.setSystemTime(before.lotDeadline!) // the reply was never landed by a runner

    const body = await getView(id)

    expect(body.results).toEqual([expect.objectContaining({ playerId: lot1, winner: "P1" })])
    expect(p2Bids(body.history).filter((b) => b.playerId === lot1)).toEqual([])
    const s = (await stored(id)).state
    expect(s.lot!.player.id).not.toBe(lot1)
    expect(s.botMatch!.pending).toMatchObject({ kind: "bid", key: lotKey(s) })
    expect(s.botMatch!.pending!.dueAt).toBeGreaterThanOrEqual(before.lotDeadline! + BOT_THINK_MIN_MS)
    expect(runBotTurns).toHaveBeenCalledTimes(1) // that GET started a runner for the new plan
  })
})

describe("GET route, bot match: one action per lot state (AC-23, AC-24)", () => {
  it("polls before the move is due are fast-path no-ops; the due poll lands exactly one action; a further poll adds none", async () => {
    const id = await botMatch()
    h.decide = bidMin
    await humanBids(id, T_CONVERT + 1_000)
    const before = await stored(id)
    const p = before.state.botMatch!.pending!

    for (const t of [p.dueAt - 2, p.dueAt - 1]) {
      vi.setSystemTime(t)
      expect((await getView(id)).rev).toBe(before.rev)
    }
    expect(JSON.stringify(await stored(id))).toBe(JSON.stringify(before)) // dueAt unchanged, nothing written

    vi.setSystemTime(p.dueAt)
    expect(p2Bids((await getView(id)).history)).toHaveLength(1)
    vi.setSystemTime(p.dueAt + 1)
    expect(p2Bids((await getView(id)).history)).toHaveLength(1)
  })

  it("the opponent's first lot-1 move lands no earlier than conversion + 700 ms (AC-24)", async () => {
    const id = await botMatch(bidMin) // it will claim lot 1
    const before = await stored(id)
    const p = before.state.botMatch!.pending!
    expect(p.kind).toBe("bid")
    expect(p.dueAt).toBeGreaterThanOrEqual(T_CONVERT + BOT_THINK_MIN_MS)
    vi.setSystemTime(T_CONVERT + BOT_THINK_MIN_MS - 1)

    const body = await getView(id)

    expect(p2Bids(body.history)).toEqual([])
    expect(body.rev).toBe(before.rev)
  })
})

describe("pass behaviour, bot match (Q-7, D-13)", () => {
  it("the opponent declines while the human leads: it plans a pass, which a later GET lands, so the human wins the lot", async () => {
    const id = await botMatch()
    h.decide = decline
    const bidAt = T_CONVERT + 1_000

    const body = await humanBids(id, bidAt)

    const lot1 = body.lot.player.id
    expect(body.lot.highBidder).toBe("P1")
    expect(body.passed).toEqual([])
    expect(body.results).toEqual([])
    const p = (await stored(id)).state.botMatch!.pending!
    expect(p.kind).toBe("pass")
    expect(p.dueAt).toBeGreaterThanOrEqual(bidAt + BOT_THINK_MIN_MS)
    expect(p.dueAt).toBeLessThanOrEqual(bidAt + BOT_THINK_MAX_MS)
    vi.setSystemTime(p.dueAt)

    const after = await getView(id)

    expect(after.results).toEqual([expect.objectContaining({ playerId: lot1, winner: "P1" })])
    expect(after.lot.player.id).not.toBe(lot1)
  })

  it("the human passes an unclaimed lot: no opponent pass in that response; a later GET lands it and the lot passes out", async () => {
    const id = await botMatch()
    h.decide = decline
    const passAt = T_CONVERT + 1_000
    vi.setSystemTime(passAt)
    const lot1 = (await stored(id)).state.lot!.player.id

    const res = await passRoute.POST(post(`/api/arena/${id}/pass`), ctx(id))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.passed).toEqual(["P1"])
    expect(body.lot.player.id).toBe(lot1)
    expect(JSON.stringify(body)).not.toMatch(INTERNAL)
    const p = (await stored(id)).state.botMatch!.pending!
    expect(p.kind).toBe("pass")
    expect(p.dueAt).toBeGreaterThanOrEqual(passAt + BOT_THINK_MIN_MS)
    expect(p.dueAt).toBeLessThanOrEqual(passAt + BOT_THINK_MAX_MS)
    expect(runBotTurns).toHaveBeenCalledTimes(1)
    vi.setSystemTime(p.dueAt)

    const after = await getView(id)

    expect(after.results).toEqual([]) // nobody bought it
    expect(after.passed).toEqual([])
    expect((await stored(id)).state.reoffers).toEqual({ [lot1]: 1 }) // back on the board for later
  })
})

describe("real games are unchanged (FR-4.5, FR-11)", () => {
  it("a real 1v1 bid writes no bot state and starts no runner", async () => {
    const id = await openLobby()
    h.userId = JOINER
    expect((await join(post(`/api/arena/${id}/join`), ctx(id))).status).toBe(200)
    h.userId = OWNER

    const body = await humanBids(id, T0 + 2_000)

    expect(body.lot.highBidder).toBe("P1")
    expect(p2Bids(body.history)).toEqual([])
    expect((await stored(id)).state.botMatch).toBeUndefined()
    expect(runBotTurns).not.toHaveBeenCalled()
  })

  it("a server CPU game still answers inside the bid response", async () => {
    // The CPU stands pat on an unclaimed lot (at creation and in the bid's first clock step) and counters a bid.
    h.decide = (s, t) => (s.lot?.highBidder && s.lot.highBidder !== t ? bidMin(s, t) : decline(s, t))
    const created = await create(post("/api/arena", { mode: "ai" }))
    expect(created.status).toBe(201)
    const { gameId } = await created.json()

    const body = await humanBids(gameId, T0 + 1_000)

    expect(body.history.map((b: ViewBid) => b.bidder)).toEqual(["P1", "P2"])
    expect(body.lot.highBidder).toBe("P2")
    expect(body.isAI).toEqual({ P1: false, P2: true })
    expect((await stored(gameId)).state.botMatch).toBeUndefined()
    expect(runBotTurns).not.toHaveBeenCalled()
  })
})

describe("route duration limit (D-30, NIT 14)", () => {
  it("pair, GET, bid, pass and simulate export maxDuration = 60", () => {
    for (const route of [pairRoute, getRoute, bidRoute, passRoute, simulateRoute]) {
      expect(route.maxDuration).toBe(60)
    }
  })
})
