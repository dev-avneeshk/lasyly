import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// ─── Schema ──────────────────────────────────────────────────────────────────

const updateBetStatusSchema = z.object({
  status: z.enum(["won", "lost", "push"]),
})

// ─── PATCH /api/bets/[betId] ─────────────────────────────────────────────────

export const PATCH = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { betId } = await context!.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to update a bet." },
      { status: 401 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, updateBetStatusSchema)
  if (validationError) return validationError

  // Fetch the bet to verify it exists and belongs to the user
  // RLS handles user scoping, but we also check explicitly
  const { data: bet, error: fetchErr } = await supabase
    .from("bet_tracker")
    .select("id, user_id, status")
    .eq("id", betId)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: "Failed to fetch bet." }, { status: 500 })
  }

  if (!bet) {
    return NextResponse.json(
      { error: "Bet not found." },
      { status: 404 }
    )
  }

  // Defense-in-depth: explicit ownership check (RLS also enforces this)
  if (bet.user_id !== user.id) {
    return NextResponse.json(
      { error: "You can only update your own bets." },
      { status: 403 }
    )
  }

  // Only pending bets can be resolved
  if (bet.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending bets can be updated." },
      { status: 400 }
    )
  }

  // Update status and set resolved_at
  const { data: updated, error: updateErr } = await supabase
    .from("bet_tracker")
    .update({
      status: data.status,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", betId)
    .eq("status", "pending") // concurrency guard
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update bet." }, { status: 500 })
  }

  return NextResponse.json(updated)
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
