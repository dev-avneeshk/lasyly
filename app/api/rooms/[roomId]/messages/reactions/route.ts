import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const ALLOWED_EMOJIS = ["🔥", "💰", "🎯", "👀", "💪", "❤️"] as const

const reactionSchema = z.object({
  message_id: z.string().uuid(),
  emoji: z.string().refine((val) => ALLOWED_EMOJIS.includes(val as typeof ALLOWED_EMOJIS[number]), {
    message: "Invalid emoji. Allowed: 🔥, 💰, 🎯, 👀, 💪, ❤️",
  }),
})

export const POST = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  // Rate limit: 30 reactions per minute
  const rateCheck = checkRateLimit(`reactions:${user.id}`, { maxRequests: 30, windowMs: 60000 })
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many reactions. Please slow down." },
      { status: 429 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, reactionSchema)
  if (validationError) return validationError

  // Check if reaction already exists (toggle behavior)
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", data.message_id)
    .eq("user_id", user.id)
    .eq("emoji", data.emoji)
    .maybeSingle()

  if (existing) {
    // Remove the reaction
    const { error: deleteErr } = await supabase
      .from("message_reactions")
      .delete()
      .eq("id", existing.id)

    if (deleteErr) {
      return NextResponse.json({ error: "Failed to remove reaction." }, { status: 500 })
    }

    return NextResponse.json({ action: "removed", emoji: data.emoji, message_id: data.message_id })
  }

  // Add the reaction
  const { error: insertErr } = await supabase
    .from("message_reactions")
    .insert({
      message_id: data.message_id,
      user_id: user.id,
      emoji: data.emoji,
    })

  if (insertErr) {
    return NextResponse.json({ error: "Failed to add reaction." }, { status: 500 })
  }

  return NextResponse.json(
    { action: "added", emoji: data.emoji, message_id: data.message_id },
    { status: 201 }
  )
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
