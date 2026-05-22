import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<{ roomId: string }> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch room with creator profile
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select(`
      id,
      name,
      description,
      type,
      sport_tag,
      banner_url,
      creator_id,
      member_count,
      is_live,
      created_at,
      creator:creator_id (username, display_name, avatar_url)
    `)
    .eq("id", roomId)
    .maybeSingle()

  if (roomError) {
    return NextResponse.json({ error: "Failed to fetch room." }, { status: 500 })
  }

  if (!room) {
    return NextResponse.json(
      { error: "Room not found." },
      { status: 404 }
    )
  }

  const creator = Array.isArray(room.creator) ? room.creator[0] ?? null : room.creator

  // Check membership for private rooms
  let isMember = false
  if (user) {
    const { data: membership } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle()

    isMember = !!membership
  }

  // For private rooms, non-members only see limited info
  if (room.type === "Private" && !isMember) {
    return NextResponse.json({
      id: room.id,
      name: room.name,
      description: room.description,
      type: room.type,
      sport_tag: room.sport_tag,
      member_count: room.member_count,
      is_live: room.is_live,
      is_member: false,
      creator: creator
        ? { username: creator.username, display_name: creator.display_name, avatar_url: creator.avatar_url }
        : null,
    })
  }

  const response: Record<string, unknown> = {
    id: room.id,
    name: room.name,
    description: room.description,
    type: room.type,
    sport_tag: room.sport_tag,
    banner_url: room.banner_url,
    creator_id: room.creator_id,
    member_count: room.member_count,
    is_live: room.is_live,
    created_at: room.created_at,
    creator: creator
      ? {
          username: creator.username,
          display_name: creator.display_name,
          avatar_url: creator.avatar_url,
        }
      : null,
    is_member: isMember,
  }

  return NextResponse.json(response)
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })
