import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchAllIn } from "@/lib/supabase/paged"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { rejectInjectionPatterns } from "@/lib/security/inputValidator"

export const GET = withSecurity(async (
  _request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { identifier } = await context!.params
  const supabase = await createClient()

  // Check identifier for injection patterns
  if (rejectInjectionPatterns(identifier)) {
    return NextResponse.json(
      { error: "The request was rejected due to invalid content." },
      { status: 400 }
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Try to find profile by id first, then by username
  let profile = null
  let profileError = null

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)

  if (isUuid) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, favourite_sports, country, is_verified, created_at")
      .eq("id", identifier)
      .maybeSingle()

    profile = data
    profileError = error
  } else {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, favourite_sports, country, is_verified, created_at")
      .eq("username", identifier)
      .maybeSingle()

    profile = data
    profileError = error
  }

  if (profileError) {
    return NextResponse.json({ error: "Failed to fetch profile." }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found." },
      { status: 404 }
    )
  }

  // Compute follower_count and following_count
  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
  ])

  // Compute betting statistics
  // Paged: a plain select stopped at 1000 rows, so heavy users got wrong stats.
  // A failed stats read returns empty stats, not a 500 (this route isn't cached).
  const allBetslips = await fetchAllIn<{ status: string; odds: number }>(supabase, "betslips", "status, odds", "user_id", [profile.id])
    .catch((e) => (console.error("profile stats read failed:", e?.message ?? e), []))
  const totalPicks = allBetslips.length
  // Void is a refund, not a loss: win rate is over Won + Lost only.
  const resolvedBetslips = allBetslips.filter((b) => b.status === "Won" || b.status === "Lost")
  const wonCount = allBetslips.filter((b) => b.status === "Won").length

  let winRate = 0
  let averageOdds = 0

  if (resolvedBetslips.length > 0) {
    winRate = Math.round((wonCount / resolvedBetslips.length) * 1000) / 10
  }

  if (totalPicks > 0) {
    const totalOdds = allBetslips.reduce((sum, b) => sum + Number(b.odds), 0)
    averageOdds = Math.round((totalOdds / totalPicks) * 100) / 100
  }

  const response: Record<string, unknown> = {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    favourite_sports: profile.favourite_sports,
    country: profile.country,
    is_verified: profile.is_verified,
    created_at: profile.created_at,
    follower_count: followerCount ?? 0,
    following_count: followingCount ?? 0,
    stats: {
      total_picks: totalPicks,
      win_rate: winRate,
      average_odds: averageOdds,
    },
  }

  // Include is_following for authenticated users viewing another profile
  if (user && user.id !== profile.id) {
    const { data: followRecord } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .maybeSingle()

    response.is_following = !!followRecord
  }

  return NextResponse.json(response)
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
