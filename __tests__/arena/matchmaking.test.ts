import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { StoredGame } from "@/lib/arena/store"

// L-07: 1v1 stakes were lost or stranded. Non-matching live lobbies were popped
// off the queue and dropped; nothing ever refunded a lobby nobody joined; and
// two matchmakes from one user each charged and opened a lobby.
type Refund = "pending" | "confirmed" | "failed"
type Game = {
  ownerUserId: string
  guestUserId: string | null
  state: { status: string; gameId?: string; botMatch?: { refund: Refund } & Record<string, unknown> }
}
type RefundResult = "completed" | "duplicate" | "nothing_to_refund" | "already_settled" | "error"
type ZMember = { score: number; member: string }

const st = vi.hoisted(() => {
  const data = {
    list: [] as string[],
    kv: new Map<string, string>(),
    /** Sorted sets by key: arena:lobbies and arena:refunds:pending must never alias. */
    zsets: new Map<string, Map<string, number>>(),
    games: new Map<string, Game>(),
    refunds: [] as string[],
    /** user:game pairs the mocked RPC already refunded: it answers "duplicate" after that, like refund_arena_stake. */
    refunded: new Set<string>(),
    /** Results for the next RPC calls, in order, before the idempotent default. */
    refundScript: [] as RefundResult[],
    /** Lost-CAS mode: the next mutate of `id` first runs on this stale pre-image; a changed run loses the CAS and re-runs on the stored record. */
    lostCas: null as null | { id: string; snapshot: Game },
    /** Makes the next mutate fail like a busy lock. */
    busy: false,
  }
  const z = (key: string) => {
    let set = data.zsets.get(key)
    if (!set) data.zsets.set(key, (set = new Map<string, number>()))
    return set
  }
  const redis = {
    lpush: async (_k: string, v: string) => data.list.unshift(v),
    rpush: async (_k: string, ...v: string[]) => data.list.push(...v),
    rpop: async () => data.list.pop() ?? null,
    lrem: async (_k: string, _c: number, v: string) => (data.list = data.list.filter((x) => x !== v)).length,
    get: async (k: string) => data.kv.get(k) ?? null,
    del: async (k: string) => data.kv.delete(k),
    set: vi.fn(async (k: string, v: string, o?: { nx?: boolean; px?: number; ex?: number }) =>
      o?.nx && data.kv.has(k) ? null : (data.kv.set(k, v), "OK"),
    ),
    // zadd(k, member) and zadd(k, { xx: true }, member)
    zadd: vi.fn(async (k: string, a: ZMember | { xx?: boolean }, b?: ZMember) => {
      const opts = (b ? a : {}) as { xx?: boolean }
      const { score, member } = (b ?? a) as ZMember
      const set = z(k)
      if (opts.xx && !set.has(member)) return 0
      const added = set.has(member) ? 0 : 1
      set.set(member, score)
      return added
    }),
    // By score, ascending, with offset/count.
    zrange: async (k: string, min: number, max: number, o?: { offset?: number; count?: number }) => {
      const from = o?.offset ?? 0
      return [...z(k)]
        .filter(([, s]) => s >= min && s <= max)
        .sort((x, y) => x[1] - y[1])
        .slice(from, from + (o?.count ?? Infinity))
        .map(([m]) => m)
    },
    zrem: async (k: string, m: string) => Number(z(k).delete(m)),
    // Only the compare-and-delete script is used here.
    eval: vi.fn(async (_s: string, [k]: string[], [v]: string[]) => (data.kv.get(k) === v ? Number(data.kv.delete(k)) : 0)),
  }
  const deleteGame = vi.fn(async (id: string) => void data.games.delete(id))
  /** arena:lobbies, which the original cases read directly. Cleared, never replaced. */
  const zset = z("arena:lobbies")
  return Object.assign(data, { z, redis, deleteGame, zset })
})

