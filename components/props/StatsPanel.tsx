"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, AlertTriangle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DerivedStatsData } from "@/lib/analytics/derived-stats"
import type { CheatSheetConfig } from "@/lib/analytics/cheat-sheet"

// Placeholder imports for sub-components (created in subsequent tasks)
// import { StatsPanelHeader } from "./StatsPanelHeader"
// import { CollapsibleSection } from "./CollapsibleSection"
// import { RawStatsSection } from "./RawStatsSection"
// import { DerivedStatsSection } from "./DerivedStatsSection"
// import { SourceTableSection } from "./SourceTableSection"
// import { CheatSheetSection } from "./CheatSheetSection"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StatsPanelProps {
  /** Whether the panel is open */
  isOpen: boolean
  /** Player name to display stats for */
  playerName: string | null
  /** Stat category being viewed */
  statCategory: string | null
  /** Callback when panel should close */
  onClose: () => void
  /** Ref to the trigger element for focus return */
  triggerRef: React.RefObject<HTMLElement | null>
}

interface StatsReferenceResponse {
  player: string
  team: string
  position: string | null
  statCategory: string
  insufficientData: boolean
  rawStats: Record<string, unknown>
  derivedStats: DerivedStatsData | null
  leagueAverages: Record<string, number | null>
  cheatSheet: CheatSheetConfig | null
}

type PanelState = "loading" | "error" | "loaded"

// ─── Constants ──────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000
const TRANSITION_DURATION_MS = 300
const CONTENT_FADE_DURATION_MS = 200

// ─── Component ──────────────────────────────────────────────────────────────

export function StatsPanel({
  isOpen,
  playerName,
  statCategory,
  onClose,
  triggerRef,
}: StatsPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>("loading")
  const [data, setData] = useState<StatsReferenceResponse | null>(null)
  const [contentVisible, setContentVisible] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(
    async (player: string, stat: string) => {
      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      setPanelState("loading")
      setContentVisible(false)

      // Set up timeout
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, FETCH_TIMEOUT_MS)

      try {
        const params = new URLSearchParams({ player, stat })
        const res = await fetch(`/api/props/stats-reference?${params.toString()}`, {
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
          throw new Error(`API returned ${res.status}`)
        }

        const json: StatsReferenceResponse = await res.json()
        setData(json)
        setPanelState("loaded")

        // Fade in content after a brief delay
        requestAnimationFrame(() => {
          setContentVisible(true)
        })
      } catch (err) {
        clearTimeout(timeoutId)
        if (err instanceof Error && err.name === "AbortError") {
          // Only set error if this was a timeout (not a replacement fetch)
          if (!controller.signal.aborted || abortControllerRef.current === controller) {
            setPanelState("error")
          }
        } else {
          setPanelState("error")
        }
      }
    },
    []
  )

  // Fetch data when playerName or statCategory changes
  useEffect(() => {
    if (isOpen && playerName && statCategory) {
      fetchData(playerName, statCategory)
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [isOpen, playerName, statCategory, fetchData])

  // ─── Focus Management ───────────────────────────────────────────────────

  // Focus close button when panel opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow transition to start
      const timer = setTimeout(() => {
        closeButtonRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Return focus to trigger element on close
  useEffect(() => {
    if (!isOpen && triggerRef.current) {
      triggerRef.current.focus()
    }
  }, [isOpen, triggerRef])

  // ─── Focus Trap ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return

    const panel = panelRef.current
    if (!panel) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === "Tab") {
        const focusableElements = panel!.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )

        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          // Shift+Tab: cycle to last element if at first
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          // Tab: cycle to first element if at last
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // ─── Click Outside ──────────────────────────────────────────────────────

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // ─── Retry Handler ──────────────────────────────────────────────────────

  function handleRetry() {
    if (playerName && statCategory) {
      fetchData(playerName, statCategory)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  // Don't render anything when closed (after transition completes)
  if (!isOpen && !data) return null

  const headerId = "stats-panel-header"

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        style={{ transitionDuration: `${TRANSITION_DURATION_MS}ms` }}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby={headerId}
        aria-modal="true"
        className={cn(
          // Base styles
          "fixed z-50 bg-[var(--color-surface-elevated)] shadow-2xl flex flex-col overflow-hidden",
          // Desktop: slide-out from right
          "lg:inset-y-0 lg:right-0 lg:w-[480px] lg:border-l lg:border-[var(--color-border)]",
          // Mobile: full-screen modal
          "inset-0 lg:inset-y-0 lg:left-auto",
          // Transition
          "transition-transform ease-out",
          isOpen
            ? "translate-x-0"
            : "translate-x-full"
        )}
        style={{ transitionDuration: `${TRANSITION_DURATION_MS}ms` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex-1 min-w-0">
            <h2
              id={headerId}
              className="text-base font-semibold text-white truncate"
            >
              {panelState === "loaded" && data
                ? `${data.player} — ${data.statCategory.toUpperCase()}`
                : playerName
                  ? `${playerName} — ${statCategory?.toUpperCase() ?? ""}`
                  : "Stats Reference"}
            </h2>
            {panelState === "loaded" && data && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {data.team} • {data.position ?? "Unknown"}
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/50"
            aria-label="Close stats panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading skeleton */}
          {panelState === "loading" && <LoadingSkeleton />}

          {/* Error state */}
          {panelState === "error" && (
            <ErrorState onRetry={handleRetry} />
          )}

          {/* Loaded content */}
          {panelState === "loaded" && data && (
            <div
              className={cn(
                "transition-opacity",
                contentVisible ? "opacity-100" : "opacity-0"
              )}
              style={{ transitionDuration: `${CONTENT_FADE_DURATION_MS}ms` }}
            >
              {data.insufficientData && (
                <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
                  <p className="text-xs text-[var(--color-warning)]">
                    Limited data available (minimum 3 games required for derived stats).
                  </p>
                </div>
              )}

              {/* Placeholder sections — will be replaced by sub-components */}
              <div className="p-4 space-y-4">
                {/* Raw Stats Section */}
                <section className="rounded-xl bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-white mb-2">Raw Stats</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Shooting, rebounding, and playmaking stats will render here.
                  </p>
                </section>

                {/* Derived Stats Section */}
                {data.derivedStats && (
                  <section className="rounded-xl bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-white mb-2">Derived Stats</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Computed metrics with formula breakdowns will render here.
                    </p>
                  </section>
                )}

                {/* Source Table Section */}
                <section className="rounded-xl bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-white mb-2">Source Table Reference</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Stat-to-table mappings will render here.
                  </p>
                </section>

                {/* Cheat Sheet Section */}
                {data.cheatSheet && (
                  <section className="rounded-xl bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-white mb-2">Prop Cheat Sheet</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Prop-specific stat relevance will render here.
                    </p>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-48 bg-white/10 rounded" />
        <div className="h-3 w-32 bg-white/10 rounded" />
      </div>

      {/* Section skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl bg-white/5 p-4 space-y-3">
          <div className="h-4 w-36 bg-white/10 rounded" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-white/10 rounded" />
            <div className="h-3 w-5/6 bg-white/10 rounded" />
            <div className="h-3 w-4/6 bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-[var(--color-danger)]" />
      </div>
      <h3 className="text-sm font-semibold text-white mb-1">
        Unable to load stats
      </h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-4 max-w-[240px]">
        The stats reference data could not be loaded. Please try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/50"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </button>
    </div>
  )
}
