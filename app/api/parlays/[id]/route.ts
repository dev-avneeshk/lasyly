import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { rateLimited, RATE_LIMITS } from "@/lib/rateLimit"

// ─── PATCH /api/parlays/[id] ─────────────────────────────────────────────────
//
// Owners may only change `visibility`. Outcomes (status / resolved_at / leg
// results) are written by the settlement cron alone: letting the owner PATCH
// `status: "won"` made every leaderboard win rate self-reported. The DB enforces
// the same rule (column-level UPDATE grant, 20261002_parlays_owner_writes.sql).

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
  const limited = await rateLimited(`parlay-write:${user.id}`, RATE_LIMITS.feedWrite)
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }

  const { status, visibility } = (body ?? {}) as { status?: unknown; visibility?: unknown }

  if (status !== undefined) {
    return NextResponse.json(
      { error: "Parlay results are settled automatically and can't be set manually." },
      { status: 400 }
    )
  }

  if (!VALID_VISIBILITIES.includes(visibility as typeof VALID_VISIBILITIES[number])) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    )
  }

  // RLS ensures only the owner can update
  const { data: updatedParlay, error: updateError } = await supabase
    .from("parlays")
    .update({ visibility })
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

  return NextResponse.json(updatedParlay, { status: 200 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
