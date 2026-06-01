import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const deleteSchema = z.object({
  message_id: z.string().uuid(),
})

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

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, deleteSchema)
  if (validationError) return validationError

  // Get the message
  const { data: msg } = await supabase
    .from("messages")
    .select("id, user_id")
    .eq("id", data.message_id)
    .eq("room_id", roomId)
    .maybeSingle()

  if (!msg) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 })
  }

  // Check permission: own message OR admin
  const isOwnMessage = msg.user_id === user.id

  if (!isOwnMessage) {
    const { data: membership } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!membership || (membership.role !== "owner" && membership.role !== "moderator")) {
      return NextResponse.json({ error: "You can only delete your own messages." }, { status: 403 })
    }
  }

  // Delete the message
  const { error: deleteErr } = await supabase
    .from("messages")
    .delete()
    .eq("id", data.message_id)

  if (deleteErr) {
    return NextResponse.json({ error: "Failed to delete message." }, { status: 500 })
  }

  // Also remove from pinned if it was pinned
  await supabase
    .from("pinned_messages")
    .delete()
    .eq("message_id", data.message_id)
    .eq("room_id", roomId)

  return NextResponse.json({ success: true })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
