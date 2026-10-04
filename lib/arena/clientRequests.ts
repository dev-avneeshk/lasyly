/**
 * Request bodies and error parsing for the arena's server-authoritative API,
 * shared by useArenaServer and the setup/join screens.
 *
 * Pure on purpose (no React, no Supabase, no engine) so it can be unit-tested in
 * node and imported by the lightweight setup screen without adding weight to its
 * critical path. The server still validates every field; these only shape what
 * the client sends and how it reads failures.
 */

import type { AIDifficulty, Season } from "@/lib/arena/types"

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

/**
 * Whether a stake option is affordable. An unknown balance (signed out, or the
 * fetch failed) counts as affordable: the server enforces the real balance.
 */
export function stakeOptionState(stake: number, balance: number | null): { affordable: boolean; shortBy: number } {
  if (balance === null) return { affordable: true, shortBy: 0 }
  const shortBy = Math.max(0, stake - balance)
  return { affordable: shortBy === 0, shortBy }
}
