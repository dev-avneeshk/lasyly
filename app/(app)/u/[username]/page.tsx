import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import PublicProfileClient from "./PublicProfileClient"
import type { Metadata } from "next"

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  return {
    title: `@${username} | Lasyly`,
    description: `View ${username}'s betting profile, stats, and picks on Lasyly.`,
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params
  const supabase = await createClient()

  // Fetch profile by username
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, favourite_sports, country, account_type, is_verified, created_at")
    .eq("username", username)
    .maybeSingle()

  if (profileError || !profile) {
    notFound()
  }

  // Fetch stats in parallel
  const [followersResult, followingResult, betslipsResult] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    supabase
      .from("betslips")
      .select("status, odds")
      .eq("user_id", profile.id),
  ])

  const followerCount = followersResult.count ?? 0
  const followingCount = followingResult.count ?? 0

  // Compute betting stats
  const betslips = betslipsResult.data ?? []
  const totalPicks = betslips.length
  const resolved = betslips.filter((b) => b.status === "Won" || b.status === "Lost" || b.status === "Void")
  const wonCount = betslips.filter((b) => b.status === "Won").length
  const lostCount = betslips.filter((b) => b.status === "Lost").length
  const winRate = resolved.length > 0 ? Math.round((wonCount / resolved.length) * 1000) / 10 : 0
  const averageOdds = totalPicks > 0
    ? Math.round((betslips.reduce((sum, b) => sum + Number(b.odds), 0) / totalPicks) * 100) / 100
    : 0

  // Check if current user is following this profile
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  let isFollowing = false
  if (currentUser && currentUser.id !== profile.id) {
    const { data: followRecord } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", currentUser.id)
      .eq("following_id", profile.id)
      .maybeSingle()
    isFollowing = !!followRecord
  }

  // Try to fetch recent public parlays (gracefully handle if table doesn't exist)
  let recentParlays: Array<{
    id: string
    status: string
    odds: number | null
    created_at: string
    legs: Array<{
      id: string
      player_name: string
      stat_category: string
      prop_line: number
      direction: string
      l10_hit_rate: number | null
    }>
  }> = []

  try {
    const { data: parlayData } = await supabase
      .from("parlays")
      .select("id, status, odds, created_at, parlay_legs(id, player_name, stat_category, prop_line, direction, l10_hit_rate)")
      .eq("user_id", profile.id)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(5)

    if (parlayData) {
      recentParlays = parlayData.map((p) => ({
        id: p.id,
        status: p.status,
        odds: p.odds,
        created_at: p.created_at,
        legs: (p.parlay_legs as Array<{
          id: string
          player_name: string
          stat_category: string
          prop_line: number
          direction: string
          l10_hit_rate: number | null
        }>) ?? [],
      }))
    }
  } catch {
    // parlays table may not exist yet — gracefully return empty
  }

  return (
    <PublicProfileClient
      profile={profile}
      stats={{
        followerCount,
        followingCount,
        totalPicks,
        winRate,
        averageOdds,
        wonCount,
        lostCount,
      }}
      isFollowing={isFollowing}
      isOwnProfile={currentUser?.id === profile.id}
      isAuthenticated={!!currentUser}
      recentParlays={recentParlays}
    />
  )
}
