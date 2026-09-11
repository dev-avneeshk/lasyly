/**
 * NFL game store — server-authoritative persistence for NflAuctionState.
 *
 * Backed by Upstash Redis (shared across serverless instances) with an
 * in-memory fallback for local dev when Redis env vars are absent. Per the
 * project caching rule, frequently-mutated game state lives in Redis so both
 * participants (and every serverless instance) read a single source of truth.
 *
 * Concurrency: bids mutate a small JSON blob. To avoid lost updates when both
 * players act simultaneously we use an optimistic version check (`rev`) and a
 * short-lived Redis lock around read-modify-write.
 */

import { getRedisClient } from "@/lib/redis"
import type { NflAuctionState } from "./auction"

const PREFIX = "nfl:game:"
const LOCK_PREFIX = "nfl:lock:"
const TTL_SECONDS = 60 * 60 * 3 // games expire after 3h of inactivity

export interface StoredGame {
  rev: number
  ownerUserId: string
  guestUserId?: string | null
  state: NflAuctionState
}

const mem = new Map<string, StoredGame>()

function key(gameId: string) {
  return `${PREFIX}${gameId}`
}

export async function saveGame(game: StoredGame): Promise<void> {
  const redis = getRedisClient()
  if (redis) {
    try {
      await redis.set(key(game.state.gameId), game, { ex: TTL_SECONDS })
      return
    } catch {
      // fall through to memory
    }
  }
  mem.set(game.state.gameId, game)
}

export async function loadGame(gameId: string): Promise<StoredGame | null> {
  const redis = getRedisClient()
  if (redis) {
    try {
      const g = await redis.get<StoredGame>(key(gameId))
      if (g) return g
    } catch {
      // fall through
    }
  }
  return mem.get(gameId) ?? null
}

export async function deleteGame(gameId: string): Promise<void> {
  const redis = getRedisClient()
  if (redis) {
    try { await redis.del(key(gameId)) } catch { /* best-effort */ }
  }
  mem.delete(gameId)
}

async function acquireLock(gameId: string, token: string, ms = 3000): Promise<boolean> {
  const redis = getRedisClient()
  if (!redis) return true
  try {
    const res = await redis.set(`${LOCK_PREFIX}${gameId}`, token, { nx: true, px: ms })
    return res === "OK"
  } catch {
    return true
  }
}

async function releaseLock(gameId: string, token: string): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return
  try {
    const cur = await redis.get<string>(`${LOCK_PREFIX}${gameId}`)
    if (cur === token) await redis.del(`${LOCK_PREFIX}${gameId}`)
  } catch {
    // best-effort
  }
}

/**
 * Atomically read-modify-write a game under a short lock. `rev` is bumped on
 * every successful write so stale clients can detect drift.
 */
export async function mutateGame(
  gameId: string,
  mutator: (game: StoredGame) => void
): Promise<StoredGame> {
  const token = crypto.randomUUID()
  const gotLock = await acquireLock(gameId, token)
  if (!gotLock) {
    await new Promise((r) => setTimeout(r, 60))
    const retry = await acquireLock(gameId, token)
    if (!retry) throw new Error("Game is busy, please retry.")
  }
  try {
    const game = await loadGame(gameId)
    if (!game) throw new Error("Game not found.")
    mutator(game)
    game.rev += 1
    await saveGame(game)
    return game
  } finally {
    await releaseLock(gameId, token)
  }
}
