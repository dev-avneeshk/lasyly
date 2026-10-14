/**
 * Request bodies and error parsing for the arena's server-authoritative API,
 * shared by useArenaServer and the setup/join screens. Also the global-match
 * pairing schedule, seat labels and coin copy that ServerArena shows.
 *
 * Pure on purpose (no React, no Supabase, no engine) so it can be unit-tested in
 * node and imported by the lightweight setup screen without adding weight to its
 * critical path. The server still validates every field; these only shape what
 * the client sends and how it reads failures.
 */

import type { AIDifficulty, ArenaViewEcon, GameStatus, Season, TeamId } from "@/lib/arena/types"
import { stakePayout } from "@/lib/economy/arena"
import { BOT_FALLBACK_JITTER_MS, BOT_FALLBACK_WAIT_MS } from "@/lib/arena/fallbackTiming"

export type ArenaErrorCode = "INSUFFICIENT_FUNDS" | null

export interface ArenaRequest {
  url: string
  body: Record<string, unknown>
}

/** POST /api/arena. `stake` is only sent for a 1v1 ("human"); CPU games ignore it. */
export function createRequest(opts: {
  season: Season
  budget: number
  difficulty: AIDifficulty
  mode: "ai" | "human"
  stake?: number
}): ArenaRequest {
  const { season, budget, difficulty, mode, stake } = opts
  const body: Record<string, unknown> = { season, budget, difficulty, mode }
  if (mode === "human" && stake !== undefined) body.stake = stake
  return { url: "/api/arena", body }
}

/** POST /api/arena/matchmake. Public matches pair only on equal stakes, so it's always sent. */
export function matchmakeRequest(opts: {
  season: Season
  budget: number
  difficulty: AIDifficulty
  stake: number
}): ArenaRequest {
  const { season, budget, difficulty, stake } = opts
  return { url: "/api/arena/matchmake", body: { season, budget, difficulty, stake } }
}

/** POST /api/arena/[gameId]/join. The server charges the game's own stake. */
export function joinRequest(gameId: string): ArenaRequest {
  return { url: `/api/arena/${encodeURIComponent(gameId)}/join`, body: {} }
}

export const INSUFFICIENT_FUNDS_MESSAGE = "You don't have enough coins for this stake."

/**
 * Turn a failed create/matchmake/join response into a message plus a code the
 * UI can branch on (402 → link to the wallet). The server's own message wins
 * when it sent one.
 */
export function parseArenaError(
  status: number,
  body: unknown,
  fallback: string
): { message: string; code: ArenaErrorCode } {
  const b = body && typeof body === "object" ? (body as { error?: unknown; code?: unknown }) : {}
  const serverMessage = typeof b.error === "string" && b.error ? b.error : null
  const insufficient = status === 402 || b.code === "INSUFFICIENT_FUNDS"
  if (insufficient) {
    return { message: serverMessage ?? INSUFFICIENT_FUNDS_MESSAGE, code: "INSUFFICIENT_FUNDS" }
  }
  return { message: serverMessage ?? fallback, code: null }
}

/** The public lobby the user already holds, named by a matchmake 409. */
export interface HeldLobby {
  gameId: string
  stake: number
}

/**
 * Read the held lobby out of a matchmake 409 ("You're already waiting in a
 * N-coin match"), so the UI can offer to resume it. Re-matchmaking at the held
 * stake returns that lobby without charging again.
 */
export function parseHeldLobby(status: number, body: unknown): HeldLobby | null {
  if (status !== 409 || !body || typeof body !== "object") return null
  const { gameId, stake } = body as { gameId?: unknown; stake?: unknown }
  if (typeof gameId !== "string" || !gameId) return null
  if (typeof stake !== "number" || !Number.isInteger(stake) || stake <= 0) return null
  return { gameId, stake }
}

/**
 * What a 1v1 at `stake` actually pays, for display. Derived from stakePayout
 * (what settlement pays), so rounding is reflected: at 5 coins the winner
 * takes 10 and the house takes nothing. Show a commission only when > 0.
 */
export function stakeTerms(stake: number): { payout: number; commission: number } {
  const payout = stakePayout(stake)
  return { payout, commission: Math.max(0, stake * 2 - payout) }
}

/**
 * Whether a stake option is affordable. An unknown balance (signed out, or the
 * fetch failed) counts as affordable: the server enforces the real balance.
 */
export function stakeOptionState(stake: number, balance: number | null): { affordable: boolean; shortBy: number } {
  if (balance === null) return { affordable: true, shortBy: 0 }
  const shortBy = Math.max(0, stake - balance)
  return { affordable: shortBy === 0, shortBy }
}

