import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const reactionSchema = z.object({
  emoji: z.string().min(1).max(32),
})

export const POST = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { betslipId } = await context!.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to react." },
      { status: 401 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, reactionSchema)
  if (validationError) return validationError

  // Validate betslip exists
  const { data: betslip, error: betslipErr } = await supabase
    .from("betslips")
    .select("id, room_id")
    .eq("id", betslipId)
    .maybeSingle()

  if (betslipErr) {
    return NextResponse.json({ error: "Failed to validate betslip." }, { status: 500 })
  }

  if (!betslip) {
    return NextResponse.json(
      { error: "Betslip not found." },
      { status: 404 }
    )
  }

  // Check access for private room betslips
  if (betslip.room_id) {
    const { data: room } = await supabase
      .from("rooms")
      .select("type")
      .eq("id", betslip.room_id)
      .maybeSingle()

    if (room?.type === "Private") {
      const { data: membership } = await supabase
        .from("room_members")
        .select("id")
        .eq("room_id", betslip.room_id)
        .eq("user_id", user.id)
        .maybeSingle()

      if (!membership) {
        return NextResponse.json(
          { error: "You must be a room member to react to this betslip." },
          { status: 403 }
        )
      }
    }
  }

  // Check if user already has this reaction (toggle behavior)
  const { data: existing, error: lookupErr } = await supabase
    .from("reactions")
    .select("id")
    .eq("betslip_id", betslipId)
    .eq("user_id", user.id)
    .eq("emoji", data.emoji)
    .maybeSingle()

  if (lookupErr) {
    return NextResponse.json({ error: "Failed to check existing reaction." }, { status: 500 })
  }

  if (existing) {
    // Remove the reaction (toggle off)
    const { error: deleteErr } = await supabase
      .from("reactions")
      .delete()
      .eq("id", existing.id)

    if (deleteErr) {
      return NextResponse.json({ error: "Failed to remove reaction." }, { status: 500 })
    }
  } else {
    // Check max 5 distinct emojis per user per betslip
    const { data: userReactions, error: countErr } = await supabase
      .from("reactions")
      .select("emoji")
      .eq("betslip_id", betslipId)
      .eq("user_id", user.id)

    if (countErr) {
      return NextResponse.json({ error: "Failed to count reactions." }, { status: 500 })
    }

    const distinctEmojis = new Set(userReactions?.map((r) => r.emoji) ?? [])
    if (distinctEmojis.size >= 5 && !distinctEmojis.has(data.emoji)) {
      return NextResponse.json(
        { error: "Maximum 5 distinct emoji reactions per betslip." },
        { status: 400 }
      )
    }

    // Insert the reaction
    const { error: insertErr } = await supabase
      .from("reactions")
      .insert({
        betslip_id: betslipId,
        user_id: user.id,
        emoji: data.emoji,
      })

    if (insertErr) {
      return NextResponse.json({ error: "Failed to add reaction." }, { status: 500 })
    }
  }

  // Get updated reaction counts grouped by emoji
  const { data: allReactions, error: reactionsErr } = await supabase
    .from("reactions")
    .select("emoji")
    .eq("betslip_id", betslipId)

  if (reactionsErr) {
    return NextResponse.json({ error: "Failed to fetch reactions." }, { status: 500 })
  }

  // Group by emoji and count
  const counts: Record<string, number> = {}
  for (const r of allReactions ?? []) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1
  }

  const reactionCounts = Object.entries(counts).map(([e, count]) => ({
    emoji: e,
    count,
  }))

  return NextResponse.json({
    betslip_id: betslipId,
    toggled: existing ? "removed" : "added",
    emoji: data.emoji,
    reactions: reactionCounts,
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
