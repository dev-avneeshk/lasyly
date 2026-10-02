import { describe, it, expect, vi, beforeEach } from "vitest"

// L-07: 1v1 stakes were lost or stranded. Non-matching live lobbies were popped
// off the queue and dropped; nothing ever refunded a lobby nobody joined; and
// two matchmakes from one user each charged and opened a lobby.
type Game = { ownerUserId: string; guestUserId: string | null; state: { status: string } }
const st = vi.hoisted(() => ({
  list: [] as string[],
  kv: new Map<string, string>(),
  zset: new Map<string, number>(),
  games: new Map<string, Game>(),
  refunds: [] as string[],
}))

vi.mock("@/lib/redis", () => ({
  getRedisClient: () => ({
    lpush: async (_k: string, v: string) => st.list.unshift(v),
    rpush: async (_k: string, ...v: string[]) => st.list.push(...v),
    rpop: async () => st.list.pop() ?? null,
    lrem: async (_k: string, _c: number, v: string) => (st.list = st.list.filter((x) => x !== v)).length,
    get: async (k: string) => st.kv.get(k) ?? null,
    del: async (k: string) => st.kv.delete(k),
    set: async (k: string, v: string, o?: { nx?: boolean }) => (o?.nx && st.kv.has(k) ? null : (st.kv.set(k, v), "OK")),
    zadd: async (_k: string, { score, member }: { score: number; member: string }) => st.zset.set(member, score),
    zrange: async (_k: string, _min: number, max: number) => [...st.zset].filter(([, s]) => s <= max).map(([m]) => m),
    zrem: async (_k: string, m: string) => st.zset.delete(m),
    // Only the compare-and-delete script is used here.
    eval: async (_s: string, [k]: string[], [v]: string[]) => (st.kv.get(k) === v ? Number(st.kv.delete(k)) : 0),
  }),
}))
vi.mock("@/lib/arena/store", () => {
  class GameNotFoundError extends Error {}
  return {
    GameNotFoundError,
    deleteGame: async (id: string) => void st.games.delete(id),
    mutateGame: async (id: string, fn: (g: Game) => void) => {
      const g = st.games.get(id)
      if (!g) throw new GameNotFoundError(id)
      fn(g)
      return { game: g, changed: true }
    },
  }
})
vi.mock("@/lib/economy/wallet", () => ({
  refundArenaStake: async ({ userId, gameId }: { userId: string; gameId: string }) => {
    st.refunds.push(`${userId}:${gameId}`)
    return "completed"
  },
}))

import { dequeueOpenGame, holdUserLobby, sweepAbandonedLobbies, trackLobby, untrackLobby, LOBBY_MAX_AGE_MS } from "@/lib/arena/matchmaking"

beforeEach(() => {
  st.list = []
  st.kv.clear()
  st.zset.clear()
  st.games.clear()
  st.refunds = []
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
