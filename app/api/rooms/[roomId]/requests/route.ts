import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * GET /api/rooms/[roomId]/requests
 * List pending join requests for the room (admins only; RLS enforces this).
 * Joins the requester's profile so the admin UI can show name/avatar.
 */
export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { data, error } = await supabase
    .from("subchannel_join_requests")
    .select(`
      id, subchannel_id, status, requested_at,
      user_id,
      profiles:user_id (username, display_name, avatar_url),
      room_subchannels:subchannel_id (name)
    `)
    .eq("room_id", roomId)
    .eq("status", "pending")
    .order("requested_at", { ascending: true })

  if (error) {
    // Missing schema (not migrated) → empty list, no 500.
    return NextResponse.json({ requests: [] })
  }

  const requests = (data ?? []).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles
    const sub = Array.isArray(r.room_subchannels) ? r.room_subchannels[0] ?? null : r.room_subchannels
    return {
      id: r.id,
      subchannelId: r.subchannel_id,
      subchannelName: sub?.name ?? null,
      userId: r.user_id,
      requestedAt: r.requested_at,
      profile: profile
        ? { username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url }
        : null,
    }
  })

  return NextResponse.json({ requests })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
