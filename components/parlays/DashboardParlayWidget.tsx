"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { AnimatePresence } from "framer-motion"
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  XCircle,
  Clock,
  BarChart3,
  Undo2,
  PieChart,
  Flame,
  Target,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { computeParlayStats } from "@/lib/parlays/computations"
import ParlayBetslipCard from "@/components/parlays/ParlayBetslipCard"
import type {
  ParlayWithLegs,
  ParlayStats,
  ParlayStatus,
  DashboardParlayWidgetProps,
} from "@/lib/types/parlay"

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20
const UNDO_WINDOW_MS = 60_000

type TabFilter = "all" | "pending" | "won" | "lost"

const TABS: { key: TabFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
]

// ─── Undo Toast State ────────────────────────────────────────────────────────

interface UndoState {
  parlayId: string
  previousStatus: ParlayStatus
  newStatus: ParlayStatus
  expiresAt: number
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardParlayWidget({
  initialParlays,
  initialStats,
}: DashboardParlayWidgetProps) {
  const [parlays, setParlays] = useState<ParlayWithLegs[]>(initialParlays)
  const [stats, setStats] = useState<ParlayStats>(initialStats)
  const [activeTab, setActiveTab] = useState<TabFilter>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [offset, setOffset] = useState(initialParlays.length)
  const [hasMore, setHasMore] = useState(initialParlays.length >= PAGE_SIZE)
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ─── Fetch parlays on tab change ────────────────────────────────────────────

  const fetchParlays = useCallback(
    async (tab: TabFilter, reset = true) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (tab !== "all") params.set("status", tab)
        params.set("limit", String(PAGE_SIZE))
        params.set("offset", reset ? "0" : String(offset))

        const res = await fetch(`/api/parlays?${params.toString()}`)
        if (!res.ok) throw new Error("Failed to fetch")

        const data = await res.json()
        const fetched = data.parlays as ParlayWithLegs[]

        if (reset) {
          setParlays(fetched)
          setOffset(fetched.length)
        } else {
          setParlays((prev) => [...prev, ...fetched])
          setOffset((prev) => prev + fetched.length)
        }
        setHasMore(fetched.length >= PAGE_SIZE)
      } catch {
        // Silently fail — keep existing data
      } finally {
        setIsLoading(false)
      }
    },
    [offset]
  )

  const handleTabChange = useCallback(
    (tab: TabFilter) => {
      setActiveTab(tab)
      setExpandedId(null)
      fetchParlays(tab, true)
    },
    [fetchParlays]
  )

  const handleLoadMore = useCallback(() => {
    fetchParlays(activeTab, false)
  }, [activeTab, fetchParlays])

  // ─── Expand / Collapse ──────────────────────────────────────────────────────

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  // ─── Status Change with Undo ────────────────────────────────────────────────

  const handleStatusChange = useCallback(
    async (parlayId: string, newStatus: "won" | "lost") => {
      const parlay = parlays.find((p) => p.id === parlayId)
      if (!parlay) return

      const previousStatus = parlay.status

      // Optimistically update local state
      setParlays((prev) =>
        prev.map((p) =>
          p.id === parlayId
            ? { ...p, status: newStatus, resolved_at: new Date().toISOString() }
            : p
        )
      )

      // Recompute stats optimistically
      const updatedParlays = parlays.map((p) =>
        p.id === parlayId
          ? { ...p, status: newStatus as ParlayStatus, resolved_at: new Date().toISOString() }
          : p
      )
      setStats(computeParlayStats(updatedParlays))

      // Call API
      try {
        const res = await fetch(`/api/parlays/${parlayId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        })
        if (!res.ok) throw new Error("Failed to update")
      } catch {
        // Revert on failure
        setParlays((prev) =>
          prev.map((p) =>
            p.id === parlayId
              ? { ...p, status: previousStatus, resolved_at: null }
              : p
          )
        )
        setStats(computeParlayStats(parlays))
        return
      }

      // Clear any existing undo timer
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current)
      }

      // Set undo state
      const expiresAt = Date.now() + UNDO_WINDOW_MS
      setUndoState({ parlayId, previousStatus, newStatus, expiresAt })

      // Auto-dismiss undo after 60 seconds
      undoTimerRef.current = setTimeout(() => {
        setUndoState(null)
      }, UNDO_WINDOW_MS)
    },
    [parlays]
  )

  // ─── Undo Handler ──────────────────────────────────────────────────────────

  const handleUndo = useCallback(async () => {
    if (!undoState) return
    if (Date.now() > undoState.expiresAt) {
      setUndoState(null)
      return
    }

    const { parlayId } = undoState

    // Optimistically revert to pending
    setParlays((prev) =>
      prev.map((p) =>
        p.id === parlayId ? { ...p, status: "pending" as ParlayStatus, resolved_at: null } : p
      )
    )

    const revertedParlays = parlays.map((p) =>
      p.id === parlayId ? { ...p, status: "pending" as ParlayStatus, resolved_at: null } : p
    )
    setStats(computeParlayStats(revertedParlays))

    // Call API to revert
    try {
      const res = await fetch(`/api/parlays/${parlayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" }),
      })
      if (!res.ok) throw new Error("Failed to undo")
    } catch {
      // Revert the revert on failure — re-fetch to get correct state
      fetchParlays(activeTab, true)
    }

    // Clear undo state
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
    }
    setUndoState(null)
  }, [undoState, parlays, fetchParlays, activeTab])

  // ─── Cleanup timer on unmount ───────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current)
      }
    }
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col bg-[var(--color-dash-surface)] rounded-2xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[var(--color-lime)]" />
          <h2 className="text-lg font-semibold text-white">My Parlays</h2>
        </div>
      </div>

      {/* Summary Stats */}
      <StatsBar stats={stats} />

      {/* Parlay Performance Analytics */}
      <ParlayAnalytics stats={stats} />

      {/* Tab Filters */}
      <div className="flex items-center gap-1 px-5 py-3 border-b border-white/5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              activeTab === tab.key
                ? "bg-[var(--color-lime)] text-black"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Parlay List */}
      <div className="flex flex-col px-5 py-4 space-y-3">
        {isLoading && parlays.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-[var(--color-lime)]" />
          </div>
        ) : parlays.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <AnimatePresence initial={false}>
              {parlays.map((parlay) => (
                <ParlayBetslipCard
                  key={parlay.id}
                  parlay={parlay}
                  variant={expandedId === parlay.id ? "expanded" : "compact"}
                  onToggleExpand={() => handleToggleExpand(parlay.id)}
                  onStatusChange={(status) =>
                    handleStatusChange(parlay.id, status as "won" | "lost")
                  }
                  showActions={true}
                  currentUserId={parlay.user_id}
                />
              ))}
            </AnimatePresence>

            {/* Load More */}
            {hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoading}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors disabled:opacity-50"
              >
                {isLoading ? "Loading..." : "Load more"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Undo Toast */}
      {undoState && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl px-5 py-3 shadow-lg">
            <span className="text-sm text-white font-medium">
              Parlay marked as{" "}
              <span
                className={cn(
                  "font-bold",
                  undoState.newStatus === "won"
                    ? "text-lime-400"
                    : "text-red-400"
                )}
              >
                {undoState.newStatus}
              </span>
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-colors"
            >
              <Undo2 className="h-3 w-3" />
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Stats Bar Sub-Component ─────────────────────────────────────────────────

function StatsBar({ stats }: { stats: ParlayStats }) {
  const winRateDisplay =
    stats.win_rate !== null ? `${stats.win_rate}%` : "—"
  const netPLDisplay = `${stats.net_profit_loss >= 0 ? "+" : ""}$${stats.net_profit_loss.toFixed(2)}`

  return (
    <div className="grid grid-cols-3 gap-3 px-5 pb-3 sm:grid-cols-6">
      <StatItem label="Total" value={String(stats.total)} icon={BarChart3} />
      <StatItem
        label="Won"
        value={String(stats.won)}
        icon={Trophy}
        valueColor="text-lime-400"
      />
      <StatItem
        label="Lost"
        value={String(stats.lost)}
        icon={XCircle}
        valueColor="text-red-400"
      />
      <StatItem
        label="Pending"
        value={String(stats.pending)}
        icon={Clock}
        valueColor="text-zinc-400"
      />
      <StatItem
        label="Win Rate"
        value={winRateDisplay}
        icon={TrendingUp}
        valueColor="text-lime-400"
      />
      <StatItem
        label="Net P/L"
        value={netPLDisplay}
        icon={stats.net_profit_loss >= 0 ? TrendingUp : TrendingDown}
        valueColor={
          stats.net_profit_loss >= 0 ? "text-lime-400" : "text-red-400"
        }
      />
    </div>
  )
}

function StatItem({
  label,
  value,
  icon: Icon,
  valueColor = "text-white",
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  valueColor?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-black/20 px-2 py-2.5">
      <Icon className="h-3.5 w-3.5 text-zinc-500" />
      <span className={cn("text-sm font-bold", valueColor)}>{value}</span>
      <span className="text-[10px] text-zinc-500 font-medium">{label}</span>
    </div>
  )
}

// ─── Parlay Analytics Sub-Component ──────────────────────────────────────────

function ParlayAnalytics({ stats }: { stats: ParlayStats }) {
  const resolvedCount = stats.won + stats.lost

  return (
    <div className="flex flex-col mx-5 mb-3 rounded-xl border border-white/5 bg-black/20 p-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3">
        <PieChart className="h-4 w-4 text-[var(--color-lime)]" />
        <h3 className="text-sm font-semibold text-white">Parlay Stats</h3>
      </div>

      {/* Fewer than 5 resolved parlays — show "more data needed" */}
      {resolvedCount < 5 ? (
        <p className="text-xs text-zinc-500">
          Need at least 5 resolved parlays for analytics
        </p>
      ) : (
        <>
          {/* Row 1: Key metrics */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-3">
            <AnalyticItem
              label="Avg Legs"
              value={stats.avg_legs !== null ? String(stats.avg_legs) : "—"}
            />
            <AnalyticItem
              label="Top Sport"
              value={stats.most_common_sport ?? "—"}
            />
            <AnalyticItem
              label="Best Streak"
              value={`${stats.best_streak}W`}
              icon={Flame}
              iconColor="text-orange-400"
            />
            <AnalyticItem
              label="Current Streak"
              value={
                stats.current_streak.type
                  ? `${stats.current_streak.count}${stats.current_streak.type === "won" ? "W" : "L"}`
                  : "0"
              }
              icon={Target}
              iconColor={
                stats.current_streak.type === "won"
                  ? "text-lime-400"
                  : stats.current_streak.type === "lost"
                    ? "text-red-400"
                    : "text-zinc-500"
              }
            />
          </div>

          {/* Row 2: Win rate by leg count */}
          <div className="flex flex-wrap items-center gap-2">
            <LegBucketBadge label="2-leg" winRate={stats.by_leg_count["2-leg"].win_rate} />
            <LegBucketBadge label="3-leg" winRate={stats.by_leg_count["3-leg"].win_rate} />
            <LegBucketBadge label="4+-leg" winRate={stats.by_leg_count["4+-leg"].win_rate} />
          </div>
        </>
      )}
    </div>
  )
}

function AnalyticItem({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
  iconColor?: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-black/30 px-2 py-2">
      {Icon && <Icon className={cn("h-3 w-3", iconColor ?? "text-zinc-500")} />}
      <span className="text-xs font-bold text-white truncate max-w-full">
        {value}
      </span>
      <span className="text-[10px] text-zinc-500 font-medium">{label}</span>
    </div>
  )
}

function LegBucketBadge({
  label,
  winRate,
}: {
  label: string
  winRate: number | null
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-black/30 px-2.5 py-1.5">
      <span className="text-[10px] text-zinc-400 font-medium">{label}:</span>
      <span className="text-xs font-bold text-white">
        {winRate !== null ? `${winRate}%` : "—"}
      </span>
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
        <BarChart3 className="h-6 w-6 text-zinc-500" />
      </div>
      <p className="text-sm font-semibold text-zinc-300">No parlays yet</p>
      <p className="mt-1 text-xs text-zinc-500">
        Build your first parlay from the analysis page
      </p>
      <Link
        href="/analysis"
        className="mt-4 rounded-lg bg-[var(--color-lime)] px-4 py-2 text-sm font-bold text-black hover:bg-[var(--color-lime)]/90 transition-colors"
      >
        Go to Analysis
      </Link>
    </div>
  )
}
