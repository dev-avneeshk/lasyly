import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// GET banned users list (admin only)
export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  // Check admin
  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!membership || (membership.role !== "owner" && membership.role !== "moderator")) {
    return NextResponse.json({ error: "Only admins can view bans." }, { status: 403 })
  }

  const { data: bans, error } = await supabase
    .from("room_bans")
    .select(`
      id,
      user_id,
      reason,
      banned_at,
      profiles:user_id (username, display_name, avatar_url)
    `)
    .eq("room_id", roomId)
    .order("banned_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to fetch bans." }, { status: 500 })
  }

  const formatted = (bans ?? []).map((ban) => {
    const profile = Array.isArray(ban.profiles) ? ban.profiles[0] : ban.profiles
    return {
      id: ban.id,
      user_id: ban.user_id,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      reason: ban.reason,
      banned_at: ban.banned_at,
    }
  })

  return NextResponse.json({ bans: formatted })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
