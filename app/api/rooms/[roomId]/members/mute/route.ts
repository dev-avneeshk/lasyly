import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const muteSchema = z.object({
  user_id: z.string().uuid(),
  /** Duration in minutes (5, 15, 60, 1440 = 1 day, 10080 = 1 week) */
  duration_minutes: z.number().min(1).max(10080),
  reason: z.string().max(200).optional(),
})

const unmuteSchema = z.object({
  user_id: z.string().uuid(),
})

// Mute a user
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
    return NextResponse.json({ error: "Only admins can mute members." }, { status: 403 })
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, muteSchema)
  if (validationError) return validationError

  // Cannot mute yourself
  if (data.user_id === user.id) {
    return NextResponse.json({ error: "You cannot mute yourself." }, { status: 400 })
  }

  // Check target's role
  const { data: targetMembership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", data.user_id)
    .maybeSingle()

  if (!targetMembership) {
    return NextResponse.json({ error: "User is not a member of this room." }, { status: 404 })
  }

  // Cannot mute owner
  if (targetMembership.role === "owner") {
    return NextResponse.json({ error: "Cannot mute the room owner." }, { status: 403 })
  }

  // Mods cannot mute other mods
  if (membership.role === "moderator" && targetMembership.role === "moderator") {
    return NextResponse.json({ error: "Moderators cannot mute other moderators." }, { status: 403 })
  }

  const mutedUntil = new Date(Date.now() + data.duration_minutes * 60 * 1000).toISOString()

  // Upsert mute
  const { error: muteErr } = await supabase
    .from("room_mutes")
    .upsert({
      room_id: roomId,
      user_id: data.user_id,
      muted_by: user.id,
      reason: data.reason ?? null,
      muted_until: mutedUntil,
    }, { onConflict: "room_id,user_id" })

  if (muteErr) {
    return NextResponse.json({ error: "Failed to mute user." }, { status: 500 })
  }

  // Log the action
  await supabase.from("room_audit_log").insert({
    room_id: roomId,
    actor_id: user.id,
    action: "mute",
    target_id: data.user_id,
    metadata: { duration_minutes: data.duration_minutes, reason: data.reason ?? null },
  })

  return NextResponse.json({ success: true, muted_until: mutedUntil })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

// Unmute a user
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
    return NextResponse.json({ error: "Only admins can unmute members." }, { status: 403 })
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, unmuteSchema)
  if (validationError) return validationError

  const { error: deleteErr } = await supabase
    .from("room_mutes")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", data.user_id)

  if (deleteErr) {
    return NextResponse.json({ error: "Failed to unmute user." }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
