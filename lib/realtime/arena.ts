/**
 * Server-side arena game broadcast.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * A 1v1 auction is server-authoritative: both clients POST their actions and
 * poll GET /api/arena/:id for the resulting view. Polling alone means the
 * opponent doesn't see your bid until their next poll fires — up to 2.5s during
 * a live lot, longer under backoff. That is the "I bid, they see it 5s later"
 * lag.
 *
 * The fix mirrors chat/members (see lib/realtime/chat.ts, members.ts): the
 * SERVER broadcasts a lightweight "this game changed" nudge in the same request
 * that mutated the game. Clients subscribed to the game's channel receive it in
 * ~100-300ms and immediately re-fetch the authoritative view. Polling stays on
 * as a slow fallback, so a dropped nudge self-heals rather than stalling.
 *
 * Payload is deliberately EMPTY of game state:
 *   - The view is already served by an authorized, rate-limited GET route that
 *     the client owns. Re-fetching there keeps the server the single source of
 *     truth and avoids trusting a broadcast to carry correct budgets/ownership.
 *   - It sidesteps Realtime's per-subscriber RLS cost entirely — there is no row
 *     filter here, just a fan-out signal on a channel keyed by game id.
 *
 * Transport: `channel.httpSend()` posts to Realtime's HTTP broadcast endpoint
 * without opening (and leaking) a WebSocket per serverless invocation. See the
 * transport note in lib/realtime/chat.ts for the full reasoning.
 */

import { createAdminClient } from "@/lib/supabase/admin"

/** Channel name must match the client's `supabase.channel(...)` exactly. */
export function arenaChannelName(gameId: string): string {
  return `arena-game-${gameId}`
}

/** Broadcast event name the client listens for. */
export const ARENA_UPDATE_EVENT = "arena_update"

/**
 * Nudge both players of a game that its state advanced (a bid, pass, lot
 * resolution, join, or simulation).
 *
 * Best-effort by design: the state is already committed to the store, so a
 * Realtime hiccup must never turn a successful action into an error. The
 * client's fallback poll covers anything a dropped nudge misses.
 */
export async function broadcastArenaUpdate(gameId: string): Promise<void> {
  try {
    const supabase = createAdminClient()
    const channel = supabase.channel(arenaChannelName(gameId))
    const res = await channel.httpSend(ARENA_UPDATE_EVENT, { gameId })
    if (!res.success) {
      console.error("[arena] realtime broadcast failed:", res.status, res.error)
    }
    await supabase.removeChannel(channel)
  } catch (err) {
    console.error("[arena] realtime broadcast failed:", err)
  }
}
