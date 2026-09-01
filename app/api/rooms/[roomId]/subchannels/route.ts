import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * POST /api/rooms/[roomId]/subchannels
 * Create a sub-channel directly under the room (flat, single-level model).
 * Admin-only + free-tier limit (max 2 extra beyond the default) enforced in
 * the room_create_subchannel RPC. Returns slug + (private) invite token once.
 */

const createSubchannelSchema = z.object({
  name: z.string().min(1).max(40),
  visibility: z.enum(["public", "private"]).default("public"),
  post_policy: z.enum(["everyone", "members", "admins"]).default("members"),
  join_policy: z.enum(["open", "request"]).default("open"),
  icon: z.string().max(8).optional(),
  topic: z.string().max(200).optional(),
})

export const POST = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, createSubchannelSchema)
  if (validationError) return validationError

  const { data: result, error } = await supabase.rpc("room_create_subchannel", {
    p_room_id: roomId,
    p_name: data.name,
    p_visibility: data.visibility,
    p_post_policy: data.post_policy,
    p_join_policy: data.join_policy,
    p_icon: data.icon ?? null,
    p_topic: data.topic ?? null,
  })

  if (error) return NextResponse.json({ error: "Failed to create sub-channel." }, { status: 500 })
  if (result?.error === "LIMIT_REACHED") {
    return NextResponse.json({ error: "LIMIT_REACHED", limit: result.limit }, { status: 402 })
  }
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 403 })

  return NextResponse.json(
    { success: true, id: result.id, slug: result.slug, invite_token: result.invite_token ?? null },
    { status: 201 }
  )
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
