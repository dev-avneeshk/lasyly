/**
 * NFL game store — server-authoritative persistence for NflAuctionState.
 *
 * Typed binding over lib/games/store.ts, which holds the shared concurrency
 * implementation (fail-closed distributed lock, in-process mutex, dirty-check
 * so reads and rejected actions don't bump `rev`, compare-and-swap writes).
 *
 * This file previously duplicated lib/arena/store.ts verbatim, including its
 * fail-open lock. Sharing the implementation means a fix here cannot drift out
 * of step with the arena again.
 */

import { createGameStore, type GameRecord, type MutateOutcome } from "@/lib/games/store"
import type { NflAuctionState } from "./auction"

/** Games expire after 3h of inactivity. */
const TTL_SECONDS = 60 * 60 * 3

const store = createGameStore<NflAuctionState>({
  prefix: "nfl",
  ttlSeconds: TTL_SECONDS,
})

export type StoredGame = GameRecord<NflAuctionState>

export {
  GameBusyError,
  GameConflictError,
  GameNotFoundError,
} from "@/lib/games/store"

export async function saveGame(game: StoredGame): Promise<void> {
  return store.saveGame(game, game.state.gameId)
}

export async function loadGame(gameId: string): Promise<StoredGame | null> {
  return store.loadGame(gameId)
}

export async function deleteGame(gameId: string): Promise<void> {
  return store.deleteGame(gameId)
}

/**
 * Atomically read-modify-write a game.
 *
 * Returns `{ game, changed }`; nothing is written and `rev` is untouched when
 * the mutator produced no observable change. Throws GameNotFoundError,
 * GameBusyError (contended, or Redis unhealthy — fail CLOSED) or
 * GameConflictError.
 */
export async function mutateGame(
  gameId: string,
  mutator: (game: StoredGame) => void
): Promise<MutateOutcome<NflAuctionState>> {
  return store.mutateGame(gameId, mutator)
}

/** Test-only helper: drop the in-memory fallback state between cases. */
export function _resetStore(): void {
  store._resetMemory()
}

/**
 * Would running the server clock change anything? See the arena twin in
 * lib/arena/store.ts for the full rationale — in short, this is what keeps
 * `GET /api/nfl/[gameId]` a read instead of a locked read-modify-write on every
 * poll.
 */
export function needsServerTick(state: NflAuctionState, now = Date.now()): boolean {
  if (state.status === "auction") {
    if (!state.lot) return true
    return state.lotDeadline !== null && now >= state.lotDeadline
  }
  if (state.status === "lineup" && !state.result) return true
  return false
}
