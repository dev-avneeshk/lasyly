import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * POST /api/rooms/[roomId]/requests/[requestId]  { approve: boolean }
 * Admin approves or denies a pending join request. Delegates to the
 * `subchannel_decide_request` RPC (admin check + idempotent membership insert).
 */

const decideSchema = z.object({ approve: z.boolean() })

export const POST = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { requestId } = await context!.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, decideSchema)
  if (validationError) return validationError

  const { data: result, error } = await supabase.rpc("subchannel_decide_request", {
    p_request_id: requestId,
    p_approve: data.approve,
  })

  if (error) return NextResponse.json({ error: "Failed to decide request." }, { status: 500 })
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 403 })
  return NextResponse.json({ success: true })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
