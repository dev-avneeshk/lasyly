import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { rateLimited, RATE_LIMITS } from "@/lib/rateLimit"
import { broadcastMembersChanged } from "@/lib/realtime/members"

const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["moderator", "member"]),
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
  const limited = await rateLimited(`room-admin:${user.id}`, RATE_LIMITS.adminAction)
  if (limited) return limited

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, roleSchema)
  if (validationError) return validationError

  const { data: result, error } = await supabase.rpc("room_set_member_role", {
    p_room_id: roomId,
    p_target_user_id: data.user_id,
    p_new_role: data.role,
  })

  if (error) {
    return NextResponse.json({ error: "Failed to update role." }, { status: 500 })
  }

  if (result?.error) {
    return NextResponse.json({ error: result.error }, { status: 403 })
  }

  await broadcastMembersChanged(roomId) // other viewers refetch the list
  return NextResponse.json({ success: true, new_role: result.new_role })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
