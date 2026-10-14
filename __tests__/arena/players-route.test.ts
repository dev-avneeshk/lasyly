/**
 * GET /api/arena/[gameId]/players (design §8.3, D-17, FR-8.3). A converted
 * lobby's opponent gets a human-shaped persona card, answered before any query
 * and never written anywhere. No card carries a user id. Arena W/L comes from
 * the ledger, and a refunded stake is no game played.
 *
 * The service-role admin client is a chainable stub over per-user profile and
 * ledger rows that records every call, so the tests can prove what was read and
 * that nothing was written.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

type LedgerRow = { type: string; amount: number; reference_id: string }
type Call = { table: string; method: string; args: unknown[] }

const h = vi.hoisted(() => ({
  userId: null as string | null,
  profiles: {} as Record<string, Record<string, unknown>>,
  ledgers: {} as Record<string, LedgerRow[]>,
  calls: [] as Call[],
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
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    const record = (table: string, method: string, args: unknown[]) => h.calls.push({ table, method, args })
    const refuse = (table: string, method: string) => (...args: unknown[]) => {
      record(table, method, args)
      throw new Error(`/players must not ${method} ${table}`)
    }
    return {
      rpc: refuse("-", "rpc"),
      from: (table: string) => {
        record(table, "from", [table])
        const eq: Record<string, unknown> = {}
        let types: string[] | null = null
        const rows = () =>
          table === "transactions"
            ? (h.ledgers[String(eq.user_id)] ?? []).filter((r) => !types || types.includes(r.type))
            : []
        const builder = {
          select: (...args: unknown[]) => {
            record(table, "select", args)
            return builder
          },
          eq: (column: string, value: unknown) => {
            record(table, "eq", [column, value])
            eq[column] = value
            return builder
          },
          in: (column: string, values: string[]) => {
            record(table, "in", [column, values])
            types = values
            return builder
          },
          maybeSingle: async () => {
            record(table, "maybeSingle", [])
            return { data: table === "profiles" ? (h.profiles[String(eq.id)] ?? null) : null, error: null }
          },
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
          insert: refuse(table, "insert"),
          update: refuse(table, "update"),
          upsert: refuse(table, "upsert"),
          delete: refuse(table, "delete"),
        }
        return builder
      },
    }
  }),
}))
// The route reaches lib/arena/persona.ts, which imports the profiles lookups (D-29).
vi.mock("@/lib/arena/identity", () => ({
  lookupSeatName: vi.fn(async () => null),
  findTakenNames: vi.fn(async () => new Set<string>()),
}))
vi.mock("@/lib/redis", () => ({ getRedisClient: () => null }))

import { GET as players } from "@/app/api/arena/[gameId]/players/route"
import { createGame, openNextLot } from "@/lib/arena/auction"
import { BOT_SEAT, applyConversion, type ConversionOutcome } from "@/lib/arena/botMatch"
import { BOT_FALLBACK_WAIT_MS } from "@/lib/arena/fallbackTiming"
import * as store from "@/lib/arena/store"
import { DEFAULT_CONFIG } from "@/lib/arena/types"
import { createAdminClient } from "@/lib/supabase/admin"

const T0 = Date.UTC(2026, 9, 13, 18, 0, 0)
// UUID-shaped like real user ids, so a leak would be visible in a payload scan.
const OWNER = "6f1d2c3b-1111-4222-8333-444455556666"
const GUEST = "9a8b7c6d-5555-4666-8777-888899990000"
const PERSONA = "hoopsjunkie23"
const MAX_AGE_MS = 150 * 60_000

const ctx = (gameId: string) => ({ params: Promise.resolve({ gameId }) })
async function cards(gameId: string) {
  const res = await players(new Request(`http://localhost/api/arena/${gameId}/players`), ctx(gameId))
  return { status: res.status, body: await res.json() }
}

const stake = (ref: string): LedgerRow => ({ type: "ARENA_STAKE", amount: -25, reference_id: ref })
const refund = (ref: string): LedgerRow => ({ type: "ARENA_REFUND", amount: 25, reference_id: ref })
const winnings = (ref: string): LedgerRow => ({ type: "ARENA_WINNINGS", amount: 48, reference_id: ref })
const profile = (id: string, username: string, extra: Record<string, unknown> = {}) => ({
  id,
  username,
  display_name: username,
  avatar_url: `https://cdn.example.test/${username}.png`,
  level: 4,
  xp: 600,
  is_verified: false,
  ...extra,
})

function lobbyState(gameId: string) {
  const s = createGame({
    gameId,
    config: { ...DEFAULT_CONFIG, difficulty: "hard", aiPersonality: "aggressive" },
    vsAI: false,
    seed: 7,
  })
  s.isAI.P2 = false
  s.status = "lobby"
  s.econ = { mode: "pvp", amount: 25, settled: false }
  s.matchmadeLobby = { openedAt: T0 }
  s.seatNames = { P1: "realowner" }
  return s
}

/** A matchmade lobby its owner converted, with the persona as P2. */
async function converted(gameId: string) {
  await store.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: null, state: lobbyState(gameId) })
  let outcome = null as ConversionOutcome | null
  await store.mutateGame(gameId, (g) => {
    outcome = applyConversion(g, { userId: OWNER, name: PERSONA, now: T0 + BOT_FALLBACK_WAIT_MS, maxAgeMs: MAX_AGE_MS })
  })
  expect(outcome).toEqual({ kind: "converted" })
}

