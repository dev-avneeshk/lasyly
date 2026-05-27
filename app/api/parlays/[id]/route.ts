import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// ─── PATCH /api/parlays/[id] ─────────────────────────────────────────────────

const VALID_STATUSES = ["pending", "won", "lost"] as const
const VALID_VISIBILITIES = ["public", "private"] as const

export const PATCH = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context!.params
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

  // Parse request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }

  const { status, visibility } = body as {
    status?: string
    visibility?: string
  }

  // At least one field must be provided
  if (!status && !visibility) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }

  // Validate status value if provided
  if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }

  // Validate visibility value if provided
  if (visibility && !VALID_VISIBILITIES.includes(visibility as typeof VALID_VISIBILITIES[number])) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }

  // Build the update object
  const updateData: Record<string, string | null> = {}

  if (status) {
    updateData.status = status
    if (status === "won" || status === "lost") {
      updateData.resolved_at = new Date().toISOString()
    } else if (status === "pending") {
      updateData.resolved_at = null
    }
  }

  if (visibility) {
    updateData.visibility = visibility
  }

  // Perform the update — RLS ensures only the owner can update
  const { data: updatedParlay, error: updateError } = await supabase
    .from("parlays")
    .update(updateData)
    .eq("id", id)
    .select()
    .single()

  if (updateError || !updatedParlay) {
    // RLS will cause no rows to be returned for non-owned or non-existent parlays
    if (updateError?.code === "PGRST116" || !updatedParlay) {
      return NextResponse.json(
        { error: "Parlay not found." },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update parlay." },
      { status: 500 }
    )
  }

  // Handle Realtime broadcasts for visibility changes
  if (visibility === "public") {
    // Fetch legs to include in the broadcast payload
    const { data: legs } = await supabase
      .from("parlay_legs")
      .select("*")
      .eq("parlay_id", id)
      .order("leg_order", { ascending: true })

    const channel = supabase.channel("parlays-feed")
    await channel.send({
      type: "broadcast",
      event: "new_parlay",
      payload: { parlay: { ...updatedParlay, legs: legs || [] } },
    })
    await supabase.removeChannel(channel)
  } else if (visibility === "private") {
    const channel = supabase.channel("parlays-feed")
    await channel.send({
      type: "broadcast",
      event: "remove_parlay",
      payload: { parlayId: id },
    })
    await supabase.removeChannel(channel)
  }

  return NextResponse.json(updatedParlay, { status: 200 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
