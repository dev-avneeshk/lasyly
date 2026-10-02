import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached, CACHE_TTL } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { fetchPagedParallel } from "@/lib/supabase/paged"

export interface LeaderboardEntry {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_verified: boolean
  total_picks: number
  won_count: number
  win_rate: number
  average_odds: number
}

export const GET = withSecurity(async (request: Request) => {
  const url = new URL(request.url)
  // Enum, so arbitrary values can't mint cache keys.
  const sortBy = url.searchParams.get("sort") === "total_picks" ? "total_picks" : "win_rate"

  const result = await cached(`leaderboard:${sortBy}`, async () => {
    const supabase = createAdminClient()

    // Every won/lost/pending parlay, paged in id order: one unordered select
    // stopped at PostgREST's 1000-row cap and ranked users on a partial set.
    const parlaysQuery = () => supabase.from("parlays")
    let parlays: { user_id: string; status: string; odds: number | null }[]
    try {
      parlays = await fetchPagedParallel(
        async () =>
          (await parlaysQuery().select("id", { count: "exact", head: true }).in("status", ["won", "lost", "pending"])).count,
        async (from, to) => {
          const { data, error } = await parlaysQuery()
            .select("user_id, status, odds")
            .in("status", ["won", "lost", "pending"])
            .order("id")
            .range(from, to)
          if (error) throw error
          return data ?? []
        }
      )
    } catch (error) {
      const e = error as { code?: string; message?: string }
      if (e.code === "42P01" || e.message?.includes("relation")) {
        return { leaderboard: [] as LeaderboardEntry[] }
      }
      throw new Error("Failed to fetch leaderboard data.")
    }

    if (parlays.length === 0) {
      return { leaderboard: [] as LeaderboardEntry[] }
    }

    // Aggregate stats by user
    const userStats = new Map<string, { total: number; won: number; totalOdds: number; totalPicks: number }>()

    for (const parlay of parlays) {
      if (!parlay.user_id) continue
      const existing = userStats.get(parlay.user_id) || { total: 0, won: 0, totalOdds: 0, totalPicks: 0 }

      existing.totalPicks += 1
      if (parlay.status === "won" || parlay.status === "lost") {
        existing.total += 1
        if (parlay.status === "won") existing.won += 1
      }
      existing.totalOdds += Number(parlay.odds) || 0
      userStats.set(parlay.user_id, existing)
    }

    // Filter users with minimum 10 resolved picks
    const qualifiedUserIds = Array.from(userStats.entries())
      .filter(([, s]) => s.total >= 10)
      .map(([userId]) => userId)

    if (qualifiedUserIds.length === 0) {
      return { leaderboard: [] as LeaderboardEntry[] }
    }

    // Fetch profiles for qualified users
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_verified")
      .in("id", qualifiedUserIds)

    if (profilesError || !profiles) {
      throw new Error("Failed to fetch profile data.")
    }

    // Build leaderboard entries
    const leaderboard: LeaderboardEntry[] = profiles
      .map((p) => {
        const s = userStats.get(p.id)!
        return {
          user_id: p.id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          is_verified: p.is_verified,
          total_picks: s.totalPicks,
          won_count: s.won,
          win_rate: s.total > 0 ? Math.round((s.won / s.total) * 1000) / 10 : 0,
          average_odds: s.totalPicks > 0
            ? Math.round((s.totalOdds / s.totalPicks) * 100) / 100
            : 0,
        }
      })

    // Sort based on query param
    if (sortBy === "total_picks") {
      leaderboard.sort((a, b) => b.total_picks - a.total_picks)
    } else {
      leaderboard.sort((a, b) => b.win_rate - a.win_rate)
    }

    return { leaderboard: leaderboard.slice(0, 50) }
  }, CACHE_TTL.leaderboard)

  return NextResponse.json(result)
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })
