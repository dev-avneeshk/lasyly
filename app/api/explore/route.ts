import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached, CACHE_TTL } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

export const GET = withSecurity(async () => {
  const supabase = createAdminClient()

  const result = await cached("explore:all", async () => {
    // 1. Trending rooms: top 20 by member_count
    const { data: rooms, error: roomErr } = await supabase
      .from("rooms")
      .select("id, name, description, type, sport_tag, member_count, is_live, created_at")
      .in("type", ["Public", "Tipster"])
      .order("member_count", { ascending: false })
      .limit(20)

    if (roomErr) throw new Error("Room service unavailable")

    const trendingRooms = (rooms ?? []).map((room) => ({
      ...room,
      trend: 0,
    }))

    // 2. Top tipsters
    const { data: tipsterRooms } = await supabase
      .from("rooms")
      .select("creator_id")
      .eq("type", "Tipster")

    const tipsterIds = [...new Set((tipsterRooms ?? []).map((r) => r.creator_id))]

    let topTipsters: Array<{
      id: string
      username: string | null
      display_name: string | null
      avatar_url: string | null
      follower_count: number
      win_rate: number
    }> = []

    if (tipsterIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", tipsterIds)
        .limit(10)

      const tipsterData = await Promise.all(
        (profiles ?? []).slice(0, 10).map(async (profile) => {
          const [{ count: followerCount }, { data: betslips }] = await Promise.all([
            supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
            supabase.from("betslips").select("status").eq("user_id", profile.id).limit(100),
          ])

          const all = betslips ?? []
          const resolved = all.filter((b) => b.status === "Won" || b.status === "Lost" || b.status === "Void")
          const won = all.filter((b) => b.status === "Won").length
          const winRate = resolved.length > 0 ? Math.round((won / resolved.length) * 1000) / 10 : 0

          return {
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            follower_count: followerCount ?? 0,
            win_rate: winRate,
          }
        })
      )

      topTipsters = tipsterData.sort((a, b) => b.follower_count - a.follower_count)
    }

    return { trending_rooms: trendingRooms, top_tipsters: topTipsters }
  }, CACHE_TTL.explore)

  return NextResponse.json(result)
}, { cacheControl: CACHE_CONTROL.PUBLIC_LONG })
