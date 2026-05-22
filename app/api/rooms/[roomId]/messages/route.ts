import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { sanitizeText, isSpamMessage } from "@/lib/sanitize"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const MESSAGE_TTL_HOURS = 24

const messageSchema = z.object({
  content: z.string().min(1).max(1000),
})

export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  // Check if room is private — if so, require membership
  const { data: room } = await supabase
    .from("rooms")
    .select("id, type")
    .eq("id", roomId)
    .maybeSingle()

  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 })
  }

  if (room.type === "Private") {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from("room_members")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: "You must be a member to view this room's messages." }, { status: 403 })
    }
  }

  const cutoff = new Date(Date.now() - MESSAGE_TTL_HOURS * 60 * 60 * 1000).toISOString()

  const { data: messages, error } = await supabase
    .from("messages")
    .select(`
      id,
      content,
      is_system,
      created_at,
      user_id,
      profiles:user_id (username, display_name, avatar_url)
    `)
    .eq("room_id", roomId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: "Failed to fetch messages." }, { status: 500 })
  }

  const formatted = (messages ?? []).map((msg) => {
    const profile = Array.isArray(msg.profiles) ? msg.profiles[0] ?? null : msg.profiles
    return {
      id: msg.id,
      content: msg.content,
      is_system: msg.is_system,
      created_at: msg.created_at,
      user_id: msg.user_id,
      profile: profile
        ? {
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          }
        : null,
    }
  })

  return NextResponse.json({ messages: formatted })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

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
    return NextResponse.json(
      { error: "You must be logged in to send messages." },
      { status: 401 }
    )
  }

  // Rate limit: 1 message per 2 seconds
  const rateLimitKey = `chat:${user.id}:${roomId}`
  const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMITS.chat)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Slow down. You can send 1 message every 2 seconds." },
      { status: 429 }
    )
  }

  // Burst limit: max 10 messages per 30 seconds
  const burstKey = `chat-burst:${user.id}:${roomId}`
  const burstCheck = checkRateLimit(burstKey, RATE_LIMITS.chatBurst)
  if (!burstCheck.allowed) {
    return NextResponse.json(
      { error: "You're sending messages too fast. Please wait a moment." },
      { status: 429 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, messageSchema)
  if (validationError) return validationError

  // Sanitize: strip HTML, trim, enforce max length
  const content = sanitizeText(data.content, 1000)

  if (content.length === 0) {
    return NextResponse.json(
      { error: "Message content cannot be empty after sanitization." },
      { status: 400 }
    )
  }

  // Spam detection
  if (isSpamMessage(content)) {
    return NextResponse.json(
      { error: "Message flagged as spam. Please write a normal message." },
      { status: 400 }
    )
  }

  // Check membership
  const { data: membership, error: memberErr } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (memberErr) {
    return NextResponse.json({ error: "Failed to check membership." }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json(
      { error: "You must be a member of this room to send messages." },
      { status: 403 }
    )
  }

  // Insert message
  const { data: message, error: insertErr } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      user_id: user.id,
      content,
      is_system: false,
    })
    .select()
    .single()

  if (insertErr) {
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 })
  }

  return NextResponse.json(message, { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
