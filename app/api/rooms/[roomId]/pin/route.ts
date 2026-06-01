import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const pinSchema = z.object({
  message_id: z.string().uuid(),
})

// GET pinned messages
export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const { data: pins, error } = await supabase
    .from("pinned_messages")
    .select(`
      id,
      message_id,
      pinned_at,
      pinned_by,
      messages:message_id (
        id,
        content,
        created_at,
        user_id,
        profiles:user_id (username, display_name, avatar_url)
      )
    `)
    .eq("room_id", roomId)
    .order("pinned_at", { ascending: false })
    .limit(25)

  if (error) {
    return NextResponse.json({ error: "Failed to fetch pinned messages." }, { status: 500 })
  }

  const formatted = (pins ?? []).map((pin) => {
    const msg = Array.isArray(pin.messages) ? pin.messages[0] : pin.messages
    const profile = msg ? (Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles) : null
    return {
      id: pin.id,
      message_id: pin.message_id,
      pinned_at: pin.pinned_at,
      content: msg?.content ?? "[deleted]",
      author: profile ? {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      } : null,
      created_at: msg?.created_at ?? null,
    }
  })

  return NextResponse.json({ pins: formatted })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })

// PIN a message
export const POST = withSecurity(async (
  request: Request,
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
    return NextResponse.json({ error: "Only admins can pin messages." }, { status: 403 })
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, pinSchema)
  if (validationError) return validationError

  // Verify message belongs to this room
  const { data: msg } = await supabase
    .from("messages")
    .select("id")
    .eq("id", data.message_id)
    .eq("room_id", roomId)
    .maybeSingle()

  if (!msg) {
    return NextResponse.json({ error: "Message not found in this room." }, { status: 404 })
  }

  // Check pin limit (max 25 per room)
  const { count } = await supabase
    .from("pinned_messages")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)

  if ((count ?? 0) >= 25) {
    return NextResponse.json({ error: "Maximum 25 pinned messages per room." }, { status: 400 })
  }

  const { error: insertErr } = await supabase
    .from("pinned_messages")
    .insert({
      room_id: roomId,
      message_id: data.message_id,
      pinned_by: user.id,
    })

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "Message is already pinned." }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to pin message." }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

// UNPIN a message
export const DELETE = withSecurity(async (
  request: Request,
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
    return NextResponse.json({ error: "Only admins can unpin messages." }, { status: 403 })
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, pinSchema)
  if (validationError) return validationError

  const { error: deleteErr } = await supabase
    .from("pinned_messages")
    .delete()
    .eq("room_id", roomId)
    .eq("message_id", data.message_id)

  if (deleteErr) {
    return NextResponse.json({ error: "Failed to unpin message." }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
