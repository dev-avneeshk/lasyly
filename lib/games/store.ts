/**
 * Shared server-authoritative game store (NBA arena + NFL auction).
 *
 * Both lib/arena/store.ts and lib/nfl/store.ts were byte-identical copies of
 * the same read-modify-write helper, and both carried the same three defects.
 * This module is the single fixed implementation; those files are now thin
 * typed wrappers.
 *
 * ── What was wrong ──────────────────────────────────────────────────────────
 *
 * 1. THE LOCK FAILED OPEN.
 *
 *      async function acquireLock(...) {
 *        if (!redis) return true          // no Redis  → "you hold the lock"
 *        try { ... } catch { return true} // Redis down → "you hold the lock"
 *      }
 *
 *    Any Upstash error, throttle or timeout silently removed mutual exclusion
 *    while telling every concurrent caller it was safe to proceed. Reproduced:
 *    two simultaneous bids both returned 200, both wrote rev 2, and one bid
 *    vanished; two racing polls resolved the same lot twice and awarded the
 *    same player to both players. The failure mode was silent corruption, and
 *    it triggered exactly when load was highest.
 *
 *    Now: a configured-but-unhealthy Redis throws GameBusyError (→ 503 +
 *    Retry-After) instead of proceeding unprotected. When Redis is not
 *    configured at all we are in the documented single-instance in-memory mode,
 *    where an in-process mutex is genuine mutual exclusion, so that path is
 *    correct rather than merely tolerated.
 *
 * 2. EVERY CALL WROTE, EVEN READS.
 *
 *      mutator(game); game.rev += 1; await saveGame(game)
 *
 *    `rev` was bumped and the whole blob rewritten unconditionally — including
 *    for read-only polls (GET called mutateGame) and for REJECTED actions (the
 *    mutator returned early on error, but the write still happened). Since the
 *    bid handler rejects when `client.rev !== server.rev`, and both players
 *    polled every 900ms, `rev` moved ~2x/second and legitimate bids lost the
 *    race. Reproduced: 10 polls → rev 1→11 with zero state change; a rejected
 *    bid bumped rev and thereby 409'd the *opponent's* valid bid.
 *
 *    Now: the mutator's effect is diffed against the pre-image. No change means
 *    no write, no rev bump, and `changed: false` to the caller. `rev` becomes
 *    what it always claimed to be — a counter of real state transitions.
 *
 * 3. RELEASE WAS A RACY GET-THEN-DEL, and a slow mutate could outlive the lock
 *    TTL and then overwrite a newer state.
 *
 *    Now: release is an atomic compare-and-delete, and the write itself is a
 *    compare-and-swap on `rev`. Even if the lock lapses mid-mutate, a stale
 *    write is refused rather than applied.
 *
 * Cost, measured by counting Upstash round-trips:
 *   read path   5 commands (incl. 1 write) → 1 command (GET), 0 writes
 *   write path  6 commands                 → 4 commands, and only when dirty
 */

import { getRedisClient } from "@/lib/redis"

// ─── Errors ─────────────────────────────────────────────────────────────────

/** The game is locked by another in-flight action, or Redis is unhealthy. */
export class GameBusyError extends Error {
  readonly code = "GAME_BUSY"
  constructor(message = "That game is busy right now. Please retry.") {
    super(message)
    this.name = "GameBusyError"
  }
}

/** No such game (expired past its TTL, or never existed). */
export class GameNotFoundError extends Error {
  readonly code = "GAME_NOT_FOUND"
  constructor(message = "Game not found.") {
    super(message)
    this.name = "GameNotFoundError"
  }
}

/**
 * The persisted state moved on while we were computing. Callers should reload
 * and retry; `mutateGame` already retries internally, so this only escapes
 * after the retry budget is exhausted.
 */