vi.mock("@/lib/redis", () => ({
  getRedisClient: () => st.redis,
}))
vi.mock("@/lib/arena/store", () => {
  class GameNotFoundError extends Error {}
  return {
    GameNotFoundError,
    deleteGame: st.deleteGame,
    // Like lib/games/store.ts: a run that changes nothing writes nothing (changed: false), and
    // a run that lost the rev CAS is re-applied to the fresh record.
    mutateGame: async (id: string, fn: (g: Game) => void) => {
      if (st.busy) {
        st.busy = false
        throw new Error("That game is busy right now. Please retry.")
      }
      const stored = st.games.get(id)
      if (!stored) throw new GameNotFoundError(id)
      const stale = st.lostCas?.id === id ? st.lostCas.snapshot : null
      if (stale) {
        st.lostCas = null
        const first = structuredClone(stale)
        fn(first)
        if (JSON.stringify(first) === JSON.stringify(stale)) return { game: first, changed: false }
        // That write lost the CAS: someone committed `stored` meanwhile.
      }
      const next = structuredClone(stored)
      fn(next)
      const changed = JSON.stringify(next) !== JSON.stringify(stored)
      if (changed) st.games.set(id, next)
      return { game: next, changed }
    },
  }
})
vi.mock("@/lib/economy/wallet", () => ({
  refundArenaStake: vi.fn(async ({ userId, gameId }: { userId: string; gameId: string }) => {
    const key = `${userId}:${gameId}`
    st.refunds.push(key)
    const scripted = st.refundScript.shift()
    if (scripted) {
      if (scripted === "completed") st.refunded.add(key)
      return scripted
    }
    if (st.refunded.has(key)) return "duplicate"
    st.refunded.add(key)
    return "completed"
  }),
}))

import {
  dequeueOpenGame,
  holdUserLobby,
  sweepAbandonedLobbies,
  trackLobby,
  untrackLobby,
  LOBBY_MAX_AGE_MS,
  BOT_REFUND_BACKSTOP_MS,
  queuePendingRefund,
  settlePendingRefund,
  startConvertedRefund,
  retryConvertedRefund,
  drainPendingRefunds,
} from "@/lib/arena/matchmaking"
import { refundArenaStake } from "@/lib/economy/wallet"

