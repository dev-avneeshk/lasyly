import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

export const GET = withSecurity(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to view joined rooms." },
      { status: 401 }
    )
  }

  const { data: memberships, error: memberError } = await supabase
    .from("room_members")
    .select("room_id")
    .eq("user_id", user.id)

  if (memberError) {
    return NextResponse.json({ error: "Failed to fetch memberships." }, { status: 500 })
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ rooms: [] })
  }

  const roomIds = memberships.map((m) => m.room_id)

  const { data: rooms, error: roomError } = await supabase
    .from("rooms")
    .select("id, name, description, type, sport_tag, member_count, is_live, created_at")
    .in("id", roomIds)
    .order("created_at", { ascending: false })

  if (roomError) {
    return NextResponse.json({ error: "Failed to fetch rooms." }, { status: 500 })
  }

  return NextResponse.json({ rooms: rooms ?? [] })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
