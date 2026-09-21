"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Calendar,
  ChevronDown,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import PredictionRow from "@/components/parlays/PredictionRow"
import { computeParlayStats } from "@/lib/parlays/computations"
import { cn } from "@/lib/utils"
import type { ParlayWithLegs, ParlayStatus } from "@/lib/types/parlay"

type StatusFilter = "all" | ParlayStatus

const TIME_RANGES = [
  { label: "All Time", value: "all", days: null },
  { label: "Last 7 Days", value: "7d", days: 7 },
  { label: "Last 30 Days", value: "30d", days: 30 },
  { label: "Last 90 Days", value: "90d", days: 90 },
] as const

type TimeRange = (typeof TIME_RANGES)[number]["value"]

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Won", value: "won" },
  { label: "Lost", value: "lost" },
]

export default function PredictionsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [parlays, setParlays] = useState<ParlayWithLegs[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [timeRange, setTimeRange] = useState<TimeRange>("all")
  const [timeMenuOpen, setTimeMenuOpen] = useState(false)
  // Reference "now" captured at fetch time. Keeping this in state (rather than
  // calling Date.now() inside the render/memo) keeps the derived memos pure.
  const [fetchedAt, setFetchedAt] = useState<number>(() => Date.now())

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)
      setAuthChecked(true)
    }
    checkAuth()
  }, [supabase])

  // Fetch all of the user's parlays (status filtering is done client-side so the
  // summary stats always reflect the full picture, not the active tab).
  const fetchMyParlays = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set("limit", "50")

      const res = await fetch(`/api/parlays?${params.toString()}`)

      if (!res.ok) {
        if (res.status === 401) {
          setError("Sign in to view your predictions.")
          setParlays([])
          setIsLoading(false)
          return
        }
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed to load predictions (${res.status})`)
      }

      const data = await res.json()
      setParlays(data.parlays ?? [])
      setFetchedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load predictions")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authChecked) return
    if (!currentUserId) {
      setIsLoading(false)
      setError("Sign in to view your predictions.")
      return
    }
    fetchMyParlays()
  }, [authChecked, currentUserId, fetchMyParlays])

  // Apply the selected time range first — stats and rows both derive from it.
  const timeFiltered = useMemo(() => {
    const range = TIME_RANGES.find((r) => r.value === timeRange)
    if (!range || range.days == null) return parlays
    const cutoff = fetchedAt - range.days * 24 * 60 * 60 * 1000
    return parlays.filter((p) => new Date(p.created_at).getTime() >= cutoff)
  }, [parlays, timeRange, fetchedAt])

  const stats = useMemo(() => computeParlayStats(timeFiltered), [timeFiltered])

  const visible = useMemo(() => {
    if (statusFilter === "all") return timeFiltered
    return timeFiltered.filter((p) => p.status === statusFilter)
  }, [timeFiltered, statusFilter])

  const activeRangeLabel =
    TIME_RANGES.find((r) => r.value === timeRange)?.label ?? "All Time"

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (!authChecked || (isLoading && parlays.length === 0)) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
        <div className="h-8 w-56 animate-pulse rounded bg-[var(--color-border)]" />
        <div className="mt-8 flex flex-col space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
            />
          ))}
        </div>
      </div>
    )
  }

  // ─── Error / sign-in state ───────────────────────────────────────────────────
  if (error && parlays.length === 0) {
    const isSignIn = error === "Sign in to view your predictions."
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-4">
        <div className="flex w-full max-w-md flex-col text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-[var(--color-text-primary)]">
            {isSignIn ? "Sign in required" : "Failed to load predictions"}
          </h2>
          <p className="mb-6 text-sm text-[var(--color-text-muted)]">{error}</p>
          {!isSignIn && (
            <button
              type="button"
              onClick={fetchMyParlays}
              className="mx-auto inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-white/5"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      {/* ─── Hero header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-lime)]">
            My Predictions
          </p>
          <h1 className="text-3xl font-black tracking-tight text-[var(--color-text-primary)] md:text-4xl">
            Track Your Predictions
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            See your picks, results, and performance all in one place.
          </p>
        </div>

        {/* Stats summary card */}
        <div className="flex items-center gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Total Picks
            </span>
            <span className="text-2xl font-black text-[var(--color-text-primary)]">
              {stats.total}
            </span>
          </div>
          <div className="h-10 w-px bg-[var(--color-border)]" />
          <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Win Rate
            </span>
            <span className="text-2xl font-black text-lime-400">
              {stats.win_rate != null ? `${Math.round(stats.win_rate)}%` : "—"}
            </span>
          </div>
          <div className="h-10 w-px bg-[var(--color-border)]" />
          <div className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Profit / Loss
            </span>
            <span
              className={cn(
                "text-2xl font-black tabular-nums",
                stats.net_profit_loss > 0
                  ? "text-lime-400"
                  : stats.net_profit_loss < 0
                    ? "text-red-400"
                    : "text-[var(--color-text-primary)]",
              )}
            >
              {stats.net_profit_loss > 0 ? "+" : ""}
              {stats.net_profit_loss.toFixed(1)}u
            </span>
          </div>
          <BarChart3 className="hidden h-9 w-9 text-[var(--color-lime)]/70 sm:block" />
        </div>
      </div>

      {/* ─── Controls row ─────────────────────────────────────────────────── */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter pills */}
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-bold transition-colors",
                statusFilter === f.value
                  ? "bg-[var(--color-lime)] text-black"
                  : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text-primary)]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Time range + refresh */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setTimeMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-white/5"
            >
              <Calendar className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
              {activeRangeLabel}
              <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            </button>
            {timeMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setTimeMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-xl">
                  {TIME_RANGES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => {
                        setTimeRange(r.value)
                        setTimeMenuOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-white/5",
                        timeRange === r.value
                          ? "text-[var(--color-lime)]"
                          : "text-[var(--color-text-muted)]",
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={fetchMyParlays}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-white/5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── Rows ─────────────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]">
            <BarChart3 className="h-7 w-7 text-[var(--color-text-muted)]" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-[var(--color-text-primary)]">
            {statusFilter === "all" ? "No predictions yet" : `No ${statusFilter} predictions`}
          </h2>
          <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
            {statusFilter === "all"
              ? "Build a prediction from the analysis page to start tracking your picks."
              : "Nothing here for this filter. Try a different status or time range."}
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col space-y-3">
          {visible.map((parlay) => (
            <PredictionRow key={parlay.id} parlay={parlay} />
          ))}
        </div>
      )}

      {isLoading && parlays.length > 0 && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      )}
    </div>
  )
}
