/**
 * Regression tests for the shared game store's concurrency contract.
 *
 * Each case here corresponds to a defect that was reproduced in production code
 * during the load/concurrency audit. They run against a fake Upstash client so
 * the Redis code path (locking, CAS, JSON round-tripping) is genuinely
 * exercised — the pre-existing arena tests only ever hit the in-memory fallback,
 * which is why the fail-open lock survived.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

// ── Fake Upstash Redis ──────────────────────────────────────────────────────
const store = new Map<string, string>()
const cfg = {
  /** Make lock acquisition throw, simulating an Upstash outage/throttle. */
  failNx: false,
  /** Make EVAL throw, simulating a Redis that rejects Lua. */
  failEval: false,
  /** Called immediately before a CAS write lands — used to inject a racer. */
  beforeEval: null as null | (() => void),
}

const fakeRedis = {
  async get<T>(k: string): Promise<T | null> {
    const v = store.get(k)
    return v === undefined ? null : (JSON.parse(v) as T)
  },
  async set(k: string, v: unknown, opts?: { nx?: boolean; px?: number; ex?: number }) {
    if (opts?.nx) {
      if (cfg.failNx) throw new Error("upstash: max daily request limit exceeded")
      if (store.has(k)) return null
      store.set(k, JSON.stringify(v))
      return "OK"
    }
    store.set(k, JSON.stringify(v))
    return "OK"
  },
  async del(k: string) {
    return store.delete(k) ? 1 : 0
  },
  pipeline() {
    const ops: Array<() => void> = []
    const chain = {
      set(k: string, v: unknown) {
        ops.push(() => store.set(k, typeof v === "string" ? v : JSON.stringify(v)))
        return chain
      },
      del(k: string) {
        ops.push(() => store.delete(k))
        return chain
      },
      async exec() {
        ops.forEach((op) => op())
        return []
      },
    }
    return chain
  },
  /** Minimal interpreter for the two Lua scripts the store uses. */
  async eval(script: string, keys: string[], args: string[]) {
    if (cfg.failEval) throw new Error("NOSCRIPT / eval unsupported")
    cfg.beforeEval?.()

    // Release lock: compare-and-delete
    if (script.includes("DEL") && script.includes("GET") && keys.length === 1) {
      const current = store.get(keys[0])
      const token = current === undefined ? undefined : JSON.parse(current)
      if (token === args[0]) {
        store.delete(keys[0])
        return 1
      }
      return 0
    }

    // CAS write: [revKey, gameKey], [expectedRev, newRev, payload, ttl]
    const [revKey, gameKey] = keys
    const [expectedRev, newRev, payload] = args
    const currentRaw = store.get(revKey)
    if (currentRaw !== undefined) {
      const current = JSON.parse(currentRaw)
      if (String(current) !== expectedRev) return 0
    }
    store.set(revKey, JSON.stringify(newRev))
    store.set(gameKey, payload)
    return 1
  },
}

vi.mock("@/lib/redis", () => ({
  getRedisClient: () => fakeRedis,
}))

import { createGameStore, GameBusyError, GameNotFoundError } from "@/lib/games/store"

interface TestState {
  gameId: string
  counter: number
  label: string
}

const gameStore = createGameStore<TestState>({ prefix: "test", maxAttempts: 3 })

function seed(id: string, rev = 1) {
  return gameStore.saveGame(
    { rev, ownerUserId: "owner", guestUserId: null, state: { gameId: id, counter: 0, label: "a" } },
    id
  )
}

beforeEach(() => {
  store.clear()
  cfg.failNx = false
  cfg.failEval = false
  cfg.beforeEval = null
})

describe("fail-closed locking", () => {
  it("throws GameBusyError instead of proceeding unlocked when Redis errors", async () => {
    await seed("g1")
    cfg.failNx = true

    await expect(
      gameStore.mutateGame("g1", (g) => {
        g.state.counter += 1
      })
    ).rejects.toBeInstanceOf(GameBusyError)

    // Critically: nothing was written. The old implementation returned `true`
    // from acquireLock() on error, so concurrent callers all proceeded and
    // silently lost each other's updates.
    const after = await gameStore.loadGame("g1")
    expect(after!.state.counter).toBe(0)
    expect(after!.rev).toBe(1)
  })

  it("does not lose updates when two writers race with a healthy lock", async () => {
    await seed("g2")

    const [a, b] = await Promise.all([
      gameStore.mutateGame("g2", (g) => {
        g.state.counter += 1
      }),
      gameStore.mutateGame("g2", (g) => {
        g.state.counter += 1
      }),
    ])

    expect(a.changed).toBe(true)
    expect(b.changed).toBe(true)

    // Both increments survived: serialized, not clobbered.
    const final = await gameStore.loadGame("g2")
    expect(final!.state.counter).toBe(2)
    expect(final!.rev).toBe(3)
  })

  it("releases the lock so a later write can proceed", async () => {
    await seed("g3")
    await gameStore.mutateGame("g3", (g) => {
      g.state.counter = 5
    })
    const second = await gameStore.mutateGame("g3", (g) => {
      g.state.counter = 9
    })
    expect(second.changed).toBe(true)
    expect((await gameStore.loadGame("g3"))!.state.counter).toBe(9)
  })
})

