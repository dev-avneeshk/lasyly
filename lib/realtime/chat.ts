/**
 * Server-side chat broadcast.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Chat delivery had two paths on the same channel:
 *
 *   1. `broadcast` — relayed by the SENDER'S BROWSER after the POST resolved.
 *   2. `postgres_changes` on `public.messages` — the reliability backstop,
 *      because path 1 silently drops the message for everyone else if the
 *      sender's tab closes or their network dies between the insert and the
 *      relay.
 *
 * Path 2 is the expensive one. Supabase Realtime evaluates the row filter *and*
 * the table's RLS policy per subscriber per change, and the RLS policy on
 * `messages` is `can_view_subchannel(subchannel_id, auth.uid())` — 2-3 index
 * lookups. One message in a room with N connected clients therefore costs ~2-3N
 * lookups inside Realtime, on top of the WAL replication. That is the component
 * that stops scaling first in a busy room.
 *
 * The fix is to remove the reason path 2 existed: broadcast from the SERVER, in
 * the same request that performed the insert. Delivery no longer depends on the
 * sender's client surviving, so `postgres_changes` is no longer load-bearing and
 * can be switched off (see NEXT_PUBLIC_CHAT_PG_CHANGES).
 *
 * Transport note: we call `channel.httpSend()`, which posts to Realtime's HTTP
 * broadcast endpoint explicitly, without ever opening a WebSocket. That matters
 * here, because opening (and leaking) a socket per API invocation on serverless
 * would be far worse than the problem being solved. `httpSend` is the successor
 * to the old implicit "`send()` on a never-subscribed channel falls back to
 * REST" behaviour, which supabase-js now warns is deprecated.
 */

import { createAdminClient } from "@/lib/supabase/admin"

/** Shape the client's `mergeMessages` expects from a realtime delivery. */
export interface BroadcastChatMessage {
  id: string
  content: string
  is_system: boolean
  created_at: string
  user_id: string
  kind?: "text" | "betslip"
  betslip_id?: string | null
}

/** Channel name must match the client's `supabase.channel(...)` exactly. */
export function chatChannelName(subchannelId: string): string {
  return `room-sub-${subchannelId}`
}

/**
 * Broadcast a newly inserted message to everyone in the sub-channel.
 *
 * Best-effort by design: the message is already committed, so a Realtime hiccup
 * must not turn a successful send into an error for the sender. Clients also
 * re-fetch on (re)subscribe, which covers anything a failed broadcast misses.
 */
export async function broadcastChatMessage(
  subchannelId: string,
  message: BroadcastChatMessage
): Promise<void> {
  try {
    const supabase = createAdminClient()
    const channel = supabase.channel(chatChannelName(subchannelId))
    const res = await channel.httpSend("new_message", message)
    if (!res.success) {
      console.error("[chat] server broadcast failed:", res.status, res.error)
    }
    await supabase.removeChannel(channel)
  } catch (err) {
    console.error("[chat] server broadcast failed:", err)
  }
}
