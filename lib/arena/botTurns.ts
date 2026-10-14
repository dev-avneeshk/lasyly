import "server-only"

/**
 * The deferred opponent of a converted lobby. Server only.
 *
 * A bot match's opponent never answers inside the human's request: each clock
 * step plans its next move a short think delay out (`planBotTurn`,
 * lib/arena/botMatch.ts). This runner, started with `afterResponse` by the
 * request that planned the move (pair, bid, pass, or a GET that advanced the
 * clock), sleeps until the move is due, lands it under the game lock
 * (`advanceGame`), and pushes the new view to the owner's private channel, the
 * same path a real opponent's bid takes. One move can lead straight to another
 * (a pass resolves the lot, the next lot opens, the opponent plans its claim),
 * so it loops within BOT_RUNNER_BUDGET_MS.
 *
 * Several runners for one game are harmless: each move is decided under the
 * lock, and the lot-state key, `pending = null` and `lastKey` make a second
 * landing a no-op. A thrown error (GameBusyError after the store's own retries,
 * or a Redis read error) ends the run; `afterResponse` logs it at warn, and the
 * next GET lands the move instead (`needsServerTick` sees it due).
 */

import { loadGame, mutateGame } from "./store"
import { advanceGame, serverView } from "./server"
import { BOT_RUNNER_BUDGET_MS, BOT_THINK_MAX_MS } from "./botMatch"
import { broadcastArenaUpdate } from "@/lib/realtime/arena"

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Land the opponent's planned moves as they fall due, within one invocation's budget. */
export async function runBotTurns(gameId: string, deps = { sleep: defaultSleep, now: Date.now }): Promise<void> {
  const started = deps.now()
  for (;;) {
    const current = await loadGame(gameId)
    const pending = current?.state.botMatch?.pending
    if (!current || !pending || current.state.status !== "auction") return
    const wait = Math.max(0, pending.dueAt - deps.now())
    // Further out than any think delay (only a skewed clock does that), or past this invocation's
    // budget: leave it pending, and the next poll (needsServerTick) lands it.
    if (wait > BOT_THINK_MAX_MS || deps.now() - started + wait > BOT_RUNNER_BUDGET_MS) return
    if (wait > 0) await deps.sleep(wait)
    const { game, changed } = await mutateGame(gameId, (g) => advanceGame(g.state, deps.now()))
    if (changed) await broadcastArenaUpdate(gameId, serverView(game.state, "P1", game.rev))
  }
}
