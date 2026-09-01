import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * GET  — admin fetches the current invite link parts (slug + token) for a
 *        private sub-channel so they can share it.
 * POST — admin rotates the invite token (old links stop working).
 */

export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { subchannelId } = await context!.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  // RLS lets admins/members read the row; token is only meaningful to admins.
  const { data: sub, error } = await supabase
    .from("room_subchannels")
    .select("slug, visibility, invite_token, room_id")
    .eq("id", subchannelId)
    .maybeSingle()

  if (error || !sub) return NextResponse.json({ error: "Not found." }, { status: 404 })

  // Only room admins can see the token.
  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", sub.room_id)
    .eq("user_id", user.id)
    .maybeSingle()

  const isAdmin = membership?.role === "owner" || membership?.role === "moderator"
  if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 })

  return NextResponse.json({
    slug: sub.slug,
    visibility: sub.visibility,
    token: sub.visibility === "private" ? sub.invite_token : null,
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

export const POST = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { subchannelId } = await context!.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const { data: result, error } = await supabase.rpc("room_rotate_invite", {
    p_subchannel_id: subchannelId,
  })

  if (error) return NextResponse.json({ error: "Failed to rotate invite." }, { status: 500 })
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 403 })
  return NextResponse.json({ success: true, token: result.invite_token })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
