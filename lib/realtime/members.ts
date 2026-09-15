/**
 * Server-side room-membership broadcast.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The room page loads its members list once on mount and only refetches on an
 * admin action (role change, kick, mute). A plain join/leave from another
 * client therefore left every other viewer's "MEMBERS — N" panel stale until a
 * reload.
 *
 * Rather than resurrect a `postgres_changes` subscription on `room_members`
 * (the same per-subscriber-per-row RLS cost that made chat expensive — see
 * lib/realtime/chat.ts), we broadcast a lightweight signal from the SERVER in
 * the same request that mutated membership. The payload carries no member data;
 * clients receive the nudge and re-fetch `/api/rooms/:id/members` through the
 * existing authorized route, so RLS is evaluated once per client on demand
 * instead of once per subscriber per row inside Realtime.
 *
 * Channel is keyed by ROOM, not subchannel: membership is a room-level concept,
 * and the client subscribes once per room regardless of which subchannel is
 * active. We deliver via `channel.httpSend()`, the explicit HTTP broadcast path
 * — see the transport note in lib/realtime/chat.ts for why we never open a
 * socket here.
 */

import { createAdminClient } from "@/lib/supabase/admin"

/** Channel name must match the client's `supabase.channel(...)` exactly. */
export function membersChannelName(roomId: string): string {
  return `room-members-${roomId}`
}

/**
 * Signal every viewer of a room that its membership changed.
 *
 * Best-effort by design: the membership row is already committed, so a Realtime
 * hiccup must not turn a successful join/leave into an error. Clients also
 * re-fetch on their own (re)subscribe, which covers anything a failed broadcast
 * misses.
 */
export async function broadcastMembersChanged(roomId: string): Promise<void> {
  try {
    const supabase = createAdminClient()
    const channel = supabase.channel(membersChannelName(roomId))
    const res = await channel.httpSend("members_changed", { roomId })
    if (!res.success) {
      console.error("[members] server broadcast failed:", res.status, res.error)
    }
    await supabase.removeChannel(channel)
  } catch (err) {
    console.error("[members] server broadcast failed:", err)
  }
}