describe("rev only advances on real state transitions", () => {
  it("a no-op mutator writes nothing and does not bump rev", async () => {
    await seed("n1", 4)
    const res = await gameStore.mutateGame("n1", () => {
      /* read-only */
    })
    expect(res.changed).toBe(false)
    expect(res.game.rev).toBe(4)
    expect((await gameStore.loadGame("n1"))!.rev).toBe(4)
  })

  it("repeated no-op ticks (the old poll path) leave rev alone", async () => {
    await seed("n2", 1)
    for (let i = 0; i < 10; i++) {
      const r = await gameStore.mutateGame("n2", () => {})
      expect(r.changed).toBe(false)
    }
    // The old store bumped rev on every call, so 10 polls took rev 1 → 11 and
    // invalidated any in-flight action's optimistic-concurrency check.
    expect((await gameStore.loadGame("n2"))!.rev).toBe(1)
  })

  it("a mutator that assigns identical values is still a no-op", async () => {
    await seed("n3", 2)
    const res = await gameStore.mutateGame("n3", (g) => {
      g.state.label = "a" // same value it already had
    })
    expect(res.changed).toBe(false)
    expect(res.game.rev).toBe(2)
  })

  it("an aborting mutator persists nothing", async () => {
    await seed("n4", 1)
    await expect(
      gameStore.mutateGame("n4", (g) => {
        g.state.counter = 99
        throw new Error("This game is already full.")
      })
    ).rejects.toThrow("already full")

    const after = await gameStore.loadGame("n4")
    expect(after!.state.counter).toBe(0)
    expect(after!.rev).toBe(1)
  })

  it("mirrors rev so an early-returning mutator (rejected action) is free", async () => {
    // Shape of the bid handler rejecting an illegal bid: the mutator sets an
    // outer error variable and returns without touching state.
    await seed("n5", 3)
    let bidError: string | null = null
    const res = await gameStore.mutateGame("n5", () => {
      bidError = "You can only bid up to $7."
      return
    })
    expect(bidError).not.toBeNull()
    expect(res.changed).toBe(false)
    expect(res.game.rev).toBe(3)
    // A rejected bid used to bump rev, which then 409'd the OPPONENT's valid bid.
    expect((await gameStore.loadGame("n5"))!.rev).toBe(3)
  })
})

describe("compare-and-swap write", () => {
  it("refuses a stale write when the stored rev moved underneath it", async () => {
    await seed("c1", 1)

    // Simulate a lapsed lock: another writer commits rev 2 in the instant before
    // our CAS lands. The CAS must refuse rather than clobber it.
    let injected = false
    cfg.beforeEval = () => {
      if (injected) return
      injected = true
      store.set("test:rev:c1", JSON.stringify("2"))
      store.set(
        "test:game:c1",
        JSON.stringify({
          rev: 2,
          ownerUserId: "owner",
          guestUserId: null,
          state: { gameId: "c1", counter: 42, label: "racer" },
        })
      )
    }

    const res = await gameStore.mutateGame("c1", (g) => {
      g.state.counter += 1
    })

    // The retry reloaded the racer's state and applied on top of it.
    expect(res.game.state.counter).toBe(43)
    expect(res.game.rev).toBe(3)
  })

  it("still writes when EVAL is unavailable (documented degradation)", async () => {
    await seed("c2", 1)
    cfg.failEval = true
    const res = await gameStore.mutateGame("c2", (g) => {
      g.state.counter = 7
    })
    expect(res.changed).toBe(true)
    expect((await gameStore.loadGame("c2"))!.state.counter).toBe(7)
  })
})

describe("read isolation", () => {
  it("loadGame returns a copy, so mutating it does not persist", async () => {
    await seed("r1")
    const a = await gameStore.loadGame("r1")
    a!.state.counter = 1234

    const b = await gameStore.loadGame("r1")
    expect(b!.state.counter).toBe(0)
  })

  it("throws GameNotFoundError for an unknown game", async () => {
    await expect(gameStore.mutateGame("nope", () => {})).rejects.toBeInstanceOf(
      GameNotFoundError
    )
  })
})
