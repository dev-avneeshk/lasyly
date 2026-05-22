"use client"

import { useRouter } from "next/navigation"
import { Plus, BookmarkPlus, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import { STAT_LABELS } from "@/lib/props/constants"
import { EnhancedPropCardData } from "@/lib/analytics/types"
import { HitRateBars } from "@/components/props/HitRateBars"
import { MatchupBadge } from "@/components/props/MatchupBadge"
import { ConfidenceStars } from "@/components/props/ConfidenceStars"
import { CorrelationsSection } from "@/components/props/CorrelationsSection"
import { SentimentBar } from "@/components/props/SentimentBar"
import { LineMovementIndicator } from "@/components/props/LineMovementIndicator"
import { AIWriteup } from "@/components/props/AIWriteup"
import { MiniGraph } from "@/components/props/MiniGraph"
import { PlayerPhoto } from "@/components/props/PlayerPhoto"
import { GraphDataPoint } from "@/lib/analytics/engine-v2"

interface PropCardProps {
  prop: EnhancedPropCardData
  onAddToParlay?: (prop: EnhancedPropCardData) => void
  onLogPick?: (prop: EnhancedPropCardData) => void
  onVote?: (propId: string, direction: "over" | "under") => void
  onAIExpand?: (propId: string) => void
  onCorrelationTap?: (propId: string) => void
  onPropCardClick?: (prop: EnhancedPropCardData, triggerElement: HTMLElement) => void
  isAuthenticated: boolean
  parlayDisabled?: boolean
  aiWriteup?: { writeup: string | null; loading: boolean; error: boolean; retryCount: number }
  onAIRetry?: (propId: string) => void
}

export function PropCard({
  prop,
  onAddToParlay,
  onLogPick,
  onVote,
  onAIExpand,
  onCorrelationTap,
  onPropCardClick,
  isAuthenticated,
  parlayDisabled,
  aiWriteup,
  onAIRetry,
}: PropCardProps) {
  const router = useRouter()

  return (
    <div
      id={`prop-card-${prop.id}`}
      className="bg-[var(--color-surface)]/60 border border-[var(--color-border)] rounded-2xl p-5 transition-all h-full flex flex-col cursor-pointer hover:border-[var(--color-lime)]/40"
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest("button") || target.closest("a")) return
        const isTeam = (prop as any).isTeamProp || (prop as any).position === "Team"
        const playerId = prop.player.toLowerCase().replace(/[^a-z0-9]+/g, "-")
        if (isTeam) {
          router.push(`/analysis/${playerId}?stat=${prop.statCategory}&team=${prop.team}&sport=${prop.sport}&type=team`)
        } else {
          router.push(`/analysis/${playerId}?stat=${prop.statCategory}&team=${prop.team}&sport=${prop.sport}`)
        }
      }}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          const target = e.target as HTMLElement
          if (target.closest("button") || target.closest("a")) return
          e.preventDefault()
          const isTeam = (prop as any).isTeamProp || (prop as any).position === "Team"
          const playerId = prop.player.toLowerCase().replace(/[^a-z0-9]+/g, "-")
          if (isTeam) {
            router.push(`/analysis/${playerId}?stat=${prop.statCategory}&team=${prop.team}&sport=${prop.sport}&type=team`)
          } else {
            router.push(`/analysis/${playerId}?stat=${prop.statCategory}&team=${prop.team}&sport=${prop.sport}`)
          }
        }
      }}
      aria-label={`View stats for ${prop.player} ${prop.statCategory}`}
    >
      {/* Top Row: Player Photo + Player Name + Team */}
      <div className="flex items-center gap-3 mb-3">
        {prop.sport === "Soccer" || (prop as any).isTeamProp || (prop as any).position === "Team" ? (
          <PlayerPhoto playerName={prop.player} team={prop.team} sport={prop.sport} headshotUrl={(prop as any).logoUrl ?? (prop as any).headshotUrl} size={36} />
        ) : (
          <PlayerPhoto playerName={prop.player} team={prop.team} sport={prop.sport} headshotUrl={(prop as any).headshotUrl} size={36} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{prop.player}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {prop.sport === "Soccer" || (prop as any).isTeamProp || (prop as any).position === "Team"
              ? `${(prop as any).league || ""} · Team${prop.upcomingOpponent ? ` · vs ${prop.upcomingOpponent}` : ""}`
              : `${prop.team} · ${(prop as any).position || ""}`
            }
          </p>
        </div>
        <ConfidenceStars breakdown={prop.confidence} />
      </div>

      {/* Prop Line + Projection */}
      <div className="mb-3">
        <span className="text-2xl font-bold text-white">{prop.propLine}</span>
        <span className="text-sm text-[var(--color-text-muted)] ml-2">{STAT_LABELS[prop.statCategory] ?? prop.statCategory.toUpperCase()}</span>
        <span className={cn(
          "ml-2 text-xs font-semibold px-1.5 py-0.5 rounded",
          prop.direction === "over"
            ? "bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
            : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
        )}>
          {prop.direction === "over" ? "Over" : "Under"}
        </span>
        {(prop as any).projection?.projection != null && (
          <span className="ml-2 text-xs font-medium text-[var(--color-text-secondary)]">
            Proj: {(prop as any).projection.projection}
          </span>
        )}
      </div>

      {/* Second Row: MatchupBadge + LineMovementIndicator */}
      <div className="flex items-center justify-between mb-4">
        <MatchupBadge
          grade={prop.matchupGrade}
          opponent={prop.upcomingOpponent ?? prop.matchup}
        />
        <LineMovementIndicator data={prop.lineMovement} />
      </div>

      {/* Main Visual: HitRateBars (hide for team props — MiniGraph is shown instead) */}
      {!((prop as any).isTeamProp || (prop as any).position === "Team") && (
        <div className="mb-4">
          <HitRateBars windows={prop.hitRateWindows} />
        </div>
      )}

      {/* Mini Graph (team props + NBA matchup-scoped props) */}
      {(prop as any).graphData && (prop as any).graphData.length >= 3 && (
        <div className="mb-4">
          <MiniGraph
            graphData={(prop as any).graphData as GraphDataPoint[]}
            propLine={prop.propLine}
          />
        </div>
      )}

      {/* Correlations Section */}
      <CorrelationsSection
        correlations={prop.correlations}
        onCorrelationTap={onCorrelationTap}
      />

      {/* Sentiment Bar */}
      {prop.sentiment && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]/50">
          <SentimentBar
            data={prop.sentiment}
            onVote={(direction) => onVote?.(prop.id, direction)}
            isAuthenticated={isAuthenticated}
          />
        </div>
      )}

      {/* AI Writeup (expandable) */}
      <div className="mt-3 pt-3 border-t border-[var(--color-border)]/50">
        <AIWriteup
          propId={prop.id}
          writeup={aiWriteup?.writeup ?? null}
          loading={aiWriteup?.loading ?? false}
          error={aiWriteup?.error ?? false}
          retryCount={aiWriteup?.retryCount ?? 0}
          onRetry={() => onAIRetry?.(prop.id)}
          onExpand={() => onAIExpand?.(prop.id)}
        />
      </div>

      {/* Action Buttons: Add to Parlay + Log Pick */}
      <div className="mt-auto pt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onAddToParlay?.(prop)}
          disabled={parlayDisabled}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors",
            parlayDisabled
              ? "bg-white/5 text-[var(--color-text-muted)] cursor-not-allowed"
              : "bg-[var(--color-lime)]/10 text-[var(--color-lime)] hover:bg-[var(--color-lime)]/20 border border-[var(--color-lime)]/30"
          )}
          aria-label="Add to Parlay"
        >
          <Plus className="w-3.5 h-3.5" />
          Add to Parlay
        </button>
        <button
          type="button"
          onClick={() => onLogPick?.(prop)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 text-[var(--color-text-secondary)] hover:bg-white/10 border border-[var(--color-border)] transition-colors"
          aria-label="Log Pick"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          Log Pick
        </button>
      </div>
    </div>
  )
}
