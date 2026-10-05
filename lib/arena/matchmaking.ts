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
import { deleteGame, mutateGame, GameNotFoundError } from "@/lib/arena/store"
import { RELEASE_LOCK_LUA } from "@/lib/games/store"
import { refundArenaStake } from "@/lib/economy/wallet"

/** One shared queue key for all open public games. */
const QUEUE_KEY = "arena:matchmaking:open"

/** ZSET of human lobbies (public and invite-link) by creation time, for the refund sweep. */
const LOBBIES_KEY = "arena:lobbies"

/** Unjoined lobbies are closed and refunded after this; the store drops them at 3h anyway. */
export const LOBBY_MAX_AGE_MS = 150 * 60_000

/** Seat marker that closes a lobby under the game lock, so a racing join is refused. */
const CLOSED_SEAT = "lobby-closed"

const userLobbyKey = (userId: string) => `arena:matchmaking:user:${userId}`

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
  check: (gameId: string) => Promise<"join" | "keep" | "drop">
): Promise<string | null> {
  const redis = getRedisClient()
  if (!redis) return null

  // "keep" = a live lobby that just isn't for this caller (their own, or a
  // different stake). Those go back at the old end afterwards; dropping them
  // (as before) stranded other players' paid lobbies outside the queue.
  const kept: string[] = []
  let found: string | null = null
  try {
    for (let scan = 0; scan < MAX_DEQUEUE_SCANS && !found; scan++) {
      const gameId = await redis.rpop<string>(QUEUE_KEY)
      if (!gameId) break // queue empty
      const verdict = await check(gameId).catch(() => "keep" as const) // busy/unreadable: retry later
      if (verdict === "join") found = gameId
      else if (verdict === "keep") kept.push(gameId)
      // "drop": expired/full/started — the RPOP above was the cleanup.
    }
  } catch (error) {
    console.error("[arena/matchmaking] dequeue failed:", error)
  }
  if (kept.length > 0) await redis.rpush(QUEUE_KEY, ...kept.reverse()).catch(() => {})
  return found
}

/**
 * The open public lobby this user already holds, if any. A repeat (or
 * concurrent) matchmake returns it instead of charging a second stake.
 */
export async function getUserLobby(userId: string): Promise<string | null> {
  const redis = getRedisClient()
  if (!redis) return null
  return redis.get<string>(userLobbyKey(userId)).catch(() => null)
}

/**
 * Claim the user's single open-lobby slot for `gameId`. `staleId` is a slot
 * value the caller verified is no longer an open lobby. Returns false when
 * another request holds the slot (a concurrent matchmake).
 */
export async function holdUserLobby(userId: string, gameId: string, staleId: string | null): Promise<boolean> {
  const redis = getRedisClient()
  if (!redis) return true
  try {
    // Compare-and-delete: an unconditional DEL could remove a fresh slot a
    // concurrent matchmake (that saw the same stale id) just took.
    if (staleId) await redis.eval(RELEASE_LOCK_LUA, [userLobbyKey(userId)], [staleId])
    return (await redis.set(userLobbyKey(userId), gameId, { nx: true, ex: 3 * 60 * 60 })) === "OK"
  } catch (error) {
    console.error("[arena/matchmaking] hold failed:", error)
    return true // fail open: the lobby itself is still valid
  }
}

/**
 * Track a human lobby so the sweep can refund it if nobody ever joins. The
 * owner rides along so the refund survives the game key expiring first; a
 * joined lobby is untracked, so an entry always means "never joined".
 */
const lobbyMember = (gameId: string, ownerId: string) => `${gameId} ${ownerId}`
export async function trackLobby(gameId: string, ownerId: string): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return
  await redis.zadd(LOBBIES_KEY, { score: Date.now(), member: lobbyMember(gameId, ownerId) }).catch((error) => {
    console.error("[arena/matchmaking] track failed:", error)
  })
}
export async function untrackLobby(gameId: string, ownerId: string): Promise<void> {
  await getRedisClient()?.zrem(LOBBIES_KEY, lobbyMember(gameId, ownerId)).catch((error) => {
    console.error("[arena/matchmaking] untrack failed:", error)
  })
}

/**
 * Close and refund human lobbies nobody joined within LOBBY_MAX_AGE_MS.
 * Called by the jobs cron. Idempotent: the close happens under the game lock
 * (a racing join sees the seat taken and refunds itself), and the refund RPC
 * is idempotent per (user, game), so a failed pass just retries next time.
 */
export async function sweepAbandonedLobbies(now = Date.now()): Promise<number> {
  const redis = getRedisClient()
  if (!redis) return 0
  const members = await redis.zrange<string[]>(LOBBIES_KEY, 0, now - LOBBY_MAX_AGE_MS, {
    byScore: true,
    offset: 0,
    count: 50,
  })
  let refunded = 0
  for (const member of members) {
    const [id, trackedOwner] = member.split(" ")
    let owner = null as string | null
    try {
      await mutateGame(id, (g) => {
        if (g.state.status !== "lobby" || (g.guestUserId && g.guestUserId !== CLOSED_SEAT)) return
        g.guestUserId = CLOSED_SEAT
        owner = g.ownerUserId
      })
    } catch (error) {
      if (!(error instanceof GameNotFoundError)) continue // busy: next sweep
      owner = trackedOwner ?? null // expired before we got to it: still never joined
    }
    if (owner) {
      if ((await refundArenaStake({ userId: owner, gameId: id })) === "error") continue
      refunded++
      await deleteGame(id)
      await redis.eval(RELEASE_LOCK_LUA, [userLobbyKey(owner)], [id]).catch(() => {})
    }
    await removeOpenGame(id)
    await redis.zrem(LOBBIES_KEY, member)
  }
  return refunded
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
