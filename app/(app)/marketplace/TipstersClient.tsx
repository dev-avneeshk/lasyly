"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { User, Trophy, Target, Users, BadgeCheck, Search, SlidersHorizontal } from "lucide-react"

type Tipster = {
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

const SORT_OPTIONS = [
  { value: "followers", label: "Followers" },
  { value: "win_rate", label: "Win Rate" },
  { value: "total_picks", label: "Total Picks" },
] as const

const SPORT_FILTERS = ["All", "Football", "Basketball", "Tennis", "Cricket", "NFL", "Formula 1", "Esports", "MMA", "Boxing", "Golf"]

export default function TipstersClient() {
  const [tipsters, setTipsters] = useState<Tipster[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<string>("followers")
  const [sport, setSport] = useState<string>("All")

  useEffect(() => {
    const fetchTipsters = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ sort })
        if (sport !== "All") params.set("sport", sport)

        const res = await fetch(`/api/tipsters?${params.toString()}`)
        const data = await res.json()
        if (res.ok && data.tipsters) {
          setTipsters(data.tipsters)
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchTipsters()
  }, [sort, sport])

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">
          Tipster Marketplace
        </h1>
        <p className="mt-2 text-[var(--color-text-muted)] text-sm md:text-base">
          Discover top tipsters, view their track records, and follow for premium picks.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Sort */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[var(--color-text-muted)]" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-lime)]"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sport filter */}
        <div className="flex flex-wrap gap-2">
          {SPORT_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                sport === s
                  ? "bg-[var(--color-lime)]/10 border-[var(--color-lime)]/50 text-[var(--color-lime)]"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-white/10 rounded" />
                  <div className="h-3 w-16 bg-white/5 rounded" />
                </div>
              </div>
              <div className="h-3 w-full bg-white/5 rounded mb-3" />
              <div className="flex gap-3">
                <div className="h-8 w-16 bg-white/5 rounded" />
                <div className="h-8 w-16 bg-white/5 rounded" />
                <div className="h-8 w-16 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && tipsters.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">No tipsters found</h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Try adjusting your filters or check back later.
          </p>
        </div>
      )}

      {/* Tipster grid */}
      {!loading && tipsters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tipsters.map((tipster) => (
            <TipsterCard key={tipster.id} tipster={tipster} />
          ))}
        </div>
      )}
    </div>
  )
}

function TipsterCard({ tipster }: { tipster: Tipster }) {
  return (
    <Link
      href={`/u/${tipster.username}`}
      className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 backdrop-blur-sm p-5 hover:border-[var(--color-lime)]/30 hover:bg-[var(--color-surface)]/80 transition-all group"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)]">
            {tipster.avatar_url ? (
              <Image
                src={tipster.avatar_url}
                alt={tipster.display_name}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[var(--color-lime)]/10">
                <User className="w-5 h-5 text-[var(--color-lime)]" />
              </div>
            )}
          </div>
          {tipster.is_verified && (
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[var(--color-lime)] flex items-center justify-center border-2 border-[var(--color-surface)]">
              <BadgeCheck className="w-3 h-3 text-black" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-[var(--color-text-primary)] truncate group-hover:text-[var(--color-lime)] transition-colors">
              {tipster.display_name}
            </h3>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">@{tipster.username}</p>
        </div>
      </div>

      {/* Bio */}
      {tipster.bio && (
        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-3 leading-relaxed">
          {tipster.bio}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1">
          <Trophy className="w-3.5 h-3.5 text-[var(--color-success)]" />
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">{tipster.win_rate}%</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">win</span>
        </div>
        <div className="flex items-center gap-1">
          <Target className="w-3.5 h-3.5 text-[var(--color-lime)]" />
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">{tipster.total_picks}</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">picks</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">{tipster.follower_count}</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">followers</span>
        </div>
      </div>

      {/* Sports tags */}
      {tipster.favourite_sports && tipster.favourite_sports.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tipster.favourite_sports.slice(0, 3).map((sport) => (
            <span
              key={sport}
              className="px-2 py-0.5 rounded bg-white/5 border border-[var(--color-border)] text-[10px] font-medium text-[var(--color-text-muted)]"
            >
              {sport}
            </span>
          ))}
          {tipster.favourite_sports.length > 3 && (
            <span className="px-2 py-0.5 rounded bg-white/5 border border-[var(--color-border)] text-[10px] font-medium text-[var(--color-text-muted)]">
              +{tipster.favourite_sports.length - 3}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
