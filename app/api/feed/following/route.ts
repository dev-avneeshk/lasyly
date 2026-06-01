import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/** GET /api/feed/following — fetch public parlays from users the current user follows */
export const GET = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ parlays: [], hasMore: false })
  }

  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 20)
  const cursor = url.searchParams.get("cursor") // ISO date string for pagination

  try {
    // Get list of users the current user follows
    const { data: follows, error: followsError } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)

    if (followsError || !follows || follows.length === 0) {
      return NextResponse.json({ parlays: [], hasMore: false })
    }

    const followingIds = follows.map((f) => f.following_id)

    // Query parlays from followed users
    let query = supabase
      .from("parlays")
      .select(`
        id,
        status,
        odds,
        visibility,
        created_at,
        user_id,
        legs:parlay_legs(
          id,
          player_name,
          stat_category,
          prop_line,
          direction,
          l10_hit_rate
        )
      `)
      .in("user_id", followingIds)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(limit + 1)

    if (cursor) {
      query = query.lt("created_at", cursor)
    }

    const { data: parlays, error: parlaysError } = await query

    if (parlaysError) {
      // Table might not exist yet — gracefully return empty
      if (parlaysError.code === "42P01" || parlaysError.message?.includes("relation")) {
        return NextResponse.json({ parlays: [], hasMore: false })
      }
      return NextResponse.json({ parlays: [], hasMore: false })
    }

    if (!parlays || parlays.length === 0) {
      return NextResponse.json({ parlays: [], hasMore: false })
    }

    const hasMore = parlays.length > limit
    const results = hasMore ? parlays.slice(0, limit) : parlays

    // Fetch profile data for the parlay authors
    const userIds = [...new Set(results.map((p) => p.user_id))]
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", userIds)

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    )

    const enrichedParlays = results.map((parlay) => ({
      ...parlay,
      profile: profileMap.get(parlay.user_id) ?? null,
    }))

    return NextResponse.json({
      parlays: enrichedParlays,
      hasMore,
      nextCursor: hasMore ? results[results.length - 1].created_at : null,
    })
  } catch {
    // Gracefully handle any errors (missing tables, etc.)
    return NextResponse.json({ parlays: [], hasMore: false })
  }
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })
