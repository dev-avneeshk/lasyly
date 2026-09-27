/**
 * Client-safe arena realtime constants and types.
 *
 * Split out of lib/realtime/arena.ts because that module derives channel names
 * with a server secret (node:crypto + env). The browser only needs the event
 * name and payload shape; it learns the channel name itself from the server, in
 * the `channel` field of its own authorized view responses.
 */

import type { ArenaServerView } from "@/lib/arena/server"

/** Broadcast event name the client listens for. */
export const ARENA_UPDATE_EVENT = "arena_update"

/**
 * Broadcast payload. `view` rides along so the opponent updates in one hop
 * instead of answering a bare nudge with a GET; see lib/realtime/arena.ts.
 */
export interface ArenaBroadcast {
  gameId: string
  /** Authoritative view snapshot (server-computed). Absent = bare nudge. */
  view?: ArenaServerView
  /** Dev-only: epoch ms the server sent this, for latency measurement. */
  sentAt?: number
}

/**
 * A view the server returned to one of the game's own players. Only these
 * responses carry `channel`; broadcasts never do.
 */
export type ParticipantView = ArenaServerView & {
  /** Private realtime channel for this game, or null when realtime is off. */
  channel: string | null
}