/** A real 1v1 between OWNER and GUEST, in the auction. */
async function realMatch(gameId: string) {
  const s = lobbyState(gameId)
  s.status = "auction"
  openNextLot(s)
  await store.saveGame({ rev: 2, ownerUserId: OWNER, guestUserId: GUEST, state: s })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(T0 + BOT_FALLBACK_WAIT_MS)
  store._resetStore()
  vi.clearAllMocks()
  h.userId = OWNER
  h.calls = []
  h.profiles = { [OWNER]: profile(OWNER, "realowner"), [GUEST]: profile(GUEST, "realguest") }
  h.ledgers = {}
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("GET /api/arena/[gameId]/players", () => {
  it("a refunded stake is no game played: STAKE+REFUND(L) and STAKE+WINNINGS(M) → played 1, wins 1, losses 0 (AC-33)", async () => {
    await realMatch("m")
    h.ledgers[OWNER] = [stake("L"), refund("L"), stake("M"), winnings("M")]

    const { status, body } = await cards("m")

    expect(status).toBe(200)
    expect(body.players.P1.record).toEqual({ wins: 1, losses: 0, played: 1 })
    const ledgerSelect = h.calls.find((c) => c.table === "transactions" && c.method === "select")
    expect(ledgerSelect!.args).toEqual(["type, amount, reference_id"])
    const ledgerTypes = h.calls.find((c) => c.table === "transactions" && c.method === "in")
    expect(ledgerTypes!.args[1]).toEqual(expect.arrayContaining(["ARENA_STAKE", "ARENA_WINNINGS", "ARENA_REWARD", "ARENA_REFUND"]))
  })

  it("the opponent of a converted lobby gets a human persona card, built before any query and written nowhere (AC-30, FR-8.5)", async () => {
    await converted("bot")
    expect((await store.loadGame("bot"))!.guestUserId).toBe(BOT_SEAT)

    const { status, body } = await cards("bot")

    expect(status).toBe(200)
    const card = body.players.P2
    expect(card).toMatchObject({
      seat: "P2",
      isAI: false,
      username: PERSONA,
      display_name: PERSONA,
      avatar_url: null,
      is_verified: false,
    })
    expect(card.level).toBeGreaterThanOrEqual(2)
    expect(card.level).toBeLessThanOrEqual(9)
    expect(card.record.losses).toBe(card.record.played - card.record.wins)
    expect(body.players.P1).toMatchObject({ isAI: false, username: "realowner" })
    // Only the owner's rows were read, with read methods only; the seat marker never reached a query.
    expect(JSON.stringify(h.calls)).not.toContain(BOT_SEAT)
    expect(new Set(h.calls.map((c) => c.method))).toEqual(new Set(["from", "select", "eq", "in", "maybeSingle"]))
    expect(h.calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([
      ["id", OWNER],
      ["user_id", OWNER],
    ])
  })

  it("the persona card is stable across calls", async () => {
    await converted("bot")

    const first = await cards("bot")
    const second = await cards("bot")

    expect(second.body.players.P2).toEqual(first.body.players.P2)
  })

  it("no card carries a user id: the real seat, the persona and the CPU seat", async () => {
    await converted("bot")
    const cpu = createGame({ gameId: "cpu", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 3 })
    openNextLot(cpu)
    await store.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: null, state: cpu })

    const bot = await cards("bot")
    const vsCpu = await cards("cpu")

    for (const card of [bot.body.players.P1, bot.body.players.P2, vsCpu.body.players.P1, vsCpu.body.players.P2]) {
      expect(card).not.toHaveProperty("userId")
    }
    expect(JSON.stringify([bot.body, vsCpu.body])).not.toContain(OWNER)

    await realMatch("m")
    const real = await cards("m")
    for (const card of [real.body.players.P1, real.body.players.P2]) expect(card).not.toHaveProperty("userId")
    expect(JSON.stringify(real.body)).not.toMatch(new RegExp(`${OWNER}|${GUEST}`))
  })

  it("a real CPU game still reports the CPU card", async () => {
    const cpu = createGame({ gameId: "cpu", config: { ...DEFAULT_CONFIG }, vsAI: true, seed: 3 })
    openNextLot(cpu)
    await store.saveGame({ rev: 1, ownerUserId: OWNER, guestUserId: null, state: cpu })

    const { status, body } = await cards("cpu")

    expect(status).toBe(200)
    expect(body.players.P2).toEqual({
      seat: "P2",
      isAI: true,
      username: "CPU",
      display_name: "CPU",
      avatar_url: null,
      level: null,
      record: null,
    })
  })

  it("a non-player gets 404 without the admin client being created", async () => {
    await converted("bot")
    h.userId = "stranger"

    const { status, body } = await cards("bot")

    expect(status).toBe(404)
    expect(body).toEqual({ error: "Game not found." })
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(h.calls).toEqual([])
  })
})