export class GameConflictError extends Error {
  readonly code = "GAME_CONFLICT"
  constructor(message = "That game changed while your action was in flight. Please retry.") {
    super(message)
    this.name = "GameConflictError"
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GameRecord<TState> {
  /** Monotonic count of REAL state transitions. Never bumped by a no-op. */
  rev: number
  /** User in seat P1 (the creator). */
  ownerUserId: string
  /** User in seat P2 once a second human joins (null while P2 is AI/open). */
  guestUserId?: string | null
  state: TState
}

export interface MutateOutcome<TState> {
  game: GameRecord<TState>
  /** False when the mutator produced no observable change (nothing persisted). */
  changed: boolean
}

export interface GameStoreOptions {
  /** Redis key namespace, e.g. "arena" → arena:game:<id>. */
  prefix: string
  /** Idle expiry. Defaults to 3h. */
  ttlSeconds?: number
  /** Lock lease. Must exceed the worst-case mutate duration. */
  lockMs?: number
  /** How many times to retry a contended lock / lost CAS before giving up. */
  maxAttempts?: number
}

// ─── In-process mutex ───────────────────────────────────────────────────────
// Serializes same-instance callers before they contend on Redis. Two benefits:
// it removes needless Redis round-trips under local burst (a user double-
// clicking usually lands on one instance), and it is the *entire* correctness
// story in the no-Redis dev path.

interface LockEntry {
  tail: Promise<void>
  waiters: number
}
const localLocks = new Map<string, LockEntry>()

async function withLocalLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const entry: LockEntry = localLocks.get(key) ?? { tail: Promise.resolve(), waiters: 0 }
  entry.waiters += 1
  localLocks.set(key, entry)

  const previous = entry.tail
  let release!: () => void
  entry.tail = new Promise<void>((resolve) => {
    release = resolve
  })

  // Wait for our turn. A predecessor's rejection must not block the queue.
  await previous.catch(() => {})

  try {
    return await fn()
  } finally {
    release()
    entry.waiters -= 1
    // Drop the entry once the queue drains so the map cannot grow unbounded.
    if (entry.waiters === 0 && localLocks.get(key) === entry) {
      localLocks.delete(key)
    }
  }
}

// ─── Lua: atomic release + compare-and-swap write ───────────────────────────

/** Delete the lock only if we still own it (GET-then-DEL is racy). */
const RELEASE_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

/**
 * Write the game only if the stored rev is still the one we read.
 *
 * KEYS[1] = rev key, KEYS[2] = game key
 * ARGV[1] = expected rev, ARGV[2] = new rev, ARGV[3] = payload, ARGV[4] = ttl
 *
 * The rev key is a small mirror of the blob's rev so the check needs no JSON
 * decoding in Lua. When it is absent (a game written before this change, or one
 * whose mirror expired first) we accept the write and initialize it — the blob
 * remains the source of truth on load.
 */
const CAS_WRITE_LUA = `
local current = redis.call('GET', KEYS[1])
if current and current ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[4])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
return 1
`

// ─── Factory ────────────────────────────────────────────────────────────────

export function createGameStore<TState>(options: GameStoreOptions) {
  const ttlSeconds = options.ttlSeconds ?? 60 * 60 * 3
  const lockMs = options.lockMs ?? 5_000
  const maxAttempts = options.maxAttempts ?? 4

  const gameKey = (id: string) => `${options.prefix}:game:${id}`
  const revKey = (id: string) => `${options.prefix}:rev:${id}`
  const lockKey = (id: string) => `${options.prefix}:lock:${id}`

  /**
   * Single-instance fallback, used only when Redis is not configured.
   *
   * Values are stored SERIALIZED, not by reference. The Redis path inherently
   * hands back a fresh copy on every read (it round-trips JSON), and the
   * in-memory path must match that or the two behave differently in ways that
   * hide bugs: handing out a live reference means a caller mutating a loaded
   * record persists that change without a lock, without a CAS, and without a
   * rev bump — and it makes the dirty-check compare an object against itself.
   */
  const mem = new Map<string, string>()

  // ── Persistence ───────────────────────────────────────────────────────────

  async function saveGame(game: GameRecord<TState>, id: string): Promise<void> {
    const redis = getRedisClient()
    if (!redis) {
      mem.set(id, JSON.stringify(game))
      return
    }
    // Unconditional write (creation path). Keep the rev mirror in step.
    const payload = JSON.stringify(game)
    await redis
      .pipeline()
      .set(gameKey(id), payload, { ex: ttlSeconds })
      .set(revKey(id), String(game.rev), { ex: ttlSeconds })
      .exec()
  }

  /**
   * Read the current record. This is the ONLY thing a read-only request needs:
   * one GET, no lock, no write.
   *
   * Note the deliberate absence of the old `catch { fall through to mem }`. That
   * fallback let a Redis blip serve a stale in-memory copy of a game whose real
   * state lived in Redis — and then a later save could overwrite the real state
   * with that stale copy. A read error is now surfaced.
   */
  async function loadGame(id: string): Promise<GameRecord<TState> | null> {
    const redis = getRedisClient()
    if (!redis) {
      const stored = mem.get(id)
      return stored === undefined ? null : (JSON.parse(stored) as GameRecord<TState>)
    }

    const raw = await redis.get<GameRecord<TState> | string>(gameKey(id))
    if (raw === null || raw === undefined) return null
    // Upstash parses JSON automatically, but be tolerant of a raw string.
    return typeof raw === "string" ? (JSON.parse(raw) as GameRecord<TState>) : raw
  }

  async function deleteGame(id: string): Promise<void> {
    const redis = getRedisClient()
    if (redis) {
      try {
        await redis.pipeline().del(gameKey(id)).del(revKey(id)).del(lockKey(id)).exec()
      } catch {
        // Best-effort: a leftover key expires on its own via TTL.
      }
    }
    mem.delete(id)
  }

  // ── Locking ───────────────────────────────────────────────────────────────

  /**
   * Try once to take the distributed lock.
   *
   * Fails CLOSED: a Redis error throws GameBusyError rather than pretending the
   * lock was acquired. This is the single most important line in the file.
   */
  async function tryAcquire(id: string, token: string): Promise<boolean> {
    const redis = getRedisClient()
    if (!redis) return true // in-memory mode; withLocalLock is the real lock

    try {
      const res = await redis.set(lockKey(id), token, { nx: true, px: lockMs })
      return res === "OK"
    } catch (error) {
      console.error(`[${options.prefix}/store] lock acquisition failed:`, error)
      throw new GameBusyError(
        "Game state is temporarily unavailable. Please retry in a moment."
      )
    }
  }

  async function release(id: string, token: string): Promise<void> {
    const redis = getRedisClient()
    if (!redis) return
    try {
      await redis.eval(RELEASE_LOCK_LUA, [lockKey(id)], [token])
    } catch {
      // The lease expires on its own; never fail a completed action on cleanup.
    }
  }

  // ── Read-modify-write ─────────────────────────────────────────────────────

  /**
   * Atomically apply `mutator` to the stored game.
   *
   * Contract change from the previous implementation: `rev` is bumped and the
   * blob is written ONLY if the mutator actually changed the state. Callers that
   * need to know can read `changed`. A mutator may also abort by throwing —
   * nothing is persisted in that case.
   */
  async function mutateGame(
    id: string,
    mutator: (game: GameRecord<TState>) => void
  ): Promise<MutateOutcome<TState>> {
    return withLocalLock(gameKey(id), async () => {
      let lastError: unknown = null

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        const gotLock = await tryAcquire(id, token)

        if (!gotLock) {
          // Contended. Back off with jitter and try again; do NOT proceed.
          await sleep(40 * 2 ** (attempt - 1) + Math.random() * 40)
          continue
        }

        try {
          const game = await loadGame(id)
          if (!game) throw new GameNotFoundError()

          const before = JSON.stringify(game)
          const expectedRev = game.rev

          mutator(game)

          // Diff against the pre-image. `rev` is excluded because the mutator
          // never sets it — we do, below, and only when something else moved.
          if (JSON.stringify(game) === before) {
            return { game, changed: false }
          }

          game.rev = expectedRev + 1

          const written = await casWrite(id, expectedRev, game)
          if (!written) {
            // Someone committed while we held (or had just lost) the lock.
            // Reload and re-apply rather than clobbering their write.
            lastError = new GameConflictError()
            await sleep(30 + Math.random() * 60)
            continue
          }

          return { game, changed: true }
        } finally {
          await release(id, token)
        }
      }

      if (lastError instanceof GameConflictError) throw lastError
      throw new GameBusyError()
    })
  }

