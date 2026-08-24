import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const markReadSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }),
  z.object({ all: z.literal(true) }),
])

/** GET /api/notifications — fetch user's notifications (paginated, newest first) */
export const GET = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10))
  const limit = 20
  const offset = (page - 1) * limit

  try {
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      // Table might not exist yet
      if (error.code === "42P01") {
        return NextResponse.json({ notifications: [], unreadCount: 0 })
      }
      return NextResponse.json({ error: "Failed to fetch notifications." }, { status: 500 })
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    return NextResponse.json({
      notifications: notifications ?? [],
      unreadCount: unreadCount ?? 0,
      page,
    })
  } catch {
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

/** PATCH /api/notifications — mark notifications as read */
export const PATCH = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  // Rate limit
  const rateCheck = await checkRateLimit(`notifications:${user.id}`, RATE_LIMITS.general)
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 })
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, markReadSchema)
  if (validationError) return validationError

  try {
    if ("all" in data) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false)

      if (error) {
        return NextResponse.json({ error: "Failed to mark notifications as read." }, { status: 500 })
      }
    } else {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .in("id", data.ids)

      if (error) {
        return NextResponse.json({ error: "Failed to mark notifications as read." }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to update notifications." }, { status: 500 })
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
