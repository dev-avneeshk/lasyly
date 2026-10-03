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
  /** Sender's public profile, so viewers render name/avatar without a lookup. */
  profile?: { username: string | null; display_name: string | null; avatar_url: string | null } | null
}

/** Channel name must match the client's `supabase.channel(...)` exactly. */
export function chatChannelName(subchannelId: string): string {
  return `room-sub-${subchannelId}`
}

/**
 * Broadcast a newly inserted message (or, with `message_deleted`, a deleted
 * message's id) to everyone in the sub-channel.
 *
 * Best-effort by design: the message is already committed, so a Realtime hiccup
 * must not turn a successful send into an error for the sender. Clients also
 * re-fetch on (re)subscribe, which covers anything a failed broadcast misses.
 */
export async function broadcastChatMessage(
  subchannelId: string,
  message: BroadcastChatMessage | { id: string },
  event: "new_message" | "message_deleted" = "new_message"
): Promise<void> {
  // Private: only users who can view the sub-channel may join, and clients can't
  // send (20261002_room_realtime_authorization.sql), so payloads are trusted.
  const supabase = createAdminClient()
  const channel = supabase.channel(chatChannelName(subchannelId), { config: { private: true } })
  try {
    const res = await channel.httpSend(event, message)
    if (!res.success) {
      console.error("[chat] server broadcast failed:", res.status, res.error)
    }
  } catch (err) {
    console.error("[chat] server broadcast failed:", err)
  } finally {
    await supabase.removeChannel(channel).catch(() => {})
  }
}
