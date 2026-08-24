import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

/**
 * POST /api/notifications/push — Save push subscription for the authenticated user.
 */
export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, subscriptionSchema)
  if (validationError) return validationError

  // Upsert subscription (user may re-subscribe from same browser)
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: data.endpoint,
      keys_p256dh: data.keys.p256dh,
      keys_auth: data.keys.auth,
    },
    { onConflict: "endpoint" }
  )

  if (error) {
    console.error("Push subscription save error:", error.message)
    return NextResponse.json({ error: "Failed to save subscription." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

/**
 * DELETE /api/notifications/push — Remove push subscription.
 */
export const DELETE = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  const body = await request.json()
  const parsed = unsubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid endpoint." }, { status: 400 })
  }

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint)

  return NextResponse.json({ ok: true })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

/**
 * GET /api/notifications/push — Get VAPID public key for the client.
 */
export const GET = withSecurity(async () => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY

  if (!vapidPublicKey) {
    return NextResponse.json(
      { error: "Push notifications not configured." },
      { status: 503 }
    )
  }

  return NextResponse.json({ vapidPublicKey })
}, { cacheControl: CACHE_CONTROL.PUBLIC_LONG })
