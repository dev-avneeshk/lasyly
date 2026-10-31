import "server-only"

import { SLATES } from "./slates"
import type { SimGame, SimSlate } from "./types"

// Slate data (a few hundred KB of JSON) stays on the server; client components import ./format and
// ./types only.
export * from "./format"
export type * from "./types"

/** Every published slate, newest first. */
export function listSlates(): SimSlate[] {
  return SLATES
}

export function findSimGame(id: string): { slate: SimSlate; game: SimGame } | null {
  for (const slate of SLATES) {
    const game = slate.games.find((g) => g.id === id)
    if (game) return { slate, game }
  }
  return null
}

export function allSimGameIds(): string[] {
  return SLATES.flatMap((s) => s.games.map((g) => g.id))
}
