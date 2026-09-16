/**
 * Public matchmaking queue for the NBA arena.
 *
 * Private games are shared by link and never appear here. A PUBLIC game (the
 * "play anyone" option) registers its id in a Redis-backed queue while it sits
 * in the lobby waiting for a stranger. A second player who also picks "public"
 * pops an id off the queue and joins it as P2.
 *
 * ── Why Redis, and why a LIST ────────────────────────────────────────────────
 * Matchmaking is shared, cross-request state: the player who creates the open
 * game and the player who later joins it are two different requests, very likely
 * on two different serverless instances. In-process memory cannot see across
 * them, so the queue must live in Redis (per the project's caching guidance).
 *
 * A Redis LIST gives us atomic push/pop (LPUSH / RPOP), which is exactly the
 * dequeue semantic matchmaking wants: RPOP hands a waiting id to exactly one
 * joiner, so two simultaneous joiners cannot both claim the same open game.
 *
 * ── Failure behaviour ────────────────────────────────────────────────────────
 * When Redis is not configured (single-instance dev), there is no shared queue,
 * so matchmaking simply always creates a fresh open game. That degrades to
 * "you're the only one here" rather than throwing — correct for local dev, and
 * harmless in prod where Redis is always present.
 *
 * Entries carry no state of their own; the id points at the real game record in
 * the arena store, which remains the single source of truth. A popped id is
 * re-validated against the store before use, so a stale or expired entry is
 * skipped, not trusted.
 */

import { getRedisClient } from "@/lib/redis"

/** One shared queue key for all open public games. */
const QUEUE_KEY = "arena:matchmaking:open"

/**
 * Open lobbies expire on their own via the game TTL (3h). We also cap how many
 * stale ids we'll skip past in a single dequeue so a poisoned queue can't turn
 * one request into an unbounded RPOP loop.
 */
const MAX_DEQUEUE_SCANS = 20

/** Register an open public game so another player can be matched into it. */
export async function enqueueOpenGame(gameId: string): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return
  try {
    await redis.lpush(QUEUE_KEY, gameId)
  } catch (error) {
    // A failed enqueue just means this game won't be auto-matched; the creator
    // still waits in the lobby. Don't fail the request over it.
    console.error("[arena/matchmaking] enqueue failed:", error)
  }
}

/**
 * Pop the next open public game id, skipping ids that fail the caller's
 * validity check (expired, already full, or the caller's own game).
 *
 * `isJoinable` lets the route re-check the real game record under its own rules
 * without this module needing to know about the store. Returns null when the
 * queue is empty or holds only unusable entries — the caller should then create
 * a fresh open game instead.
 */
export async function dequeueOpenGame(
  isJoinable: (gameId: string) => Promise<boolean>
): Promise<string | null> {
  const redis = getRedisClient()
  if (!redis) return null

  for (let scan = 0; scan < MAX_DEQUEUE_SCANS; scan++) {
    let gameId: string | null
    try {
      gameId = await redis.rpop<string>(QUEUE_KEY)
    } catch (error) {
      console.error("[arena/matchmaking] dequeue failed:", error)
      return null
    }
    if (!gameId) return null // queue empty
    if (await isJoinable(gameId)) return gameId
    // Not joinable → it's been dropped from the queue by the RPOP above, which
    // is the cleanup we want. Keep scanning for a usable one.
  }
  return null
}

/**
 * Remove a specific game from the queue (best effort). Called when an open
 * public game gets claimed or abandoned so it isn't handed to a later joiner.
 */
export async function removeOpenGame(gameId: string): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return
  try {
    // LREM count 0 removes all matching entries.
    await redis.lrem(QUEUE_KEY, 0, gameId)
  } catch (error) {
    console.error("[arena/matchmaking] remove failed:", error)
  }
}
