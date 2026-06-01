import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const { data: members, error } = await supabase
    .from("room_members")
    .select(`
      user_id,
      role,
      profiles:user_id (id, username, display_name, avatar_url)
    `)
    .eq("room_id", roomId)
    .order("role", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Failed to fetch members." }, { status: 500 })
  }

  const formatted = (members ?? []).map((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    return {
      id: profile?.id ?? m.user_id,
      username: profile?.username ?? null,
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: m.role,
    }
  })

  // Sort: owner first, then moderators, then members
  const roleOrder: Record<string, number> = { owner: 0, moderator: 1, member: 2 }
  formatted.sort((a, b) => (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3))

  return NextResponse.json({ members: formatted })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })
