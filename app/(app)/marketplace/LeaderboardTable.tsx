"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Trophy, BadgeCheck, User, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { SPORT_FILTERS } from "./TipstersClient"
import type { ExpertsLeaderboardEntry } from "@/lib/data/expertsLeaderboard"

export default function LeaderboardTable() {
  const [category, setCategory] = useState<string>("All")
  const [entries, setEntries] = useState<ExpertsLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchLeaderboard = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/experts-leaderboard?category=${encodeURIComponent(category)}`)
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setEntries(Array.isArray(data) ? data : [])
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchLeaderboard()
    return () => {
      cancelled = true
    }
  }, [category])

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
          <Trophy className="w-7 h-7 text-[var(--color-lime)]" />
          Top Predictors
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Ranked by win % over graded predictions. Category reflects the predictor&apos;s declared sports.
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          Net = wins minus settled losses (not coins).
        </p>
      </div>

      {/* Category chips (reused from the marketplace sport filters) */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SPORT_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setCategory(s)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              category === s
                ? "bg-[var(--color-lime)]/10 border-[var(--color-lime)]/50 text-[var(--color-lime)]"
                : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
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

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-8 text-center">
          <Trophy className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">Nothing here yet</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            No ranked predictors in this category yet.
          </p>
        </div>
      )}

      {/* Ranked table */}
      {!loading && entries.length > 0 && (
        <div className="space-y-2">
          {/* Column header */}
          <div className="flex items-center gap-4 px-4 pb-1 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            <div className="w-8 shrink-0 text-center">#</div>
            <div className="w-10 shrink-0" />
            <div className="flex-1">Tipster</div>
            <div className="w-14 text-right hidden sm:block">W / S</div>
            <div className="w-12 text-right">Net</div>
            <div className="w-14 text-right">Win %</div>
          </div>

          {entries.map((entry) => (
            <Link
              key={entry.user_id}
              href={`/l/${entry.username}`}
              className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 hover:border-[var(--color-lime)]/20 hover:bg-[var(--color-lime)]/5 transition-all group"
            >
              {/* Rank medal */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  entry.rank === 1
                    ? "bg-yellow-500/20 text-yellow-400"
                    : entry.rank === 2
                      ? "bg-zinc-300/20 text-zinc-300"
                      : entry.rank === 3
                        ? "bg-amber-700/20 text-amber-600"
                        : "bg-white/5 text-[var(--color-text-muted)]"
                )}
              >
                {entry.rank}
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

              {/* Wins / Settled */}
              <div className="w-14 text-right shrink-0 hidden sm:block">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {entry.wins} / {entry.settled}
                </p>
              </div>

              {/* Net */}
              <div className="w-12 text-right shrink-0">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    entry.net >= 0 ? "text-[var(--color-lime)]" : "text-red-400"
                  )}
                >
                  {entry.net >= 0 ? `+${entry.net}` : entry.net}
                </p>
              </div>

              {/* Win % */}
              <div className="w-14 text-right shrink-0">
                <p className="text-sm font-bold text-[var(--color-lime)]">{entry.win_pct}%</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
