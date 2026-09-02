import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * GET /api/rooms/[roomId]/channels
 *
 * Flat, single-level model: a room has sub-channels directly (no middle
 * "channel group" layer). Returns the room's sub-channels ordered by position,
 * default first. Degrades to an empty list if the schema isn't migrated so the
 * room page keeps working.
 */

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

  const SELECT =
    "id, name, topic, icon, position, visibility, post_policy, join_policy, slug, is_default"

  const query = () =>
    supabase
      .from("room_subchannels")
      .select(SELECT)
      .eq("room_id", roomId)
      .order("is_default", { ascending: false })
      .order("position", { ascending: true })

  const { data, error } = await query()

  if (error) {
    if (isMissingSchema(error)) return NextResponse.json({ subchannels: [], migrated: false })
    return NextResponse.json({ error: "Failed to load channels." }, { status: 500 })
  }

  // Self-heal: a room with zero sub-channels leaves the client with no channel
  // to post into, which used to surface as "Join this room to chat" even for the
  // owner. Rooms created before the AFTER INSERT trigger in
  // 20260904_repair_room_features.sql are in exactly that state, so create the
  // default sub-channel on first read. The RPC is idempotent and only ever
  // touches the room's own default channel.
  if ((data ?? []).length === 0) {
    const { error: healError } = await supabase.rpc("room_ensure_default_subchannel", {
      p_room_id: roomId,
    })
    // Missing RPC just means the repair migration hasn't run; fall through with
    // an empty list rather than failing the whole request.
    if (!healError) {
      const { data: healed } = await query()
      if (healed?.length) return NextResponse.json({ subchannels: healed, migrated: true })
    }
  }

  return NextResponse.json({ subchannels: data ?? [], migrated: true })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })
