"use client"

import { useState, useEffect } from "react"
import { X, Trash2, AlertTriangle, TrendingUp, Link2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParlayLeg {
  propId: string
  player: string
  statCategory: string
  propLine: number
  direction: "over" | "under"
  l10HitRate: number
  isWeakLink: boolean
  correlationFlag?: "correlated" | "conflict"
}

export interface ParlayState {
  legs: ParlayLeg[]
  combinedHitRate: number | null // null if insufficient data
  overlappingDates: number
  isVisible: boolean
}

interface ParlayBuilderProps {
  state: ParlayState
  onRemoveLeg: (propId: string) => void
  onClear: () => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_LEGS = 10

// ─── Component ──────────────────────────────────────────────────────────────

export function ParlayBuilder({ state, onRemoveLeg, onClear }: ParlayBuilderProps) {
  const { legs, combinedHitRate, overlappingDates, isVisible } = state
  const [isOpen, setIsOpen] = useState(false)
  const [showToast, setShowToast] = useState(false)

  // Auto-dismiss toast
  useEffect(() => {
    if (!showToast) return
    const timer = setTimeout(() => setShowToast(false), 3000)
    return () => clearTimeout(timer)
  }, [showToast])

  // Don't render when no legs
  if (!isVisible || legs.length === 0) {
    return null
  }

  return (
    <>
      {/* Floating circular button - bottom right */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full",
          "bg-[var(--color-lime)] text-black shadow-lg shadow-[var(--color-lime)]/20",
          "flex items-center justify-center",
          "hover:scale-105 active:scale-95 transition-transform",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
          isOpen && "hidden"
        )}
        aria-label={`View parlay - ${legs.length} legs`}
      >
        <TrendingUp className="w-5 h-5" />
        {/* Badge count */}
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center">
          {legs.length}
        </span>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-up panel */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="bg-[var(--color-surface-elevated)] border-t border-[var(--color-border)] rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col mx-auto max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]/50">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-lime)]" />
              <span className="text-sm font-semibold text-white">
                My Parlay
              </span>
              <span className="text-xs text-[var(--color-text-muted)] bg-white/10 px-1.5 py-0.5 rounded-full">
                {legs.length}/{MAX_LEGS}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Clear all */}
              <button
                type="button"
                onClick={onClear}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                aria-label="Clear all parlay legs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {/* Close */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close parlay"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Combined hit rate */}
          {legs.length >= 2 && combinedHitRate !== null && (
            <div className="px-5 py-2 border-b border-[var(--color-border)]/30">
              <span className="text-xs font-semibold text-[var(--color-lime)]">
                L10: {combinedHitRate.toFixed(1)}% combined hit rate
              </span>
            </div>
          )}

          {/* Legs list */}
          <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2">
            {legs.map((leg) => (
              <ParlayLegRow
                key={leg.propId}
                leg={leg}
                onRemove={() => onRemoveLeg(leg.propId)}
              />
            ))}
          </div>

          {/* Add to Bet button */}
          <div className="px-5 py-4 border-t border-[var(--color-border)]/50">
            <button
              type="button"
              onClick={() => setShowToast(true)}
              className="w-full py-3 rounded-xl bg-[var(--color-lime)] text-black font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all"
            >
              Add to My Log
            </button>
          </div>
        </div>
      </div>

      {/* Toast: Feature not available */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl px-5 py-3 shadow-lg">
            <AlertTriangle className="w-4 h-4 text-[var(--color-lime)] shrink-0" />
            <span className="text-sm text-white font-medium">
              This feature isn&apos;t available yet
            </span>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Leg Row ────────────────────────────────────────────────────────────────

interface ParlayLegRowProps {
  leg: ParlayLeg
  onRemove: () => void
}

function ParlayLegRow({ leg, onRemove }: ParlayLegRowProps) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-white/5 group">
      {/* Player info */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-white block truncate">
          {leg.player}
        </span>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={cn(
              "text-xs font-semibold",
              leg.direction === "over"
                ? "text-[var(--color-lime)]"
                : "text-[var(--color-danger)]"
            )}
          >
            {leg.direction === "over" ? "Over" : "Under"} {leg.propLine}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)]">•</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {leg.statCategory}
          </span>
        </div>
        {/* Correlation / Weak Link flags */}
        {(leg.correlationFlag || leg.isWeakLink) && (
          <div className="flex items-center gap-1.5 mt-1">
            {leg.correlationFlag === "correlated" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">
                <Link2 className="w-2.5 h-2.5" />
                Correlated
              </span>
            )}
            {leg.correlationFlag === "conflict" && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">
                <AlertTriangle className="w-2.5 h-2.5" />
                Conflict
              </span>
            )}
            {leg.isWeakLink && (
              <span className="text-[10px] font-semibold text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-1.5 py-0.5 rounded-full">
                Weak Link
              </span>
            )}
          </div>
        )}
      </div>

      {/* L10 hit rate */}
      <span className="text-xs text-[var(--color-text-muted)] shrink-0">
        L10: {leg.l10HitRate}%
      </span>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 rounded-lg text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-all focus:outline-none focus-visible:opacity-100"
        aria-label={`Remove ${leg.player} from parlay`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Helper: Add to Parlay validation ───────────────────────────────────────

/**
 * Validates whether a prop can be added to the parlay.
 * Returns { canAdd: true } or { canAdd: false, reason: string }.
 */
export function canAddToParlay(
  currentLegs: ParlayLeg[],
  propId: string
): { canAdd: true } | { canAdd: false; reason: string } {
  if (currentLegs.length >= MAX_LEGS) {
    return { canAdd: false, reason: `Maximum of ${MAX_LEGS} legs reached` }
  }
  if (currentLegs.some((leg) => leg.propId === propId)) {
    return { canAdd: false, reason: "This prop is already in your parlay" }
  }
  return { canAdd: true }
}
