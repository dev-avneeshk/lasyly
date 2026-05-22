"use client"

import { cn } from "@/lib/utils"
import { SentimentData } from "@/lib/analytics/types"

interface SentimentBarProps {
  data: SentimentData
  onVote: (direction: "over" | "under") => void
  isAuthenticated: boolean
}

export function SentimentBar({ data, onVote, isAuthenticated }: SentimentBarProps) {
  const { overPct, underPct, totalVotes, userVote, hasMinVotes } = data

  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">
          Community Sentiment
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Percentage bar or "Not enough votes" */}
      {hasMinVotes ? (
        <div className="space-y-1.5">
          {/* Percentage labels */}
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-emerald-400">{overPct}% Over</span>
            <span className="text-red-400">{underPct}% Under</span>
          </div>

          {/* Split bar */}
          <div className="flex h-2 w-full rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 transition-all duration-300"
              style={{ width: `${overPct}%` }}
            />
            <div
              className="bg-red-500 transition-all duration-300"
              style={{ width: `${underPct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-1">
          <span className="text-xs text-[var(--color-text-muted)]">
            Not enough votes
          </span>
        </div>
      )}

      {/* Vote buttons (only for authenticated users) */}
      {isAuthenticated && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onVote("over")}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
              userVote === "over"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-emerald-500/30 hover:text-emerald-400"
            )}
          >
            Over
          </button>
          <button
            type="button"
            onClick={() => onVote("under")}
            className={cn(
              "flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
              userVote === "under"
                ? "bg-red-500/20 text-red-400 border border-red-500/50"
                : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-red-500/30 hover:text-red-400"
            )}
          >
            Under
          </button>
        </div>
      )}
    </div>
  )
}
