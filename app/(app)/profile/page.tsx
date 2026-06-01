import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import ProfileClient from "./ProfileClient"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Profile | Lasyly",
  robots: { index: false },
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // If no session found, show a sign-in prompt instead of redirecting
    // (the proxy already handles auth redirects — doing it here causes loops)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Sign in to view your profile</h1>
          <p className="text-[var(--color-text-muted)] text-sm mb-6">
            You need to be logged in to access your profile.
          </p>
          <a
            href="/login?redirect=/profile"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[var(--color-lime)] text-black font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Sign In
          </a>
        </div>
      </div>
    )
  }

  // Fetch profile and stats in parallel
  const [profileResult, followersResult, followingResult, betslipsResult, parlaysResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, favourite_sports, country, account_type, is_verified, created_at")
      .eq("id", user.id)
      .single(),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", user.id),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", user.id),
    supabase
      .from("betslips")
      .select("status, odds")
      .eq("user_id", user.id),
    supabase
      .from("parlays")
      .select("status, odds")
      .eq("user_id", user.id)
      .eq("is_logged", false),
  ])

  const profile = profileResult.data
  if (!profile) {
    redirect("/onboarding")
  }

  const followerCount = followersResult.count ?? 0
  const followingCount = followingResult.count ?? 0

  // Compute betting stats (betslips + parlays, excluding logged parlays)
  const betslips = betslipsResult.data ?? []
  const parlays = parlaysResult.data ?? []

  // Betslip stats (legacy room-based bets)
  const bsTotal = betslips.length
  const bsResolved = betslips.filter((b) => b.status === "Won" || b.status === "Lost" || b.status === "Void")
  const bsWon = betslips.filter((b) => b.status === "Won").length
  const bsLost = betslips.filter((b) => b.status === "Lost").length
  const bsPending = betslips.filter((b) => b.status === "Pending").length

  // Parlay stats (non-logged only)
  const pTotal = parlays.length
  const pWon = parlays.filter((p) => p.status === "won").length
  const pLost = parlays.filter((p) => p.status === "lost").length
  const pPending = parlays.filter((p) => p.status === "pending").length
  const pResolved = pWon + pLost

  // Combined totals
  const totalPicks = bsTotal + pTotal
  const wonCount = bsWon + pWon
  const lostCount = bsLost + pLost
  const pendingCount = bsPending + pPending
  const resolvedCount = bsResolved.length + pResolved

  const winRate = resolvedCount > 0 ? Math.round((wonCount / resolvedCount) * 1000) / 10 : 0

  // Average odds: combine betslips odds + parlay odds
  const bsOddsTotal = betslips.reduce((sum, b) => sum + Number(b.odds), 0)
  const pOddsTotal = parlays.filter((p) => p.odds != null).reduce((sum, p) => sum + Number(p.odds), 0)
  const oddsCount = bsTotal + parlays.filter((p) => p.odds != null).length
  const averageOdds = oddsCount > 0
    ? Math.round(((bsOddsTotal + pOddsTotal) / oddsCount) * 100) / 100
    : 0

  return (
    <ProfileClient
      profile={profile}
      stats={{
        followerCount,
        followingCount,
        totalPicks,
        winRate,
        averageOdds,
        wonCount,
        lostCount,
        pendingCount,
      }}
    />
  )
}
