import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * PATCH  — update a sub-channel (name/topic/icon/post_policy/join_policy). Admin.
 * DELETE — delete a sub-channel (cannot delete the default). Admin.
 * Authorization lives in the RPCs.
 */

const updateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  topic: z.string().max(200).nullable().optional(),
  icon: z.string().max(8).optional(),
  post_policy: z.enum(["everyone", "members", "admins"]).optional(),
  join_policy: z.enum(["open", "request"]).optional(),
})

export const PATCH = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { subchannelId } = await context!.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, updateSchema)
  if (validationError) return validationError

  const { data: result, error } = await supabase.rpc("room_update_subchannel", {
    p_subchannel_id: subchannelId,
    p_name: data.name ?? null,
    p_topic: data.topic ?? null,
    p_icon: data.icon ?? null,
    p_post_policy: data.post_policy ?? null,
    p_join_policy: data.join_policy ?? null,
  })

  if (error) return NextResponse.json({ error: "Failed to update sub-channel." }, { status: 500 })
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 403 })
  return NextResponse.json({ success: true })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

export const DELETE = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { subchannelId } = await context!.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { data: result, error } = await supabase.rpc("room_delete_subchannel", {
    p_subchannel_id: subchannelId,
  })

  if (error) return NextResponse.json({ error: "Failed to delete sub-channel." }, { status: 500 })
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 403 })
  return NextResponse.json({ success: true })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
