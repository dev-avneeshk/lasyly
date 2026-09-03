import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * POST /api/channels/join  { slug, token? }
 *
 * Join via a public slug or a private invite link. Delegates to the
 * `subchannel_join` RPC which handles: ban check, private-token validation,
 * open vs request join policy, and idempotent membership insert.
 *
 * Returns { joined: true } or { requested: true } plus the room_id so the
 * client can route into the room (or show a "pending approval" state).
 */

const joinSchema = z.object({
  slug: z.string().min(4).max(16),
  token: z.string().max(64).optional(),
})

export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Sign in to join." }, { status: 401 })

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, joinSchema)
  if (validationError) return validationError

  const { data: result, error } = await supabase.rpc("subchannel_join", {
    p_slug: data.slug,
    p_token: data.token ?? null,
  })

  if (error) return NextResponse.json({ error: "Failed to join." }, { status: 500 })
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 403 })

  return NextResponse.json({
    success: true,
    joined: result.joined ?? false,
    requested: result.requested ?? false,
    roomId: result.room_id,
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
