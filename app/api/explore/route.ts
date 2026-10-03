import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached, CACHE_TTL } from "@/lib/cache"
import { fetchAllIn } from "@/lib/supabase/paged"
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
      // Three batched reads for all tipsters (was 2 queries per tipster, and the
      // 10 ranked were an arbitrary 10, picked before sorting by followers).
      const [{ data: profiles }, follows, betslips] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", tipsterIds),
        fetchAllIn<{ following_id: string }>(supabase, "follows", "following_id", "following_id", tipsterIds),
        fetchAllIn<{ user_id: string; status: string }>(supabase, "betslips", "user_id, status", "user_id", tipsterIds),
      ])
      const followers = new Map<string, number>()
      for (const f of follows) followers.set(f.following_id, (followers.get(f.following_id) ?? 0) + 1)
      const record = new Map<string, { won: number; graded: number }>()
      for (const b of betslips) {
        // Void is a refund, not a loss: win rate is over Won + Lost only.
        if (b.status !== "Won" && b.status !== "Lost") continue
        const r = record.get(b.user_id) ?? { won: 0, graded: 0 }
        r.graded++
        if (b.status === "Won") r.won++
        record.set(b.user_id, r)
      }
      topTipsters = (profiles ?? [])
        .map((profile) => {
          const r = record.get(profile.id)
          return {
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            follower_count: followers.get(profile.id) ?? 0,
            win_rate: r ? Math.round((r.won / r.graded) * 1000) / 10 : 0,
          }
        })
        .sort((a, b) => b.follower_count - a.follower_count)
        .slice(0, 10)
    }
    return { trending_rooms: trendingRooms, top_tipsters: topTipsters }
  }, CACHE_TTL.explore)

  return NextResponse.json(result)
}, { cacheControl: CACHE_CONTROL.PUBLIC_LONG })