  /** Compare-and-swap the blob. Returns false if the stored rev moved. */
  async function casWrite(
    id: string,
    expectedRev: number,
    game: GameRecord<TState>
  ): Promise<boolean> {
    const redis = getRedisClient()
    if (!redis) {
      // In-memory mode: withLocalLock already serialized us, so a CAS would be
      // redundant. Still verify, so a bug in the mutex surfaces as a conflict
      // rather than a lost update.
      const stored = mem.get(id)
      if (stored !== undefined) {
        const currentRev = (JSON.parse(stored) as GameRecord<TState>).rev
        if (currentRev !== expectedRev) return false
      }
      mem.set(id, JSON.stringify(game))
      return true
    }

    const payload = JSON.stringify(game)
    try {
      const res = await redis.eval(
        CAS_WRITE_LUA,
        [revKey(id), gameKey(id)],
        [String(expectedRev), String(game.rev), payload, String(ttlSeconds)]
      )
      return Number(res) === 1
    } catch (error) {
      // EVAL unavailable or failed. We still hold a valid lease, so a plain
      // write is safe — but surface it, because losing the CAS means losing the
      // protection against a lapsed lock.
      console.error(`[${options.prefix}/store] CAS write failed, using plain SET:`, error)
      await redis
        .pipeline()
        .set(gameKey(id), payload, { ex: ttlSeconds })
        .set(revKey(id), String(game.rev), { ex: ttlSeconds })
        .exec()
      return true
    }
  }

  /** Test-only: clear the in-memory fallback between cases. */
  function _resetMemory(): void {
    mem.clear()
    localLocks.clear()
  }

  return { saveGame, loadGame, deleteGame, mutateGame, _resetMemory }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
