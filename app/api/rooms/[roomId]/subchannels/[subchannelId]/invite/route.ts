import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { rateLimited, RATE_LIMITS } from "@/lib/rateLimit"

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

  // RLS lets admins/members read the row (not the token column).
  const { data: sub, error } = await supabase
    .from("room_subchannels")
    .select("slug, visibility, room_id")
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

  // API roles can't read invite_token (AUTHZ-7); fetch it after the admin check.
  let token: string | null = null
  if (sub.visibility === "private") {
    const { data } = await createAdminClient()
      .from("room_subchannels")
      .select("invite_token")
      .eq("id", subchannelId)
      .maybeSingle()
    token = data?.invite_token ?? null
  }
  return NextResponse.json({ slug: sub.slug, visibility: sub.visibility, token })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

export const POST = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { subchannelId } = await context!.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  const limited = await rateLimited(`room-admin:${user.id}`, RATE_LIMITS.adminAction)
  if (limited) return limited

  const { data: result, error } = await supabase.rpc("room_rotate_invite", {
    p_subchannel_id: subchannelId,
  })

  if (error) return NextResponse.json({ error: "Failed to rotate invite." }, { status: 500 })
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 403 })
  return NextResponse.json({ success: true, token: result.invite_token })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
