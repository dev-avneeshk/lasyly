"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Trophy, Target, Flame, BadgeCheck, User, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

type LeaderboardEntry = {
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

type Tab = "win_rate" | "total_picks" | "streak"

export default function LeaderboardClient() {
  const [activeTab, setActiveTab] = useState<Tab>("win_rate")
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true)
      try {
        const sortParam = activeTab === "streak" ? "win_rate" : activeTab
        const res = await fetch(`/api/leaderboard?sort=${sortParam}`)
        if (res.ok) {
          const data = await res.json()
          setLeaderboard(data.leaderboard ?? [])
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeaderboard()
  }, [activeTab])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "win_rate", label: "Win Rate", icon: <Trophy className="w-4 h-4" /> },
    { id: "total_picks", label: "Total Picks", icon: <Target className="w-4 h-4" /> },
    { id: "streak", label: "Streak", icon: <Flame className="w-4 h-4" /> },
  ]

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
          <Trophy className="w-7 h-7 text-[var(--color-lime)]" />
          Leaderboard
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          Top bettors ranked by performance. Minimum 10 resolved picks to qualify.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-surface)]/60 border border-[var(--color-border)] mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-[var(--color-lime)]/10 text-[var(--color-lime)] border border-[var(--color-lime)]/20"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/20"
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Streak placeholder */}
      {activeTab === "streak" && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-8 text-center mb-6">
          <Flame className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">Streak Tracking Coming Soon</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            We&apos;re building streak tracking to highlight the hottest bettors. Stay tuned.
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-white/10" />
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-white/10 rounded" />
                  <div className="h-3 w-20 bg-white/10 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard list */}
      {!isLoading && activeTab !== "streak" && (
        <div className="space-y-2">
          {leaderboard.length === 0 ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-8 text-center">
              <Target className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">No Qualified Users Yet</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Users need at least 10 resolved picks to appear on the leaderboard.
              </p>
            </div>
          ) : (
            leaderboard.map((entry, index) => (
              <Link
                key={entry.user_id}
                href={`/u/${entry.username}`}
                className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 hover:border-[var(--color-lime)]/20 hover:bg-[var(--color-lime)]/5 transition-all group"
              >
                {/* Rank */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  index === 0 ? "bg-yellow-500/20 text-yellow-400" :
                  index === 1 ? "bg-zinc-300/20 text-zinc-300" :
                  index === 2 ? "bg-amber-700/20 text-amber-600" :
                  "bg-white/5 text-[var(--color-text-muted)]"
                )}>
                  {index + 1}
                </div>

                {/* Avatar */}
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] shrink-0">
                  {entry.avatar_url ? (
                    <Image
                      src={entry.avatar_url}
                      alt={entry.display_name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[var(--color-lime)]/10">
                      <User className="w-5 h-5 text-[var(--color-lime)]" />
                    </div>
                  )}
                  {entry.is_verified && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--color-lime)] flex items-center justify-center">
                      <BadgeCheck className="w-2.5 h-2.5 text-black" />
                    </div>
                  )}
                </div>

                {/* Name + username */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-lime)] transition-colors">
                    {entry.display_name}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">@{entry.username}</p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-[var(--color-text-muted)]">Picks</p>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{entry.total_picks}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-[var(--color-text-muted)]">Avg Odds</p>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">
                      {entry.average_odds > 0 ? entry.average_odds.toFixed(1) : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--color-text-muted)]">Win Rate</p>
                    <p className="text-sm font-bold text-[var(--color-lime)]">{entry.win_rate}%</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
