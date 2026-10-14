import "server-only"

/**
 * Global-match fallback: the pure core. Server only.
 *
 * When nobody takes an open public lobby in time, its owner may convert it into
 * a match against the existing engine: P2 gets a seat marker that is not a user
 * id, the engine at BOT_DIFFICULTY, and a checked handle as its public name.
 * Everything here is synchronous and does no I/O, so it runs inside the caller's
 * `mutateGame` (lock + rev CAS), the same write real seating uses.
 *
 * The opponent never answers inside the human's own request. Each clock step
 * plans its next move a short think delay out (`planBotTurn`), and the move is
 * landed later under the lock (`runDueBotTurn`), at most once per lot state.
 *
 * Never import ./server (it imports this file) or ./matchmaking (`maxAgeMs` is a
 * parameter instead).
 */

import { openNextLot, placeBid, pass, teamActive, minRaise, type ArenaState } from "./auction"
import { decideAI } from "./ai"
import { canAddPlayer } from "./roster"
import { bestPersonalityForDifficulty, type AIDifficulty, type AuctionLot } from "./types"
import { BOT_FALLBACK_WAIT_MS } from "./fallbackTiming"
import type { StoredGame } from "./store"

/** Seat marker stored in `guestUserId`. Not a UUID, so `seatForUser` can never map a user to it. */
export const BOT_SEAT = "bot-seat"
/** Opponent difficulty; its personality comes from `bestPersonalityForDifficulty`. */
export const BOT_DIFFICULTY: AIDifficulty = "medium"
/** Think delay range, measured from the triggering transition. */
export const BOT_THINK_MIN_MS = 700
export const BOT_THINK_MAX_MS = 2_200
/** A move must land before `lotDeadline − margin`, or it is dropped. */
export const BOT_DEADLINE_MARGIN_MS = 750
/** Maximum wall time one runner keeps an invocation alive. */
export const BOT_RUNNER_BUDGET_MS = 20_000

export type ConversionVerdict =
  | { kind: "eligible"; ageMs: number }
  | { kind: "not_owner" } // caller isn't ownerUserId
  | { kind: "already" } // botMatch present
  | { kind: "seated" } // a real opponent holds P2
  | { kind: "not_yet"; retryAfterMs: number }
  | { kind: "unavailable"; reason: "not_public" | "closed" | "not_lobby" | "not_pvp" | "expired" }

/** What one run of the conversion mutator decided. */
export type ConversionOutcome = Exclude<ConversionVerdict, { kind: "eligible" }> | { kind: "converted" }

/**
 * May `userId` convert this record now? Ownership is checked first, so a
 * non-owner learns nothing about the record (open, converted and seated all
 * answer `not_owner`).
 */
export function conversionVerdict(g: StoredGame, userId: string, now: number, maxAgeMs: number): ConversionVerdict {
  if (g.ownerUserId !== userId) return { kind: "not_owner" } // first: a non-owner learns nothing about the record
  const s = g.state
  if (s.botMatch) return { kind: "already" }
  if (g.guestUserId && s.status !== "lobby") return { kind: "seated" }
  if (!s.matchmadeLobby) return { kind: "unavailable", reason: "not_public" } // invite or pre-deploy lobby
  if (g.guestUserId) return { kind: "unavailable", reason: "closed" } // CLOSED_SEAT: swept
  if (s.status !== "lobby" || s.isAI.P2) return { kind: "unavailable", reason: "not_lobby" }
  if (s.econ?.mode !== "pvp" || !(s.econ.amount > 0)) return { kind: "unavailable", reason: "not_pvp" }
  const ageMs = now - s.matchmadeLobby.openedAt
  if (ageMs < BOT_FALLBACK_WAIT_MS) return { kind: "not_yet", retryAfterMs: BOT_FALLBACK_WAIT_MS - ageMs }
  if (ageMs >= maxAgeMs) return { kind: "unavailable", reason: "expired" } // leave it to the sweep (Q-15)
  return { kind: "eligible", ageMs }
}

/**
 * Convert an eligible lobby in one write. Call it inside `mutateGame`, where its
 * verdict is the one that decides. Every non-eligible verdict returns before `g`
 * is touched, so the mutate is a no-op and the stored record stays byte-identical.
 */
