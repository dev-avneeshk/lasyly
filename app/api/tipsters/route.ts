import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached, CACHE_TTL } from "@/lib/cache"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

type TipsterProfile = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  favourite_sports: string[] | null
  is_verified: boolean
  account_type: string
  win_rate: number
  total_picks: number
  follower_count: number
}

export const GET = withSecurity(async (request: Request) => {
  const url = new URL(request.url)
  const sort = url.searchParams.get("sort") || "followers"
  const sport = url.searchParams.get("sport") || null

  // Check for injection patterns
  const injectionCheck = checkQueryParams({ sort, sport })
  if (injectionCheck) return injectionCheck

  const result = await cached(`tipsters:${sort}:${sport ?? "all"}`, async () => {
    const supabase = createAdminClient()

    // Fetch tipster profiles
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, favourite_sports, is_verified, account_type")
      .in("account_type", ["tipster", "both"])

    if (profilesErr) {
      throw new Error("Failed to fetch tipsters.")
    }

    if (!profiles || profiles.length === 0) {
      return { tipsters: [] as TipsterProfile[] }
    }

    const tipsterIds = profiles.map((p) => p.id)

    // Fetch betslip stats for each tipster
    const { data: betslips } = await supabase
      .from("betslips")
      .select("user_id, status")
      .in("user_id", tipsterIds)

    // Fetch follower counts
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .in("following_id", tipsterIds)

    // Aggregate stats
    const statsMap = new Map<string, { total: number; won: number }>()
    for (const bet of betslips ?? []) {
      const existing = statsMap.get(bet.user_id) ?? { total: 0, won: 0 }
      existing.total++
      if (bet.status === "won") existing.won++
      statsMap.set(bet.user_id, existing)
    }

    const followerMap = new Map<string, number>()
    for (const follow of follows ?? []) {
      followerMap.set(follow.following_id, (followerMap.get(follow.following_id) ?? 0) + 1)
    }

    // Build tipster list
    let tipsters: TipsterProfile[] = profiles.map((p) => {
      const stats = statsMap.get(p.id) ?? { total: 0, won: 0 }
      const winRate = stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        bio: p.bio,
        favourite_sports: p.favourite_sports,
        is_verified: p.is_verified,
        account_type: p.account_type,
        win_rate: winRate,
        total_picks: stats.total,
        follower_count: followerMap.get(p.id) ?? 0,
      }
    })

    // Filter by sport
    if (sport) {
      tipsters = tipsters.filter(
        (t) => t.favourite_sports?.some((s) => s.toLowerCase() === sport.toLowerCase())
      )
    }

    // Sort
    switch (sort) {
      case "win_rate":
        tipsters.sort((a, b) => b.win_rate - a.win_rate)
        break
      case "total_picks":
        tipsters.sort((a, b) => b.total_picks - a.total_picks)
        break
      case "followers":
      default:
        tipsters.sort((a, b) => b.follower_count - a.follower_count)
        break
    }

    return { tipsters }
  }, CACHE_TTL.tipsters)

  return NextResponse.json(result)
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })
