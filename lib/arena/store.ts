/**
 * Arena game store — server-authoritative persistence for ArenaState.
 *
 * All of the concurrency machinery (fail-closed distributed lock, in-process
 * mutex, dirty-checking so reads and rejected actions don't bump `rev`,
 * compare-and-swap writes) lives in lib/games/store.ts, which lib/nfl/store.ts
 * shares. This file is the typed arena binding plus the arena-specific
 * "does the server clock actually need to run?" predicate.
 *
 * Key invariant callers depend on: `rev` counts REAL state transitions. A poll
 * that changes nothing leaves it alone, so an in-flight bid is no longer
 * invalidated by the opponent's polling interval.
 */

import { createGameStore, type GameRecord, type MutateOutcome } from "@/lib/games/store"
import type { ArenaState } from "./auction"

/** Games expire after 3h of inactivity. */
const TTL_SECONDS = 60 * 60 * 3

const store = createGameStore<ArenaState>({
  prefix: "arena",
  ttlSeconds: TTL_SECONDS,
})

export type StoredGame = GameRecord<ArenaState>

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
 * Returns `{ game, changed }`. `changed` is false when the mutator produced no
 * observable difference — in which case nothing was written and `rev` is
 * unchanged. Throws GameNotFoundError, GameBusyError (contended or Redis
 * unhealthy — fail CLOSED, never silently unlocked) or GameConflictError.
 */
export async function mutateGame(
  gameId: string,
  mutator: (game: StoredGame) => void
): Promise<MutateOutcome<ArenaState>> {
  return store.mutateGame(gameId, mutator)
}

/** Test-only helper: drop the in-memory fallback state between cases. */
export function _resetStore(): void {
  store._resetMemory()
}

/**
 * Would running the server clock change anything?
 *
 * This is what lets the read path stay a read. `GET /api/arena/[id]` used to
 * call mutateGame unconditionally, so every 900ms poll from every player took a
 * lock, rewrote the whole blob and bumped `rev` — 5 Redis commands including a
 * write, to answer a question. Now the route loads once (1 command) and only
 * escalates to a locked mutation when the clock genuinely has work:
 *
 *   - the auction has no open lot (one needs opening), or
 *   - the current lot's deadline has passed (it needs resolving), or
 *   - the auction finished but the simulation result was never persisted.
 *
 * Everything else — AI responses, budget changes, ownership — is driven by an
 * explicit action (bid/pass/simulate), which takes the lock anyway.
 */
export function needsServerTick(state: ArenaState, now = Date.now()): boolean {
  if (state.status === "auction") {
    if (!state.lot) return true
    return state.lotDeadline !== null && now >= state.lotDeadline
  }
  // Defensive: a finished auction whose result never got computed (e.g. the
  // process died between the status flip and the write) must be repaired.
  if (state.status === "lineup" && !state.result) return true
  return false
}