beforeEach(() => {
  st.list = []
  st.kv.clear()
  st.zset.clear()
  st.games.clear()
  st.refunds = []
  for (const set of st.zsets.values()) set.clear()
  st.refunded.clear()
  st.refundScript = []
  st.lostCas = null
  st.busy = false
  vi.clearAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("dequeueOpenGame", () => {
  it("keeps live lobbies that aren't a match, in order; drops dead ones", async () => {
    st.list = ["match", "other-stake", "expired", "own"] // RPOP takes from the right
    const verdicts: Record<string, "join" | "keep" | "drop"> = { own: "keep", expired: "drop", "other-stake": "keep", match: "join" }
    expect(await dequeueOpenGame(async (id) => verdicts[id])).toBe("match")
    expect(st.list).toEqual(["other-stake", "own"])
  })
})

describe("holdUserLobby", () => {
  it("lets only one concurrent matchmake per user open a lobby", async () => {
    const [a, b] = await Promise.all([holdUserLobby("u1", "g1", null), holdUserLobby("u1", "g2", null)])
    expect([a, b].filter(Boolean)).toHaveLength(1)
  })

  it("a second request that saw the same stale slot can't delete the fresh one (was: both charged)", async () => {
    st.kv.set("arena:matchmaking:user:u1", "stale")
    expect(await holdUserLobby("u1", "g1", "stale")).toBe(true)
    expect(await holdUserLobby("u1", "g2", "stale")).toBe(false)
    expect(st.kv.get("arena:matchmaking:user:u1")).toBe("g1")
  })
})

describe("sweepAbandonedLobbies", () => {
  it("refunds an unjoined lobby exactly once and leaves joined games alone", async () => {
    st.games.set("lonely", { ownerUserId: "u1", guestUserId: null, state: { status: "lobby" } })
    st.games.set("joined", { ownerUserId: "u2", guestUserId: "u3", state: { status: "auction" } })
    st.list = ["lonely"]
    await trackLobby("lonely", "u1")
    await trackLobby("joined", "u2")
    const later = Date.now() + LOBBY_MAX_AGE_MS + 1

    expect(await sweepAbandonedLobbies(later)).toBe(1)
    expect(await sweepAbandonedLobbies(later)).toBe(0)
    expect(st.refunds).toEqual(["u1:lonely"])
    expect(st.games.has("lonely")).toBe(false)
    expect(st.games.get("joined")?.guestUserId).toBe("u3")
    expect(st.list).toEqual([])
  })

  it("ignores lobbies younger than the cutoff", async () => {
    st.games.set("fresh", { ownerUserId: "u1", guestUserId: null, state: { status: "lobby" } })
    await trackLobby("fresh", "u1")
    expect(await sweepAbandonedLobbies(Date.now())).toBe(0)
    expect(st.refunds).toEqual([])
  })

  it("still refunds an unjoined lobby whose game key expired first (was: refund lost); joined ones are untracked", async () => {
    st.kv.set("arena:matchmaking:user:u1", "gone")
    await trackLobby("gone", "u1") // no game record: the 3h TTL already dropped it
    await trackLobby("played", "u2")
    await untrackLobby("played", "u2") // a join untracks, so a later expiry can't refund a played game
    expect(await sweepAbandonedLobbies(Date.now() + LOBBY_MAX_AGE_MS + 1)).toBe(1)
    expect(st.refunds).toEqual(["u1:gone"])
    expect(st.zset.size).toBe(0)
    expect(st.kv.has("arena:matchmaking:user:u1")).toBe(false)
  })
})

// ─── Converted lobbies, refunds owed, and their backstops (design §5.1, §5.3) ──

const PENDING = "arena:refunds:pending"
const BOT_SEAT = "bot-seat"
const SLOT_U1 = "arena:matchmaking:user:u1"

/** A converted lobby as the sweep and the refund helpers see it. */
function botGame(gameId: string, status: string, refund: Refund, owner = "u1"): Game {
  return {
    ownerUserId: owner,
    guestUserId: BOT_SEAT,
    state: {
      status,
      gameId,
      botMatch: {
        convertedAt: 1_000,
        waitedMs: 15_000,
        refund,
        shownConfig: { difficulty: "hard", aiPersonality: "aggressive" },
        pending: null,
        lastKey: null,
      },
    },
  }
}
const lobbyGame = (gameId: string, owner = "u1"): Game => ({ ownerUserId: owner, guestUserId: null, state: { status: "lobby", gameId } })
const asStored = (g: Game) => g as unknown as StoredGame
const later = () => Date.now() + LOBBY_MAX_AGE_MS + 1
const quiet = () => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
}
/** Let fire-and-forget work (afterResponse outside a request) finish. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 20))

describe("sweepAbandonedLobbies, converted lobbies (AC-16)", () => {
  const cases = (["auction", "lineup", "complete"] as const).flatMap((phase) =>
    (["pending", "confirmed", "failed"] as const).map((refund) => [phase, refund] as const),
  )

  it.each(cases)("%s, refund %s: never closed, deleted or released; the RPC runs only while pending, once", async (phase, refund) => {
    st.games.set("bm", botGame("bm", phase, refund))
    st.kv.set(SLOT_U1, "bm") // the owner's slot still points at the converted game
    st.list = ["bm"]
    await trackLobby("bm", "u1")
    const expected = structuredClone(st.games.get("bm")!)
    if (refund === "pending") expected.state.botMatch!.refund = "confirmed"

    expect(await sweepAbandonedLobbies(later())).toBe(refund === "pending" ? 1 : 0)

    expect(st.deleteGame).not.toHaveBeenCalled()
    expect(st.redis.eval).not.toHaveBeenCalled()
    expect(st.kv.get(SLOT_U1)).toBe("bm")
    expect(st.games.get("bm")).toEqual(expected) // only pending → confirmed; never CLOSED_SEAT
    expect(st.zset.has("bm u1")).toBe(false)
    expect(st.list).toEqual([])
    expect(st.refunds).toEqual(refund === "pending" ? ["u1:bm"] : [])

    // Even if the entry lingered (say its ZREM failed), a later sweep never re-refunds.
    await trackLobby("bm", "u1")
    expect(await sweepAbandonedLobbies(later())).toBe(0)
    expect(st.refunds).toEqual(refund === "pending" ? ["u1:bm"] : [])
    expect(st.deleteGame).not.toHaveBeenCalled()
    expect(st.games.get("bm")).toEqual(expected)
  })

  it("a pending refund that errors stays tracked, and the next sweep refunds it", async () => {
    quiet()
    st.games.set("bm", botGame("bm", "auction", "pending"))
    await trackLobby("bm", "u1")
    st.refundScript = ["error"]

    expect(await sweepAbandonedLobbies(later())).toBe(0)
    expect(st.zset.has("bm u1")).toBe(true)
    expect(st.games.get("bm")!.state.botMatch!.refund).toBe("pending")
    expect(console.error).toHaveBeenCalledWith("[arena/refund] failed", { gameId: "bm", userId: "u1" })

    expect(await sweepAbandonedLobbies(later())).toBe(1)
    expect(st.refunds).toEqual(["u1:bm", "u1:bm"])
    expect(st.games.get("bm")!.state.botMatch!.refund).toBe("confirmed")
    expect(st.zset.has("bm u1")).toBe(false)
    expect(st.deleteGame).not.toHaveBeenCalled()
  })

  it.each([
    ["bot entry first", ["bm u1", "lonely u2"]],
    ["lobby first", ["lonely u2", "bm u1"]],
  ])("a mixed batch (%s): the lobby is still closed, refunded and deleted", async (_order, members) => {
    st.games.set("bm", botGame("bm", "auction", "pending"))
    st.games.set("lonely", lobbyGame("lonely", "u2"))
    st.kv.set("arena:matchmaking:user:u2", "lonely")
    members.forEach((m, i) => st.zset.set(m, i + 1))

    expect(await sweepAbandonedLobbies(later())).toBe(2)

    expect(st.refunds.sort()).toEqual(["u1:bm", "u2:lonely"])
    expect(st.deleteGame).toHaveBeenCalledTimes(1)
    expect(st.deleteGame).toHaveBeenCalledWith("lonely")
    expect(st.redis.eval).toHaveBeenCalledTimes(1) // only the lobby owner's slot is released
    expect(st.kv.has("arena:matchmaking:user:u2")).toBe(false)
    expect(st.games.get("bm")).toMatchObject({ guestUserId: BOT_SEAT, state: { botMatch: { refund: "confirmed" } } })
    expect(st.zset.size).toBe(0)
  })

  it.each(["confirmed", "pending"] as const)(
    "lost CAS: the first run closes a lobby, the re-run sees the conversion (refund %s): no lobby refund, no delete (D-31)",
    async (refund) => {
      st.games.set("lc", botGame("lc", "auction", refund))
      st.lostCas = { id: "lc", snapshot: lobbyGame("lc") }
      st.kv.set(SLOT_U1, "lc")
      await trackLobby("lc", "u1")

      expect(await sweepAbandonedLobbies(later())).toBe(refund === "pending" ? 1 : 0)

      expect(st.lostCas).toBeNull() // the stale run happened
      expect(st.deleteGame).not.toHaveBeenCalled()
      expect(st.redis.eval).not.toHaveBeenCalled()
      expect(st.kv.get(SLOT_U1)).toBe("lc")
      expect(st.games.get("lc")!.guestUserId).toBe(BOT_SEAT)
      // At most the converted lobby's own refund, through its bot branch; never the close path's.
      expect(st.refunds).toEqual(refund === "pending" ? ["u1:lc"] : [])
      expect(st.zset.size).toBe(0)
    },
  )

  it("lost CAS: the re-run sees a real guest, so there is no refund and no delete (pre-existing hazard)", async () => {
    st.games.set("rg", { ownerUserId: "u1", guestUserId: "u3", state: { status: "auction", gameId: "rg" } })
    st.lostCas = { id: "rg", snapshot: lobbyGame("rg") }
    await trackLobby("rg", "u1")

    expect(await sweepAbandonedLobbies(later())).toBe(0)

    expect(st.lostCas).toBeNull()
    expect(st.refunds).toEqual([])
    expect(st.deleteGame).not.toHaveBeenCalled()
    expect(st.games.get("rg")!.guestUserId).toBe("u3")
    expect(st.zset.size).toBe(0)
  })

  it("an expired converted record is refunded through the tracked owner, once", async () => {
    await trackLobby("gone-bm", "u1") // the record's 3 h TTL lapsed before its refund was confirmed
    expect(await sweepAbandonedLobbies(later())).toBe(1)
    expect(st.refunds).toEqual(["u1:gone-bm"])
    expect(st.refunded.has("u1:gone-bm")).toBe(true)

    expect(await sweepAbandonedLobbies(later())).toBe(0) // a second run makes no call
    expect(st.refunds).toEqual(["u1:gone-bm"])
  })

  it("a confirmed refund that is still tracked has no net coin effect (AC-17)", async () => {
    // Record present and not a lobby: no call at all.
    st.games.set("bm", botGame("bm", "lineup", "confirmed"))
    await trackLobby("bm", "u1")
    // Record expired after its refund completed: the call answers duplicate.
    st.refunded.add("u1:gone-bm")
    await trackLobby("gone-bm", "u1")
    const refundedBefore = [...st.refunded]

    await sweepAbandonedLobbies(later())

    expect(st.refunds).toEqual(["u1:gone-bm"])
    expect(await vi.mocked(refundArenaStake).mock.results[0].value).toBe("duplicate")
    expect([...st.refunded]).toEqual(refundedBefore) // no new completed refund
    expect(st.zset.size).toBe(0)
  })
})

describe("settlePendingRefund (AC-18)", () => {
  beforeEach(async () => {
    st.games.set("sp", botGame("sp", "auction", "pending"))
    await trackLobby("sp", "u1")
    await queuePendingRefund("sp", "u1", 123)
  })

  it.each(["completed", "duplicate"] as const)("%s → confirmed, untracked, queue member removed", async (result) => {
    if (result === "duplicate") st.refunded.add("u1:sp")
    expect(await settlePendingRefund("sp", "u1")).toBe(result)
    expect(st.games.get("sp")!.state.botMatch!.refund).toBe("confirmed")
    expect(st.zset.has("sp u1")).toBe(false)
    expect(st.z(PENDING).has("sp u1")).toBe(false)
  })

  it.each(["already_settled", "nothing_to_refund"] as const)(
    "%s → failed (terminal), logged at error, backstops removed",
    async (result) => {
      quiet()
      st.refundScript = [result]
      expect(await settlePendingRefund("sp", "u1")).toBe(result)
      expect(st.games.get("sp")!.state.botMatch!.refund).toBe("failed")
      expect(console.error).toHaveBeenCalledWith("[arena/refund] invariant breach", { gameId: "sp", userId: "u1", result })
      expect(st.zset.has("sp u1")).toBe(false)
      expect(st.z(PENDING).has("sp u1")).toBe(false)
    },
  )

  it("error → stays pending, both backstops kept", async () => {
    quiet()
    st.refundScript = ["error"]
    expect(await settlePendingRefund("sp", "u1")).toBe("error")
    expect(st.games.get("sp")!.state.botMatch!.refund).toBe("pending")
    expect(console.error).toHaveBeenCalledWith("[arena/refund] failed", { gameId: "sp", userId: "u1" })
    expect(st.zset.has("sp u1")).toBe(true)
    expect(st.z(PENDING).get("sp u1")).toBe(123)
  })

  it("a joiner's refund writes nothing to the record but removes its own member", async () => {
    await queuePendingRefund("sp", "joiner", 456)
    const before = structuredClone(st.games.get("sp"))
    expect(await settlePendingRefund("sp", "joiner")).toBe("completed")
    expect(st.games.get("sp")).toEqual(before)
    expect(st.z(PENDING).has("sp joiner")).toBe(false)
    expect(st.z(PENDING).has("sp u1")).toBe(true) // the owner's entries are untouched
    expect(st.zset.has("sp u1")).toBe(true)
  })

  it("a missing record is ignored, and its member is still removed", async () => {
    quiet()
    await queuePendingRefund("gone", "u1", 1)
    expect(await settlePendingRefund("gone", "u1")).toBe("completed")
    expect(console.warn).not.toHaveBeenCalled()
    expect(st.z(PENDING).has("gone u1")).toBe(false)
  })

  it("a record it can't lock logs that the status wasn't recorded, and still clears the backstops", async () => {
    quiet()
    st.busy = true
    expect(await settlePendingRefund("sp", "u1")).toBe("completed")
    expect(console.warn).toHaveBeenCalledWith("[arena/refund] status not recorded", { gameId: "sp" })
    expect(st.z(PENDING).has("sp u1")).toBe(false)
  })
})

describe("queuePendingRefund", () => {
  it('writes "<gameId> <userId>" at the due score, defaulting to now, under its own key', async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(50_000)
    await queuePendingRefund("g1", "u1")
    await queuePendingRefund("g2", "u2", 50_000 + BOT_REFUND_BACKSTOP_MS)
    expect([...st.z(PENDING)]).toEqual([
      ["g1 u1", 50_000],
      ["g2 u2", 50_000 + 300_000],
    ])
    expect(st.zset.size).toBe(0) // not the lobby sweep's ZSET
  })

  it("a failed write is logged, never thrown", async () => {
    quiet()
    const error = new Error("redis down")
    st.redis.zadd.mockRejectedValueOnce(error)
    await expect(queuePendingRefund("g1", "u1")).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledWith("[arena/refund] queue failed:", error)
  })
})

describe("drainPendingRefunds", () => {
  const NOW = 1_000_000
  const queue = (...members: string[]) => members.forEach((m, i) => st.z(PENDING).set(m, i + 1))

  it("completed removes and counts; duplicate removes without counting", async () => {
    queue("a u1", "b u2")
    st.refunded.add("u2:b")
    expect(await drainPendingRefunds(NOW)).toBe(1)
    expect(st.refunds).toEqual(["u1:a", "u2:b"])
    expect(st.z(PENDING).size).toBe(0)
  })

  it("error re-scores the member to now + 120 000", async () => {
    quiet()
    queue("a u1")
    st.refundScript = ["error"]
    expect(await drainPendingRefunds(NOW)).toBe(0)
    expect(st.z(PENDING).get("a u1")).toBe(NOW + 120_000)
  })

  it("error, error, completed, error, error, error stops the run with the 7th member unprocessed", async () => {
    quiet()
    queue("m1 u", "m2 u", "m3 u", "m4 u", "m5 u", "m6 u", "m7 u")
    st.refundScript = ["error", "error", "completed", "error", "error", "error"]

    expect(await drainPendingRefunds(NOW)).toBe(1)

    expect(st.refunds).toEqual(["u:m1", "u:m2", "u:m3", "u:m4", "u:m5", "u:m6"]) // 3 consecutive errors: stop
    expect(Object.fromEntries(st.z(PENDING))).toEqual({
      "m1 u": NOW + 120_000,
      "m2 u": NOW + 120_000,
      "m4 u": NOW + 120_000,
      "m5 u": NOW + 120_000,
      "m6 u": NOW + 120_000,
      "m7 u": 7, // never reached
    })
  })

  it("malformed members are dropped without an RPC", async () => {
    queue("nospace", " u1", "g1 ", "ok u1")
    expect(await drainPendingRefunds(NOW)).toBe(1)
    expect(st.refunds).toEqual(["u1:ok"])
    expect(st.z(PENDING).size).toBe(0)
  })

  it.each(["already_settled", "nothing_to_refund"] as const)("a terminal %s is logged and dropped", async (result) => {
    quiet()
    queue("a u1")
    st.refundScript = [result]
    expect(await drainPendingRefunds(NOW)).toBe(0)
    expect(console.error).toHaveBeenCalledWith("[arena/refund] invariant breach", { gameId: "a", userId: "u1", result })
    expect(st.z(PENDING).size).toBe(0)
  })

  it("only due members are processed", async () => {
    st.z(PENDING).set("due u1", NOW)
    st.z(PENDING).set("later u2", NOW + 1)
    expect(await drainPendingRefunds(NOW)).toBe(1)
    expect(st.refunds).toEqual(["u1:due"])
    expect(st.z(PENDING).get("later u2")).toBe(NOW + 1)
  })

  it("the XX re-score never re-adds a member another path removed meanwhile", async () => {
    quiet()
    queue("a u1")
    vi.mocked(refundArenaStake).mockImplementationOnce(async () => {
      st.z(PENDING).delete("a u1") // e.g. the owner's retry settled it while this RPC was failing
      return "error"
    })
    expect(await drainPendingRefunds(NOW)).toBe(0)
    expect(st.z(PENDING).has("a u1")).toBe(false)
    expect(st.redis.zadd).toHaveBeenCalledWith(PENDING, { xx: true }, { score: NOW + 120_000, member: "a u1" })
  })
})

describe("converted-refund retry throttle (D-27)", () => {
  const RETRY_KEY = "arena:refund-retry:tg"

  it("two retries within 15 s make one RPC; once the slot is cleared, a third makes a second", async () => {
    const game = botGame("tg", "auction", "pending")
    st.games.set("tg", structuredClone(game))

    retryConvertedRefund(asStored(game))
    retryConvertedRefund(asStored(game))
    await vi.waitFor(() => expect(st.games.get("tg")!.state.botMatch!.refund).toBe("confirmed"))
    await flush()
    expect(st.refunds).toEqual(["u1:tg"])
    expect(st.redis.set).toHaveBeenCalledWith(RETRY_KEY, "1", { nx: true, px: 15_000 })

    st.kv.delete(RETRY_KEY) // the 15 s slot expired
    retryConvertedRefund(asStored(game))
    await vi.waitFor(() => expect(st.refunds).toEqual(["u1:tg", "u1:tg"]))
  })

  it("startConvertedRefund takes the slot unconditionally, so an immediate retry is skipped", async () => {
    const game = botGame("tg", "auction", "pending")
    st.games.set("tg", structuredClone(game))
    st.kv.set(RETRY_KEY, "1") // even a slot some retry already holds never blocks the conversion's own refund

    const first = startConvertedRefund("tg", "u1")
    retryConvertedRefund(asStored(game))
    expect(await first).toBe("completed")
    await flush()

    expect(st.refunds).toEqual(["u1:tg"])
    expect(st.redis.set).toHaveBeenNthCalledWith(1, RETRY_KEY, "1", { px: 15_000 })
    expect(st.games.get("tg")!.state.botMatch!.refund).toBe("confirmed")
  })

  it("startConvertedRefund still refunds when Redis can't take the slot", async () => {
    st.games.set("tg", botGame("tg", "auction", "pending"))
    st.redis.set.mockRejectedValueOnce(new Error("redis down"))
    expect(await startConvertedRefund("tg", "u1")).toBe("completed")
    expect(st.refunds).toEqual(["u1:tg"])
  })

  it.each(["confirmed", "failed", "none"] as const)("is a no-op unless the refund is pending (%s)", async (refund) => {
    const game: Game =
      refund === "none"
        ? { ownerUserId: "u1", guestUserId: "u3", state: { status: "auction", gameId: "tg" } }
        : botGame("tg", "auction", refund)
    st.games.set("tg", structuredClone(game))
    retryConvertedRefund(asStored(game))
    await flush()
    expect(st.redis.set).not.toHaveBeenCalled()
    expect(st.refunds).toEqual([])
  })

  it("a Redis SET error skips the RPC and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const error = new Error("redis down")
    const game = botGame("tg", "auction", "pending")
    st.games.set("tg", structuredClone(game))
    st.redis.set.mockRejectedValueOnce(error)

    retryConvertedRefund(asStored(game))
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith("[background] arena stake refund failed:", error))
    await flush()
    expect(st.refunds).toEqual([])
    expect(st.games.get("tg")!.state.botMatch!.refund).toBe("pending")
  })
})
