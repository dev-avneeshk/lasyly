import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateCreateParlay } from "@/lib/parlays/validation"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// ─── GET /api/parlays ────────────────────────────────────────────────────────

export const GET = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    )
  }

  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1),
    50
  )
  const offset = Math.max(
    parseInt(url.searchParams.get("offset") || "0", 10) || 0,
    0
  )

  // Build query for user's parlays
  let query = supabase
    .from("parlays")
    .select("*, parlay_legs(*)", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  // Apply status filter if provided
  if (status && ["pending", "won", "lost"].includes(status)) {
    query = query.eq("status", status)
  }

  const { data: parlays, error, count } = await query

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch parlays." },
      { status: 500 }
    )
  }

  // Reshape: rename parlay_legs to legs and sort by leg_order
  const shaped = (parlays || []).map((p: Record<string, unknown>) => {
    const { parlay_legs, ...rest } = p
    return {
      ...rest,
      legs: (parlay_legs as Array<{ leg_order: number }> || []).sort(
        (a, b) => a.leg_order - b.leg_order
      ),
    }
  })

  return NextResponse.json(
    { parlays: shaped, total: count ?? 0 },
    { status: 200 }
  )
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

// ─── POST /api/parlays ───────────────────────────────────────────────────────

export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    )
  }

  // Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Validation failed.", code: "VALIDATION_ERROR", details: [{ field: "body", message: "Invalid JSON." }] },
      { status: 400 }
    )
  }

  const validation = validateCreateParlay(body)
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Validation failed.", code: "VALIDATION_ERROR", details: validation.errors },
      { status: 400 }
    )
  }

  // Extract validated fields from body
  const payload = body as {
    legs: Array<{
      player_name: string
      stat_category: string
      prop_line: number
      direction: "over" | "under"
      l10_hit_rate: number
      sport: string
    }>
    visibility: "public" | "private"
    odds?: number | null
    stake?: number | null
    custom_note?: string | null
    combined_hit_rate?: number | null
  }

  // Insert parlay row
  const { data: parlay, error: parlayError } = await supabase
    .from("parlays")
    .insert({
      user_id: user.id,
      visibility: payload.visibility,
      odds: payload.odds ?? null,
      stake: payload.stake ?? null,
      custom_note: payload.custom_note ?? null,
      combined_hit_rate: payload.combined_hit_rate ?? null,
      status: "pending",
    })
    .select()
    .single()

  if (parlayError || !parlay) {
    return NextResponse.json(
      { error: "Failed to save parlay." },
      { status: 500 }
    )
  }

  // Bulk insert legs with leg_order
  const legsToInsert = payload.legs.map((leg, index) => ({
    parlay_id: parlay.id,
    player_name: leg.player_name,
    stat_category: leg.stat_category,
    prop_line: leg.prop_line,
    direction: leg.direction,
    l10_hit_rate: leg.l10_hit_rate,
    sport: leg.sport,
    leg_order: index + 1,
  }))

  const { data: legs, error: legsError } = await supabase
    .from("parlay_legs")
    .insert(legsToInsert)
    .select()

  if (legsError || !legs) {
    // Clean up the parlay row if legs insertion fails
    await supabase.from("parlays").delete().eq("id", parlay.id)
    return NextResponse.json(
      { error: "Failed to save parlay." },
      { status: 500 }
    )
  }

  // Build the full response object
  const createdParlay = {
    ...parlay,
    legs: legs.sort((a: { leg_order: number }, b: { leg_order: number }) => a.leg_order - b.leg_order),
  }

  // If visibility is public, broadcast to parlays-feed Realtime channel
  if (payload.visibility === "public") {
    const channel = supabase.channel("parlays-feed")
    await channel.send({
      type: "broadcast",
      event: "new_parlay",
      payload: { parlay: createdParlay },
    })
    await supabase.removeChannel(channel)
  }

  return NextResponse.json(createdParlay, { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
