import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached, invalidateCache } from "@/lib/cache"
import { withSecurity, validateRequestBody, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// ─── Schemas ─────────────────────────────────────────────────────────────────

const voteSchema = z.object({
  propIdentifier: z.string().min(1).max(200),
  direction: z.enum(["over", "under"]),
})

// ─── Cache TTL for vote totals (10 seconds) ──────────────────────────────────

const VOTE_CACHE_TTL = 10_000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0]
}

function getVoteCacheKey(propIdentifier: string, voteDate: string): string {
  return `votes:${propIdentifier}:${voteDate}`
}

// ─── GET /api/props/votes ────────────────────────────────────────────────────

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const propId = searchParams.get("propId")

  if (!propId) {
    return NextResponse.json(
      { error: "propId query parameter is required." },
      { status: 400 }
    )
  }

  // Check for injection patterns
  const injectionCheck = checkQueryParams({ propId })
  if (injectionCheck) return injectionCheck

  const today = getTodayUTC()
  const cacheKey = getVoteCacheKey(propId, today)

  // Get vote totals with 10s cache
  const totals = await cached(cacheKey, async () => {
    const supabase = createAdminClient()

    const { data: votes, error } = await supabase
      .from("prop_votes")
      .select("direction")
      .eq("prop_identifier", propId)
      .eq("vote_date", today)

    if (error) {
      console.error("Error fetching vote totals:", error)
      return { over: 0, under: 0, total: 0 }
    }

    const over = votes.filter((v: { direction: string }) => v.direction === "over").length
    const under = votes.filter((v: { direction: string }) => v.direction === "under").length

    return { over, under, total: over + under }
  }, VOTE_CACHE_TTL)

  // Check if the current user has voted (not cached, user-specific)
  let userVote: "over" | "under" | null = null

  try {
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()

    if (user) {
      const adminClient = createAdminClient()
      const { data: existingVote } = await adminClient
        .from("prop_votes")
        .select("direction")
        .eq("user_id", user.id)
        .eq("prop_identifier", propId)
        .eq("vote_date", today)
        .maybeSingle()

      if (existingVote) {
        userVote = existingVote.direction as "over" | "under"
      }
    }
  } catch {
    // User not authenticated — userVote stays null
  }

  return NextResponse.json({
    over: totals.over,
    under: totals.under,
    total: totals.total,
    userVote,
  })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })

// ─── POST /api/props/votes ───────────────────────────────────────────────────

export const POST = withSecurity(async (request: Request) => {
  // Authenticate user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to vote." },
      { status: 401 }
    )
  }

  // Parse and validate body
  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, voteSchema)
  if (validationError) return validationError

  const today = getTodayUTC()
  const adminClient = createAdminClient()

  // Upsert vote: the UNIQUE constraint on (user_id, prop_identifier, vote_date)
  // ensures one vote per user per prop per UTC day.
  // We use upsert with onConflict to handle switching direction.
  const { error: upsertError } = await adminClient
    .from("prop_votes")
    .upsert(
      {
        user_id: user.id,
        prop_identifier: data.propIdentifier,
        direction: data.direction,
        vote_date: today,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,prop_identifier,vote_date",
      }
    )

  if (upsertError) {
    console.error("Error upserting vote:", upsertError)
    return NextResponse.json(
      { error: "Failed to submit vote." },
      { status: 500 }
    )
  }

  // Invalidate the cached totals for this prop
  const cacheKey = getVoteCacheKey(data.propIdentifier, today)
  invalidateCache(cacheKey)

  // Fetch updated totals
  const { data: votes, error: fetchError } = await adminClient
    .from("prop_votes")
    .select("direction")
    .eq("prop_identifier", data.propIdentifier)
    .eq("vote_date", today)

  if (fetchError) {
    console.error("Error fetching updated totals:", fetchError)
    return NextResponse.json(
      { success: true, totals: { over: 0, under: 0 } }
    )
  }

  const over = votes.filter((v: { direction: string }) => v.direction === "over").length
  const under = votes.filter((v: { direction: string }) => v.direction === "under").length

  return NextResponse.json({
    success: true,
    totals: { over, under },
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
