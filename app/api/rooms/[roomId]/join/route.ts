import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { invalidateCachePrefix } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { handleConflict } from "@/lib/security/concurrency"

export const POST = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Unauthenticated users cannot join rooms." },
      { status: 401 }
    )
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .maybeSingle()

  if (roomError) {
    return NextResponse.json({ error: "Failed to validate room." }, { status: 500 })
  }

  if (!room) {
    return NextResponse.json(
      { error: "Room not found." },
      { status: 404 }
    )
  }

  const { data: existing, error: lookupError } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: "Failed to check membership." }, { status: 500 })
  }

  if (existing) {
    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("id", existing.id)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to leave room." }, { status: 500 })
    }
  } else {
    // Insert with unique constraint enforcement on (room_id, user_id).
    // If a concurrent request already inserted this membership, the DB
    // unique constraint will cause a duplicate key error (code 23505).
    const { error } = await supabase.from("room_members").insert({
      room_id: roomId,
      user_id: user.id,
      role: "member",
    })

    if (error) {
      // Detect duplicate key violation from the unique constraint on (room_id, user_id)
      const isDuplicateKey =
        error.code === "23505" ||
        error.message?.toLowerCase().includes("duplicate") ||
        error.message?.toLowerCase().includes("unique")

      if (isDuplicateKey) {
        // Return 409 conflict with conflict type description
        const conflictResponse = handleConflict(0, "room membership")
        if (conflictResponse) return conflictResponse
      }

      return NextResponse.json({ error: "Failed to join room." }, { status: 500 })
    }
  }

  const { count } = await supabase
    .from("room_members")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)

  invalidateCachePrefix(`feed-graph:${user.id}`)

  return NextResponse.json({
    joined: !existing,
    memberCount: count ?? 0,
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
