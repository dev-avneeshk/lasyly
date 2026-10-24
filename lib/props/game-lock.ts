/**
 * When a prop stops taking predictions.
 *
 * A prop locks the moment its game tips off: once the game is live or final,
 * or once its scheduled start time has passed (the status feed refreshes every
 * few minutes, the clock does not lag). Only today's slate is open at all:
 * a past slate has been played, and a future one would settle against the
 * player's next game, which may be tonight's (lib/parlays/settlement.ts).
 *
 * Pure module: safe on server and client.
 */

export type GameState = "scheduled" | "live" | "final"

export interface GameClock {
  /** ISO tip-off time, when known. */
  startTime?: string | null
  status?: GameState | string | null
}

/** True once the game has started (live, final, or past its tip-off time). */
export function hasGameStarted(game: GameClock | null | undefined, nowMs: number = Date.now()): boolean {
  if (!game) return false
  if (game.status === "live" || game.status === "final") return true
  // A bare date (nba_games has no tip-off time) is not a start time: parsed,
  // it reads as midnight UTC, i.e. the previous evening in the US.
  if (game.startTime && !/^\d{4}-\d{2}-\d{2}$/.test(game.startTime)) {
    const start = Date.parse(game.startTime)
    if (Number.isFinite(start) && nowMs >= start) return true
  }
  return false
}

export type LockReason = "started" | "final" | "past" | "future"

/**
 * Why a prop is closed to predictions, or null when it is open.
 * `slateDate` / `todayDate` are `YYYY-MM-DD` on the same calendar.
 */
export function predictionLock(
  game: GameClock | null | undefined,
  slateDate: string,
  todayDate: string,
  nowMs: number = Date.now()
): LockReason | null {
  if (slateDate < todayDate) return "past"
  if (slateDate > todayDate) return "future"
  if (game?.status === "final") return "final"
  return hasGameStarted(game, nowMs) ? "started" : null
}

export const LOCK_LABEL: Record<LockReason, string> = {
  started: "Game started: predictions closed",
  final: "Game over: predictions closed",
  past: "This slate has been played",
  future: "Predictions open on game day",
}
