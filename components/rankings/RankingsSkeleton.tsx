"use client"

export function RankingsSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/40"
        >
          {/* Rank */}
          <div className="w-12 flex justify-end">
            <div className="h-6 w-8 rounded bg-white/8" />
          </div>
          {/* Movement */}
          <div className="w-10 flex justify-center">
            <div className="h-3 w-5 rounded bg-white/8" />
          </div>
          {/* Logo */}
          <div className="w-8 h-8 rounded-full bg-white/8" />
          {/* Name */}
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-32 rounded bg-white/8" />
            <div className="h-3 w-16 rounded bg-white/5" />
          </div>
          {/* Score */}
          <div className="flex flex-col items-end gap-1">
            <div className="h-5 w-10 rounded bg-white/8" />
            <div className="h-3 w-16 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PlayerDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4">
      <div className="h-8 w-48 rounded bg-white/8" />
      <div className="h-4 w-32 rounded bg-white/5" />
      <div className="h-64 rounded-2xl bg-white/5" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-24 rounded bg-white/5" />
            <div className="flex-1 h-1.5 rounded-full bg-white/5" />
            <div className="h-3 w-8 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  )
}
