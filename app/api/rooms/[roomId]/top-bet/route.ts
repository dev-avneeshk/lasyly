import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * GET /api/rooms/[roomId]/top-bet
 *
 * The room's featured bet for the right panel:
 *   1. An admin-pinned betslip message (pinned_messages -> a kind='betslip'
 *      message), if one exists.
 *   2. Otherwise the best winning shared betslip in the room (highest odds
 *      among won parlays shared as messages).
 *
 * Degrades to { bet: null } if the channels/betslip schema isn't present.
 */

type BetRow = {
  id: string
  odds: number | null
  stake: number | null
  status: string
  combined_hit_rate: number | null
  custom_note: string | null
}

export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { roomId } = await context!.params
  const supabase = await createClient()

  const shape = (row: BetRow, author: string | null, pinned: boolean) => ({
    id: row.id,
    odds: row.odds,
    stake: row.stake,
    status: row.status,
    combined_hit_rate: row.combined_hit_rate,
    custom_note: row.custom_note,
    author,
    pinned,
  })

  try {
    // 1. Admin-pinned betslip message.
    const { data: pins } = await supabase
      .from("pinned_messages")
      .select("message_id, messages:message_id (betslip_id, kind, user_id, profiles:user_id (display_name, username))")
      .eq("room_id", roomId)
      .order("pinned_at", { ascending: false })
      .limit(10)

    // One lookup for all pinned betslips (was one query per pin); newest pin wins.
    const pinned = (pins ?? []).flatMap((p) => {
      const m = Array.isArray(p.messages) ? p.messages[0] : p.messages
      return m?.kind === "betslip" && m.betslip_id ? [m] : []
    })
    if (pinned.length > 0) {
      const { data: pinnedParlays } = await supabase
        .from("parlays")
        .select("id, odds, stake, status, combined_hit_rate, custom_note")
        .in("id", pinned.map((m) => m.betslip_id))
      const byId = new Map((pinnedParlays ?? []).map((row) => [row.id, row]))
      for (const msg of pinned) {
        const parlay = byId.get(msg.betslip_id)
        if (parlay) {
          const prof = Array.isArray(msg.profiles) ? msg.profiles[0] : msg.profiles
          return NextResponse.json({ bet: shape(parlay, prof?.display_name || prof?.username || null, true) })
        }
      }
    }

    // 2. Best winning shared betslip in the room.
    const { data: betMsgs } = await supabase
      .from("messages")
      .select("betslip_id, profiles:user_id (display_name, username)")
      .eq("room_id", roomId)
      .eq("kind", "betslip")
      .not("betslip_id", "is", null)
      .order("created_at", { ascending: false }) // the latest 100, not an arbitrary 100
      .limit(100)

    const ids = (betMsgs ?? []).map((m) => m.betslip_id).filter(Boolean) as string[]
    if (ids.length === 0) return NextResponse.json({ bet: null })

    const { data: parlays } = await supabase
      .from("parlays")
      .select("id, odds, stake, status, combined_hit_rate, custom_note")
      .in("id", ids)
      .eq("status", "won")
      .order("odds", { ascending: false })
      .limit(1)

    const best = parlays?.[0]
    if (!best) return NextResponse.json({ bet: null })

    const authorMsg = (betMsgs ?? []).find((m) => m.betslip_id === best.id)
    const prof = authorMsg ? (Array.isArray(authorMsg.profiles) ? authorMsg.profiles[0] : authorMsg.profiles) : null
    return NextResponse.json({ bet: shape(best, prof?.display_name || prof?.username || null, false) })
  } catch {
    return NextResponse.json({ bet: null })
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