export function applyConversion(
  g: StoredGame,
  o: { userId: string; name: string; now: number; maxAgeMs: number; rand?: () => number },
): ConversionOutcome {
  const v = conversionVerdict(g, o.userId, o.now, o.maxAgeMs)
  if (v.kind !== "eligible") return v // no write of any kind
  const s = g.state
  g.guestUserId = BOT_SEAT
  s.isAI.P2 = true
  s.botMatch = {
    convertedAt: o.now, waitedMs: v.ageMs, refund: "pending", pending: null, lastKey: null,
    shownConfig: { difficulty: s.config.difficulty, aiPersonality: s.config.aiPersonality },
  }
  s.seatNames = { ...s.seatNames, P2: o.name }
  s.config = { ...s.config, difficulty: BOT_DIFFICULTY, aiPersonality: bestPersonalityForDifficulty(BOT_DIFFICULTY) }
  s.econ = { ...s.econ!, settled: true }
  s.status = "auction"
  openNextLot(s)
  planBotTurn(s, o.now, o.rand) // lot-1 move lands no earlier than now + BOT_THINK_MIN_MS
  return { kind: "converted" }
}

/**
 * Identity of the current lot state. Any bid, pass, resolution or re-offer
 * changes it, and `results.length` / `history.length` only grow, so a key never
 * recurs. Only call it while a lot is open.
 */
export function lotKey(s: ArenaState): string {
  const lot = s.lot!
  return [s.results.length, lot.player.id, s.reoffers?.[lot.player.id] ?? 0,
          s.history.length, lot.highBidder ?? "-", [...s.passed].sort().join("")].join("|")
}

/** Where a person would click Pass: the human can't (or won't) bid on this lot any more. */
function humanCannotBid(state: ArenaState, lot: AuctionLot): boolean {
  return (
    state.passed.includes("P1") ||
    !teamActive(state, "P1") ||
    !canAddPlayer(state.rosters.P1, lot.player) ||
    minRaise(state, "P1") === null
  )
}

/**
 * Decide whether the opponent acts on the current lot state, and when. Runs at
 * the end of every clock step of a bot match. Pure: it only writes
 * `botMatch.pending`.
 */
export function planBotTurn(state: ArenaState, now: number, rand: () => number = Math.random): void {
  const bm = state.botMatch
  if (!bm) return
  const lot = state.lot
  // 1. Nothing to plan. With P2's roster full the engine resolves lots on the human's actions alone.
  if (state.status !== "auction" || !lot || state.lotDeadline === null || !teamActive(state, "P2")) {
    bm.pending = null
    return
  }
  const key = lotKey(state)
  // 2. Already acted on this lot state (landed, refused or dropped): at most one action per state.
  if (bm.lastKey === key) {
    bm.pending = null
    return
  }
  // 3. Same lot state: keep the existing move, so duplicate triggers never reschedule.
  if (bm.pending?.key === key) return
  // 4. Decide afresh.
  bm.pending = null
  if (lot.highBidder === "P2" || state.passed.includes("P2")) return
  let kind: "bid" | "pass"
  if (decideAI(state, "P2").action === "bid") kind = "bid"
  else if (lot.highBidder === "P1" || humanCannotBid(state, lot)) kind = "pass"
  else return // unclaimed lot and the human is still deciding: stand pat, the deadline resolves it
  // 5. Timing.
  const earliest = now + BOT_THINK_MIN_MS
  const dueAt = Math.min(
    earliest + Math.round(rand() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS)),
    state.lotDeadline - BOT_DEADLINE_MARGIN_MS - 1,
  )
  if (dueAt < earliest) return
  // 6. Result.
  bm.pending = { dueAt, key, kind }
}

/**
 * Land the planned move if it is due. Returns true when a pending move was
 * consumed: landed, refused by the engine, or dropped as stale or too late.
 * Either way `lastKey` records the state it was planned for.
 */
export function runDueBotTurn(state: ArenaState, now: number): boolean {
  const p = state.botMatch?.pending
  if (!p || now < p.dueAt) return false
  state.botMatch!.pending = null
  state.botMatch!.lastKey = p.key // one action per lot state, whatever follows
  if (state.status !== "auction" || !state.lot || state.lotDeadline === null) return true // stale: dropped
  if (p.key !== lotKey(state)) return true // stale: dropped
  if (now >= state.lotDeadline - BOT_DEADLINE_MARGIN_MS) return true // too late: dropped
  if (p.kind === "bid") {
    const d = decideAI(state, "P2") // the same decide → placeBid step driveAI performs for an AI seat
    if (d.action === "bid") placeBid(state, "P2", d.amount)
  } else {
    pass(state, "P2")
  }
  return true
}