// ─── Global-match pairing ────────────────────────────────────────────────────
// The owner of an open public lobby asks POST /api/arena/[gameId]/pair to be
// paired once nobody has joined in time. The server decides (inside the game
// lock, against its own clock); the client only keeps asking until it gets a
// definitive answer. useArenaServer runs the loop; every decision lives here.

/** Counted failures before a pair plan parks. */
export const PAIR_MAX_ATTEMPTS = 8
/** Client deadline per pair request. */
export const PAIR_REQUEST_TIMEOUT_MS = 10_000
/** Cap on the exponential backoff between counted retries. */
export const PAIR_BACKOFF_MAX_MS = 15_000
/** Uniform [0, 500) ms added to every retry delay. */
export const PAIR_RETRY_JITTER_MS = 500
/** Probe cadence while a plan is parked and the waiting room is visible. */
export const PAIR_PARK_PROBE_MS = 60_000
/** How long the "You matched against …" banner stays up. */
export const MATCHED_BANNER_MS = 2_500

/** "Still looking" (409 NOT_YET) waits the server's remainder, clamped to this range. */
const NOT_YET_MIN_MS = 250
const NOT_YET_MAX_MS = 15_000
/** …or this long when the remainder isn't a finite number. */
const NOT_YET_DEFAULT_MS = 1_000
/** First counted-retry delay; it doubles per counted failure up to PAIR_BACKOFF_MAX_MS. */
const BACKOFF_BASE_MS = 1_000

/** POST /api/arena/[gameId]/pair. It takes no fields: the empty body only makes api() send a POST. */
export function pairRequest(gameId: string): ArenaRequest {
  return { url: `/api/arena/${encodeURIComponent(gameId)}/pair`, body: {} }
}

/** Delay before the first pair request: the server's threshold plus [0, 3000) ms, so it can only land late. */
export function pairDelayMs(rand: () => number = Math.random): number {
  return BOT_FALLBACK_WAIT_MS + Math.floor(rand() * BOT_FALLBACK_JITTER_MS)
}

/**
 * Whether the owner's public "Finding an opponent…" room is on screen, so a pair
 * request should be scheduled. `publicLobby` is the hook's own flag, set only by
 * matchmake when the server seated the caller as P1, so invite lobbies,
 * matchmake joiners and the join screen never schedule one.
 */
export function shouldRequestPair(a: { publicLobby: boolean; status?: GameStatus; viewer?: TeamId }): boolean {
  return a.publicLobby && a.status === "lobby" && a.viewer === "P1"
}

/** What one pair attempt leads to. */
export type PairStep =
  | { kind: "apply"; view: unknown }
  | { kind: "retry"; afterMs: number; countsAttempt: boolean }
  | { kind: "stop"; error?: string }

/**
 * Read one pair response. `status === null` means no response arrived: a network
 * error, an abort or the client timeout. `retryAfterMs` is the Retry-After
 * header in ms (as api() parses it) or null; `attempts` is the plan's counted
 * failures so far.
 *
 * - 200 with a non-empty string `gameId`: apply the view.
 * - 404: stop, showing the server's message (or "Game not found.").
 * - 409 UNAVAILABLE: stop quietly; the lobby keeps waiting for a real player.
 * - 409 NOT_YET: retry after the reported remainder, never counted.
 * - No response, 401, 429, any 5xx, any other 409, or a 200 without a usable
 *   body: a counted retry after Retry-After, else 1, 2, 4, 8, then 15 s. A 401
 *   is retried because these routes also answer it during an Auth-server blip.
 * - Anything else (400, 403, 413, other 4xx; the route sends none): stop.
 */
export function parsePairResponse(status: number | null, body: unknown, retryAfterMs: number | null, attempts: number): PairStep {
  const b = body && typeof body === "object" ? (body as { gameId?: unknown; error?: unknown; code?: unknown; retryAfterMs?: unknown }) : {}
  const counted: PairStep = {
    kind: "retry",
    afterMs: retryAfterMs ?? Math.min(PAIR_BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempts),
    countsAttempt: true,
  }
  if (status === null) return counted
  if (status === 200) return typeof b.gameId === "string" && b.gameId ? { kind: "apply", view: body } : counted
  if (status === 404) return { kind: "stop", error: typeof b.error === "string" && b.error ? b.error : "Game not found." }
  if (status === 409) {
    if (b.code === "UNAVAILABLE") return { kind: "stop" }
    if (b.code === "NOT_YET") {
      const ms = b.retryAfterMs
      const afterMs = typeof ms === "number" && Number.isFinite(ms) ? Math.min(NOT_YET_MAX_MS, Math.max(NOT_YET_MIN_MS, ms)) : NOT_YET_DEFAULT_MS
      return { kind: "retry", afterMs, countsAttempt: false }
    }
    return counted
  }
  if (status === 401 || status === 429 || (status >= 500 && status <= 599)) return counted
  return { kind: "stop" }
}

