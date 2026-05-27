import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// ─── GET /api/parlays/feed ───────────────────────────────────────────────────

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

  // Parse query params
  const url = new URL(request.url)
  const limitParam = url.searchParams.get("limit")
  const cursorParam = url.searchParams.get("cursor")

  // Check for injection patterns
  const injectionCheck = checkQueryParams({ limit: limitParam, cursor: cursorParam })
  if (injectionCheck) return injectionCheck

  // Validate limit (1–50, default 20)
  let limit = 20
  if (limitParam) {
    const parsed = parseInt(limitParam, 10)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
      limit = parsed
    }
  }

  // Validate cursor (must be a valid UUID if provided)
  let cursorCreatedAt: string | null = null
  if (cursorParam) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursorParam)
    if (!isUuid) {
      return NextResponse.json(
        { error: "Invalid cursor format." },
        { status: 400 }
      )
    }

    // Look up the cursor parlay's created_at for comparison
    const { data: cursorParlay, error: cursorError } = await supabase
      .from("parlays")
      .select("created_at")
      .eq("id", cursorParam)
      .maybeSingle()

    if (cursorError) {
      return NextResponse.json(
        { error: "Failed to resolve cursor." },
        { status: 500 }
      )
    }

    if (cursorParlay) {
      cursorCreatedAt = cursorParlay.created_at
    }
    // If cursor parlay not found, we just return from the beginning
  }

  // Query public parlays ordered by created_at DESC
  let query = supabase
    .from("parlays")
    .select("*")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit)

  // Apply cursor filter if we have a reference timestamp
  if (cursorCreatedAt) {
    query = query.lt("created_at", cursorCreatedAt)
  }

  const { data: parlays, error: parlaysError } = await query

  if (parlaysError) {
    return NextResponse.json(
      { error: "Failed to fetch feed." },
      { status: 500 }
    )
  }

  if (!parlays || parlays.length === 0) {
    return NextResponse.json({ parlays: [], nextCursor: null })
  }

  // Fetch legs for all parlays in one query
  const parlayIds = parlays.map((p: { id: string }) => p.id)
  const { data: allLegs, error: legsError } = await supabase
    .from("parlay_legs")
    .select("*")
    .in("parlay_id", parlayIds)
    .order("leg_order", { ascending: true })

  if (legsError) {
    return NextResponse.json(
      { error: "Failed to fetch feed." },
      { status: 500 }
    )
  }

  // Fetch user profile data for all parlay owners
  const userIds = Array.from(new Set(parlays.map((p: { user_id: string }) => p.user_id)))
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, is_verified")
    .in("id", userIds)

  if (profilesError) {
    return NextResponse.json(
      { error: "Failed to fetch feed." },
      { status: 500 }
    )
  }

  // Build profile lookup map
  const profileMap = new Map<string, { display_name: string; username: string; avatar_url: string; is_verified: boolean }>()
  if (profiles) {
    for (const profile of profiles) {
      profileMap.set(profile.id, {
        display_name: profile.display_name,
        username: profile.username,
        avatar_url: profile.avatar_url,
        is_verified: profile.is_verified,
      })
    }
  }

  // Build legs lookup map
  const legsMap = new Map<string, typeof allLegs>()
  if (allLegs) {
    for (const leg of allLegs) {
      const existing = legsMap.get(leg.parlay_id) || []
      existing.push(leg)
      legsMap.set(leg.parlay_id, existing)
    }
  }

  // Assemble full parlay objects with legs and user data
  const parlaysWithLegs = parlays.map((parlay: { id: string; user_id: string }) => ({
    ...parlay,
    legs: legsMap.get(parlay.id) || [],
    user: profileMap.get(parlay.user_id) || null,
  }))

  // Determine nextCursor
  const nextCursor = parlays.length === limit
    ? parlays[parlays.length - 1].id
    : null

  return NextResponse.json({ parlays: parlaysWithLegs, nextCursor })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })
