"use client"

import { BarChart2 } from "lucide-react"
import { EnhancedPropCardData } from "@/lib/analytics/types"
import { PropCard } from "./PropCard"

interface PropCardGridProps {
  props: EnhancedPropCardData[]
  loading: boolean
  onAddToParlay?: (prop: EnhancedPropCardData) => void
  onLogPick?: (prop: EnhancedPropCardData) => void
  onVote?: (propId: string, direction: "over" | "under") => void
  onAIExpand?: (propId: string) => void
  onCorrelationTap?: (propId: string) => void
  onAIRetry?: (propId: string) => void
  onPropCardClick?: (prop: EnhancedPropCardData, triggerElement: HTMLElement) => void
  isAuthenticated: boolean
  parlayPropIds?: Set<string>
  parlayFull?: boolean
  aiWriteups?: Record<string, { writeup: string | null; loading: boolean; error: boolean; retryCount: number }>
  emptyMessage?: string
}

export function PropCardGrid({
  props,
  loading,
  onAddToParlay,
  onLogPick,
  onVote,
  onAIExpand,
  onCorrelationTap,
  onAIRetry,
  onPropCardClick,
  isAuthenticated,
  parlayPropIds,
  parlayFull,
  aiWriteups,
  emptyMessage,
}: PropCardGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-2xl bg-white/5"
          />
        ))}
      </div>
    )
  }

  if (props.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 rounded-full bg-[var(--color-lime)]/10 flex items-center justify-center mb-4">
          <BarChart2 className="w-6 h-6 text-[var(--color-lime)]" />
        </div>
        <p className="text-base font-semibold text-white mb-1">No props found</p>
        <p className="text-sm text-[var(--color-text-muted)] text-center max-w-sm">
          {emptyMessage ?? "Try a different stat filter or search term. Props are generated from recent game data."}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {props.map((prop) => {
        const isInParlay = parlayPropIds?.has(prop.id) ?? false
        const parlayDisabled = isInParlay || (parlayFull ?? false)

        return (
          <PropCard
            key={prop.id}
            prop={prop}
            onAddToParlay={onAddToParlay}
            onLogPick={onLogPick}
            onVote={onVote}
            onAIExpand={onAIExpand}
            onCorrelationTap={onCorrelationTap}
            onPropCardClick={onPropCardClick}
            onAIRetry={onAIRetry}
            isAuthenticated={isAuthenticated}
            parlayDisabled={parlayDisabled}
            aiWriteup={aiWriteups?.[prop.id]}
          />
        )
      })}
    </div>
  )
}
