import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { sanitizeText, isSpamMessage } from "@/lib/sanitize"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"


const MESSAGE_TTL_DAYS = 30

const messageSchema = z.object({
  content: z.string().max(1000).optional().default(""),
  subchannelId: z.string().uuid().optional(),
  kind: z.enum(["text", "betslip"]).optional().default("text"),
  betslipId: z.string().uuid().optional(),
}).refine(
  (v) => v.kind === "betslip" ? Boolean(v.betslipId) : v.content.trim().length > 0,
  { message: "Text messages need content; betslip messages need a betslipId." }
)

export const GET = withSecurity(async (
  request: Request,
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

  // Support cursor-based pagination for older messages
  const url = new URL(request.url)
  const cursor = url.searchParams.get("before") // ISO timestamp cursor
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100)
  const subchannelId = url.searchParams.get("subchannelId") // optional; scopes to a sub-channel

  const fetchMessages = async () => {
    const cutoff = new Date(Date.now() - MESSAGE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    let query = supabase
      .from("messages")
      .select(`
        id,
        content,
        is_system,
        created_at,
        user_id,
        kind,
        betslip_id,
        profiles:user_id (username, display_name, avatar_url)
      `)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(limit)

    // Scope to a sub-channel when provided; otherwise the whole room.
    if (subchannelId) query = query.eq("subchannel_id", subchannelId)
    else query = query.eq("room_id", roomId)

    if (cursor) query = query.lt("created_at", cursor)
    return query
  }

  // Chat history is fetched fresh every time — no caching. A short cache here
  // caused just-sent messages to briefly vanish on refetch (the cached
  // pre-message snapshot was served back). Chat is realtime and the query is
  // cheap (indexed on subchannel_id, created_at), so we always hit the DB.
  let { data: messages, error } = await fetchMessages()

  // Backward-compat: if the sub-channel columns aren't migrated yet, retry
  // room-scoped without them so chat keeps working.
  if (error && (error.code === "42703" || error.message?.includes("does not exist"))) {
    const fallback = await supabase
      .from("messages")
      .select(`id, content, is_system, created_at, user_id, profiles:user_id (username, display_name, avatar_url)`)
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(limit)
    messages = fallback.data as typeof messages
    error = fallback.error
  }

  if (error) {
    return NextResponse.json({ error: "Failed to fetch messages." }, { status: 500 })
  }

  // Hydrate betslip cards in one query (avoids N+1) for kind='betslip' rows.
  const betslipIds = (messages ?? [])
    .map((m) => (m as { betslip_id?: string }).betslip_id)
    .filter((id): id is string => Boolean(id))
  const betslipMap = new Map<string, unknown>()
  if (betslipIds.length > 0) {
    const { data: parlays } = await supabase
      .from("parlays")
      .select("id, odds, stake, status, custom_note, combined_hit_rate")
      .in("id", betslipIds)
    for (const p of parlays ?? []) betslipMap.set(p.id, p)
  }

  const formatted = (messages ?? []).map((msg) => {
    const profile = Array.isArray(msg.profiles) ? msg.profiles[0] ?? null : msg.profiles
    const m = msg as typeof msg & { kind?: string; betslip_id?: string }
    return {
      id: msg.id,
      content: msg.content,
      is_system: msg.is_system,
      created_at: msg.created_at,
      user_id: msg.user_id,
      kind: m.kind ?? "text",
      betslip: m.betslip_id ? betslipMap.get(m.betslip_id) ?? null : null,
      profile: profile
        ? {
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          }
        : null,
    }
  })

  // Reverse so oldest is first (we fetched DESC for cursor pagination)
  formatted.reverse()

  const hasMore = (messages ?? []).length === limit
  const nextCursor = hasMore && messages && messages.length > 0
    ? messages[messages.length - 1].created_at
    : null

  return NextResponse.json({ messages: formatted, hasMore, nextCursor })
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
  const rateCheck = await checkRateLimit(rateLimitKey, RATE_LIMITS.chat)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Slow down. You can send 1 message every 2 seconds." },
      { status: 429 }
    )
  }

  // Burst limit: max 10 messages per 30 seconds
  const burstKey = `chat-burst:${user.id}:${roomId}`
  const burstCheck = await checkRateLimit(burstKey, RATE_LIMITS.chatBurst)
  if (!burstCheck.allowed) {
    return NextResponse.json(
      { error: "You're sending messages too fast. Please wait a moment." },
      { status: 429 }
    )
  }

  // Global flood protection: max 30 messages per 5 minutes across all rooms
  const floodKey = `chat-flood:${user.id}`
  const floodCheck = await checkRateLimit(floodKey, RATE_LIMITS.chatFlood)
  if (!floodCheck.allowed) {
    return NextResponse.json(
      { error: "You've sent too many messages. Please wait a few minutes." },
      { status: 429 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, messageSchema)
  if (validationError) return validationError

  const isBetslip = data.kind === "betslip"

  // Sanitize: strip HTML, trim, enforce max length. Betslip cards may have no
  // text body (the card is the content), so empty is allowed for those.
  const content = sanitizeText(data.content ?? "", 1000)

  if (!isBetslip && content.length === 0) {
    return NextResponse.json(
      { error: "Message content cannot be empty after sanitization." },
      { status: 400 }
    )
  }

  // Spam detection (text messages only)
  if (!isBetslip && isSpamMessage(content)) {
    return NextResponse.json(
      { error: "Message flagged as spam. Please write a normal message." },
      { status: 400 }
    )
  }

  // For betslip shares, verify the parlay belongs to the sender.
  if (isBetslip) {
    const { data: parlay } = await supabase
      .from("parlays")
      .select("id, user_id")
      .eq("id", data.betslipId!)
      .maybeSingle()
    if (!parlay || parlay.user_id !== user.id) {
      return NextResponse.json({ error: "You can only share your own betslip." }, { status: 403 })
    }
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

  // Check if user is muted
  const { data: muteCheck } = await supabase
    .from("room_mutes")
    .select("muted_until")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .gt("muted_until", new Date().toISOString())
    .maybeSingle()

  if (muteCheck) {
    const until = new Date(muteCheck.muted_until).toLocaleString()
    return NextResponse.json(
      { error: `You are muted in this room until ${until}.` },
      { status: 403 }
    )
  }

  // Resolve the target sub-channel: the one provided, else the room's default.
  // If the channels schema isn't migrated, this resolves to null and we insert
  // a room-scoped message (legacy behavior).
  let subchannelId: string | null = data.subchannelId ?? null
  if (!subchannelId) {
    const { data: def } = await supabase
      .from("room_subchannels")
      .select("id")
      .eq("room_id", roomId)
      .eq("is_default", true)
      .maybeSingle()
    subchannelId = def?.id ?? null
  }

  // Insert message. Include the new columns when we have a sub-channel; RLS
  // (can_post_subchannel) enforces posting rights at the DB level.
  const insertPayload: Record<string, unknown> = {
    room_id: roomId,
    user_id: user.id,
    content,
    is_system: false,
  }
  if (subchannelId) {
    insertPayload.subchannel_id = subchannelId
    insertPayload.kind = data.kind
    if (isBetslip) insertPayload.betslip_id = data.betslipId
  }

  let { data: message, error: insertErr } = await supabase
    .from("messages")
    .insert(insertPayload)
    .select()
    .single()

  // Backward-compat: columns not migrated yet → retry the legacy shape.
  if (insertErr && (insertErr.code === "42703" || insertErr.message?.includes("does not exist"))) {
    const legacy = await supabase
      .from("messages")
      .insert({ room_id: roomId, user_id: user.id, content, is_system: false })
      .select()
      .single()
    message = legacy.data
    insertErr = legacy.error
  }

  if (insertErr) {
    // RLS rejection (e.g. admins-only channel) surfaces as a policy violation.
    const denied = insertErr.code === "42501" || insertErr.message?.toLowerCase().includes("policy")
    return NextResponse.json(
      { error: denied ? "You don't have permission to post in this channel." : "Failed to send message." },
      { status: denied ? 403 : 500 }
    )
  }

  return NextResponse.json(message, { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
