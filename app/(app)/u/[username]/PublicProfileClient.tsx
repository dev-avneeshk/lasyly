"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  User,
  Trophy,
  Target,
  TrendingUp,
  Calendar,
  MapPin,
  BadgeCheck,
  UserPlus,
  UserMinus,
  Clock,
  Award,
} from "lucide-react"
import AchievementBadge from "@/components/achievements/AchievementBadge"
import { ACHIEVEMENTS, type AchievementKey } from "@/lib/achievements"

type Profile = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  favourite_sports: string[] | null
  country: string | null
  account_type: string | null
  is_verified: boolean
  created_at: string
}

type Stats = {
  followerCount: number
  followingCount: number
  totalPicks: number
  winRate: number
  averageOdds: number
  wonCount: number
  lostCount: number
}

type RecentParlay = {
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
}

type Props = {
  profile: Profile
  stats: Stats
  isFollowing: boolean
  isOwnProfile: boolean
  isAuthenticated: boolean
  recentParlays: RecentParlay[]
}

export default function PublicProfileClient({
  profile,
  stats,
  isFollowing: initialIsFollowing,
  isOwnProfile,
  isAuthenticated,
  recentParlays,
}: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followerCount, setFollowerCount] = useState(stats.followerCount)
  const [isLoading, setIsLoading] = useState(false)

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  const handleFollow = async () => {
    if (!isAuthenticated || isOwnProfile) return
    setIsLoading(true)

    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: profile.id }),
      })

      if (res.ok) {
        const data = await res.json()
        setIsFollowing(data.following)
        setFollowerCount(data.followerCount)
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 md:py-12">
      {/* Header card */}
      <div className="relative rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 backdrop-blur-sm overflow-hidden">
        {/* Gradient banner */}
        <div className="h-28 md:h-36 bg-gradient-to-br from-[var(--color-lime)]/20 via-[var(--color-lime)]/5 to-transparent" />

        {/* Avatar + name */}
        <div className="px-6 md:px-8 pb-6 -mt-14 md:-mt-16">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-[var(--color-surface)] bg-[var(--color-surface)] overflow-hidden shadow-lg">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[var(--color-lime)]/10">
                    <User className="w-10 h-10 text-[var(--color-lime)]" />
                  </div>
                )}
              </div>
              {profile.is_verified && (
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--color-lime)] flex items-center justify-center border-2 border-[var(--color-surface)]">
                  <BadgeCheck className="w-4 h-4 text-black" />
                </div>
              )}
            </div>

            {/* Name + username */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold text-white truncate">
                  {profile.display_name}
                </h1>
                {(profile.account_type === "tipster" || profile.account_type === "both") && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-lime)]/10 text-[var(--color-lime)] border border-[var(--color-lime)]/20">
                    Seller
                  </span>
                )}
              </div>
              <p className="text-[var(--color-text-muted)] text-sm mt-0.5">@{profile.username}</p>
            </div>

            {/* Follow button */}
            <div className="sm:ml-auto">
              {isOwnProfile ? (
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-sm font-medium text-white hover:border-[var(--color-lime)]/30 hover:bg-[var(--color-lime)]/5 transition-colors"
                >
                  Edit Profile
                </Link>
              ) : isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={isLoading}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isFollowing
                      ? "border border-white/10 text-white hover:border-[var(--color-danger)]/30 hover:bg-[var(--color-danger)]/5 hover:text-[var(--color-danger)]"
                      : "bg-[var(--color-lime)] text-black hover:opacity-90"
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="w-3.5 h-3.5" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      Follow
                    </>
                  )}
                </button>
              ) : (
                <Link
                  href={`/login?redirect=/u/${profile.username}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-lime)] text-black text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Follow
                </Link>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-4 text-sm text-white/80 leading-relaxed max-w-lg">
              {profile.bio}
            </p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Joined {memberSince}
            </span>
            {profile.country && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {profile.country}
              </span>
            )}
          </div>

          {/* Follower counts */}
          <div className="flex gap-5 mt-4">
            <span className="text-sm">
              <span className="font-bold text-white">{followerCount}</span>{" "}
              <span className="text-[var(--color-text-muted)]">followers</span>
            </span>
            <span className="text-sm">
              <span className="font-bold text-white">{stats.followingCount}</span>{" "}
              <span className="text-[var(--color-text-muted)]">following</span>
            </span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Target className="w-4 h-4 text-[var(--color-lime)]" />}
          label="Total Picks"
          value={stats.totalPicks.toString()}
        />
        <StatCard
          icon={<Trophy className="w-4 h-4 text-[var(--color-success)]" />}
          label="Win Rate"
          value={`${stats.winRate}%`}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
          label="Avg Odds"
          value={stats.averageOdds > 0 ? stats.averageOdds.toFixed(2) : "—"}
        />
        <StatCard
          icon={<Trophy className="w-4 h-4 text-purple-400" />}
          label="Record"
          value={`${stats.wonCount}W-${stats.lostCount}L`}
        />
      </div>

      {/* Sports tags */}
      {profile.favourite_sports && profile.favourite_sports.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Favourite Sports
          </h3>
          <div className="flex flex-wrap gap-2">
            {profile.favourite_sports.map((sport) => (
              <span
                key={sport}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/80"
              >
                {sport}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      <AchievementsSection profileId={profile.id} />

      {/* Recent Parlays */}
      {recentParlays.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
            Recent Parlays
          </h3>
          <div className="space-y-3">
            {recentParlays.map((parlay) => (
              <div
                key={parlay.id}
                className="rounded-xl border border-white/5 bg-black/20 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      {parlay.legs.length} Leg Parlay
                    </span>
                    {parlay.odds && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        @ {parlay.odds > 0 ? `+${parlay.odds}` : parlay.odds}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                      parlay.status === "won"
                        ? "bg-lime-500/20 text-lime-400 border-lime-500/30"
                        : parlay.status === "lost"
                        ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {parlay.status}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {parlay.legs.slice(0, 3).map((leg) => (
                    <div key={leg.id} className="flex items-center justify-between text-xs">
                      <span className="text-white/70">
                        {leg.player_name} — {leg.direction === "over" ? "O" : "U"} {leg.prop_line} {leg.stat_category}
                      </span>
                      {leg.l10_hit_rate != null && (
                        <span className="text-[var(--color-text-muted)]">{leg.l10_hit_rate}%</span>
                      )}
                    </div>
                  ))}
                  {parlay.legs.length > 3 && (
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      +{parlay.legs.length - 3} more legs
                    </p>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(parlay.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-lg font-bold text-white">{value}</span>
    </div>
  )
}

/** Achievements section — fetches and displays user badges */
function AchievementsSection({ profileId }: { profileId: string }) {
  type UserAchievement = {
    id: string
    achievement_key: string
    unlocked_at: string
  }

  const [achievements, setAchievements] = useState<UserAchievement[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        const { data, error } = await supabase
          .from("user_achievements")
          .select("id, achievement_key, unlocked_at")
          .eq("user_id", profileId)
          .order("unlocked_at", { ascending: false })

        if (!cancelled && !error && data) {
          setAchievements(data)
        }
      } catch {
        // Table might not exist — silently fail
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [profileId])

  if (!loaded || achievements.length === 0) return null

  // Filter to only valid achievement keys
  const validAchievements = achievements.filter(
    (a) => a.achievement_key in ACHIEVEMENTS
  )

  if (validAchievements.length === 0) return null

  return (
    <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
      <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Award className="w-3.5 h-3.5" />
        Achievements
      </h3>
      <div className="flex flex-wrap gap-2">
        {validAchievements.map((a) => (
          <AchievementBadge
            key={a.id}
            achievementKey={a.achievement_key as AchievementKey}
            unlockedAt={a.unlocked_at}
          />
        ))}
      </div>
    </div>
  )
}
