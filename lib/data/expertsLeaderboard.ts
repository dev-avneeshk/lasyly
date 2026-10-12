import { createAdminClient } from "@/lib/supabase/admin"
import { cached, CACHE_TTL } from "@/lib/cache"
import { fetchAllIn } from "@/lib/supabase/paged"

/**
 * Per-category Experts leaderboard.
 *
 * Odds-free ranking: win % (hit rate over graded betslips), with Wins/Settled
 * and a Net = wins - settled losses column. Category bucketing uses
 * profiles.favourite_sports (declared interest), consistent with the tipster
 * grid in app/(app)/marketplace/TipstersClient.tsx.
 */

export interface ExpertsLeaderboardEntry {
  rank: number
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_verified: boolean
  win_pct: number
  wins: number
  settled: number
  net: number
}

/** Minimum graded slips a predictor needs before they can be ranked. */
export const MIN_SETTLED = 1

type LeaderboardProfile = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_verified: boolean
  favourite_sports: string[] | null
}

type LeaderboardBetslip = {
  user_id: string
  status: string
}

const TOP_N = 50

/**
 * Pure aggregation + ranking. Statuses are stored title-cased ("Won"/"Lost")
 * exactly like app/api/tipsters/route.ts, so lowercase variants do NOT count.
 * The rate is over graded slips only (not Pending/Void/Partial).
 */
export function rankExpertsLeaderboard(
  profiles: LeaderboardProfile[],
  betslips: LeaderboardBetslip[],
  category: string
): ExpertsLeaderboardEntry[] {
  if (profiles.length === 0) return []

  // Aggregate graded slips per user.
  const statsMap = new Map<string, { wins: number; losses: number }>()
  for (const bet of betslips) {
    const existing = statsMap.get(bet.user_id) ?? { wins: 0, losses: 0 }
    if (bet.status === "Won") existing.wins++
    else if (bet.status === "Lost") existing.losses++
    statsMap.set(bet.user_id, existing)
  }

  const isAll = category === "All"
  const categoryLower = category.toLowerCase()

  const entries: Omit<ExpertsLeaderboardEntry, "rank">[] = []
  for (const profile of profiles) {
    const stats = statsMap.get(profile.id) ?? { wins: 0, losses: 0 }
    const settled = stats.wins + stats.losses
    if (settled < MIN_SETTLED) continue

    const inCategory =
      isAll ||
      (profile.favourite_sports?.some((s) => s.toLowerCase() === categoryLower) ?? false)
    if (!inCategory) continue

    const winPct = settled > 0 ? Math.round((stats.wins / settled) * 100) : 0

    entries.push({
      user_id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      is_verified: profile.is_verified,
      win_pct: winPct,
      wins: stats.wins,
      settled,
      net: stats.wins - stats.losses,
    })
  }

  // Sort by win_pct desc, tie-break settled desc, then wins desc, then display_name asc.
  entries.sort((a, b) => {
    if (b.win_pct !== a.win_pct) return b.win_pct - a.win_pct
    if (b.settled !== a.settled) return b.settled - a.settled
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.display_name.localeCompare(b.display_name)
  })

  return entries.slice(0, TOP_N).map((entry, index) => ({ rank: index + 1, ...entry }))
}

/**
 * Cache-aside wrapper. Key is experts-leaderboard:<category>, 60s TTL, with the
 * in-memory fallback already provided by lib/cache.ts.
 */
export function getExpertsLeaderboard(category: string): Promise<ExpertsLeaderboardEntry[]> {
  return cached(
    `experts-leaderboard:${category}`,
    async () => {
      const supabase = createAdminClient()

      const { data: profiles, error: profilesErr } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_verified, favourite_sports")
        .in("account_type", ["tipster", "both"])

      if (profilesErr) {
        throw new Error("Failed to fetch experts leaderboard.")
      }

      if (!profiles || profiles.length === 0) {
        return [] as ExpertsLeaderboardEntry[]
      }

      const tipsterIds = profiles.map((p) => p.id)

      const betslips = await fetchAllIn<LeaderboardBetslip>(
        supabase,
        "betslips",
        "user_id, status",
        "user_id",
        tipsterIds
      )

      return rankExpertsLeaderboard(profiles as LeaderboardProfile[], betslips, category)
    },
    CACHE_TTL.expertsLeaderboard
  )
}