/**
 * One lobby's pair schedule, as plain data. The hook keeps it in a ref, keyed by
 * gameId, so effect re-runs and StrictMode's double mount share one sequence.
 * `fireAt` is absolute (ms); a parked plan has no timer and waits for a probe.
 */
export interface PairPlan {
  gameId: string
  fireAt: number
  attempts: number
  parked: boolean
  done: boolean
}

/** A fresh plan: the first request goes out pairDelayMs(rand) from now. */
export function newPairPlan(gameId: string, now: number, rand: () => number): PairPlan {
  return { gameId, fireAt: now + pairDelayMs(rand), attempts: 0, parked: false, done: false }
}

/**
 * The plan after one attempt. apply/stop end it. A retry adds 1 to `attempts`
 * when it counts and parks once PAIR_MAX_ATTEMPTS is reached; otherwise the
 * next request goes out `afterMs` plus [0, 500) ms from now.
 */
export function nextPairPlan(plan: PairPlan, step: PairStep, now: number, rand: () => number): PairPlan {
  if (step.kind !== "retry") return { ...plan, done: true }
  const attempts = plan.attempts + (step.countsAttempt ? 1 : 0)
  if (attempts >= PAIR_MAX_ATTEMPTS) return { ...plan, attempts, parked: true }
  return { ...plan, attempts, fireAt: now + step.afterMs + Math.floor(rand() * PAIR_RETRY_JITTER_MS) }
}

/**
 * Turn a parked plan into exactly one probe, due now. It keeps PAIR_MAX_ATTEMPTS
 * − 1 counted failures, so a failed probe parks it again instead of starting a
 * fresh burst. A done or unparked plan is returned unchanged.
 */
export function unparkPairPlan(plan: PairPlan, now: number): PairPlan {
  if (!plan.parked || plan.done) return plan
  return { ...plan, parked: false, fireAt: now, attempts: PAIR_MAX_ATTEMPTS - 1 }
}

// ─── Seat labels and coin copy ───────────────────────────────────────────────
// The server's view carries each seat's public name and the coin record; the
// copy is picked from those fields here, never inferred client-side.

/** "You" for the viewer's own seat, else the seat's recorded name, else "Opponent". */
export function seatLabel(seat: TeamId, viewer: TeamId, names?: Partial<Record<TeamId, string | null>> | null): string {
  if (seat === viewer) return "You"
  return names?.[seat]?.trim() || "Opponent"
}

/** The matched banner's line. */
export function matchedLine(name: string | null | undefined): string {
  const clean = name?.trim()
  return clean ? `You matched against ${clean}` : "Opponent found"
}

/**
 * Whether to show the matched banner now: a global match (`announce`), whose
 * auction is live, that hasn't been announced yet for this gameId. For the
 * owner that is the lobby → auction flip; for a joiner, the first view.
 */
export function shouldAnnounceMatch(a: { announce?: boolean; status?: GameStatus; gameId?: string | null; announcedFor: string | null }): boolean {
  return !!a.announce && a.status === "auction" && !!a.gameId && a.announcedFor !== a.gameId
}

/** The auction header's coin chip: the stake for a staked 1v1, "Friendly match" for a friendly one, else none. */
export function coinChipText(econ: ArenaViewEcon | null | undefined): string | null {
  if (econ?.mode === "pvp" && econ.amount > 0) return `${econ.amount}-coin stake`
  if (econ?.mode === "friendly") return "Friendly match"
  return null
}

/**
 * The summary's coin line for a friendly match, chosen by whether the stake is
 * confirmed back (`returned: true`), still on its way (`false`), or unknown after
 * a terminal refund failure (`null`, which makes no coin claim at all). Null for
 * every other game, which keeps its own stake line.
 */
export function friendlyCoinNote(econ: ArenaViewEcon | null | undefined): string | null {
  if (econ?.mode !== "friendly") return null
  if (econ.returned === true) return `Friendly match: no coins changed hands. Your ${econ.amount}-coin stake is back in your wallet.`
  if (econ.returned === false) return `Friendly match: no coins changed hands. Your ${econ.amount}-coin stake is being returned to your wallet.`
  return "Friendly match."
}
