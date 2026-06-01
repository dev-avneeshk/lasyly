import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const kickSchema = z.object({
  user_id: z.string().uuid(),
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
  const [data, validationError] = validateRequestBody(body, kickSchema)
  if (validationError) return validationError

  const { data: result, error } = await supabase.rpc("room_kick_member", {
    p_room_id: roomId,
    p_target_user_id: data.user_id,
  })

  if (error) {
    return NextResponse.json({ error: "Failed to kick member." }, { status: 500 })
  }

  if (result?.error) {
    return NextResponse.json({ error: result.error }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
