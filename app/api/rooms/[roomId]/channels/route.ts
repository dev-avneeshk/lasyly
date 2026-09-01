import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * Channels API — the two-level structure for a room:
 *   Room -> Channels (this file) -> Sub-channels -> Messages
 *
 * GET  lists channels + their sub-channels (RLS filters by visibility).
 * POST creates a channel (admin-only, free-tier limit enforced in the RPC).
 *
 * If the channels schema hasn't been migrated yet, GET degrades to an empty
 * list rather than 500ing, so the room page keeps working.
 */

const createChannelSchema = z.object({
  name: z.string().min(1).max(40),
  icon: z.string().max(8).optional(),
})

function isMissingSchema(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === "42P01" || error.code === "42703") return true
  if (error.code === "PGRST205" || error.code === "PGRST204") return true
  const msg = error.message?.toLowerCase() ?? ""
  return msg.includes("does not exist") || msg.includes("could not find")
}

export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const [channelsRes, subsRes] = await Promise.all([
    supabase
      .from("room_channels")
      .select("id, name, icon, position")
      .eq("room_id", roomId)
      .order("position", { ascending: true }),
    supabase
      .from("room_subchannels")
      .select("id, channel_id, name, topic, icon, position, visibility, post_policy, join_policy, slug, is_default")
      .eq("room_id", roomId)
      .order("position", { ascending: true }),
  ])

  if (channelsRes.error) {
    // Not migrated yet — degrade gracefully so the room still loads.
    if (isMissingSchema(channelsRes.error)) {
      return NextResponse.json({ channels: [], migrated: false })
    }
    return NextResponse.json({ error: "Failed to load channels." }, { status: 500 })
  }

  const subs = subsRes.data ?? []
  const channels = (channelsRes.data ?? []).map((ch) => ({
    ...ch,
    subchannels: subs
      .filter((s) => s.channel_id === ch.id)
      .map((s) => ({ ...s, invite_token: undefined })), // never leak tokens in the list
  }))

  return NextResponse.json({ channels, migrated: true })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })

export const POST = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, createChannelSchema)
  if (validationError) return validationError

  const { data: result, error } = await supabase.rpc("room_create_channel", {
    p_room_id: roomId,
    p_name: data.name,
    p_icon: data.icon ?? null,
  })

  if (error) return NextResponse.json({ error: "Failed to create channel." }, { status: 500 })
  if (result?.error === "LIMIT_REACHED") {
    // 402 signals the client to show the upgrade modal.
    return NextResponse.json({ error: "LIMIT_REACHED", limit: result.limit }, { status: 402 })
  }
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 403 })

  return NextResponse.json({ success: true, id: result.id }, { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
