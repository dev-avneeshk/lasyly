"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertCircle, RefreshCw, BarChart3 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import ParlayBetslipCard from "@/components/parlays/ParlayBetslipCard"
import type { ParlayWithLegs, ParlayStatus } from "@/lib/types/parlay"

type StatusFilter = "all" | ParlayStatus

export default function BetsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [parlays, setParlays] = useState<ParlayWithLegs[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

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

  // Fetch user's own parlays
  const fetchMyParlays = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set("limit", "50")
      if (statusFilter !== "all") {
        params.set("status", statusFilter)
      }

      const res = await fetch(`/api/parlays?${params.toString()}`)

      if (!res.ok) {
        if (res.status === 401) {
          setError("Sign in to view your bets.")
          setParlays([])
          setIsLoading(false)
          return
        }
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed to load bets (${res.status})`)
      }

      const data = await res.json()
      setParlays(data.parlays ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bets")
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  // Fetch when auth is checked and user is logged in
  useEffect(() => {
    if (!authChecked) return
    if (!currentUserId) {
      setIsLoading(false)
      setError("Sign in to view your bets.")
      return
    }
    fetchMyParlays()
  }, [authChecked, currentUserId, fetchMyParlays])

  // Toggle expand/collapse
  const handleToggleExpand = useCallback((parlayId: string) => {
    setExpandedId((prev) => (prev === parlayId ? null : parlayId))
  }, [])

  // Update parlay status (won/lost)
  const handleStatusChange = useCallback(async (parlayId: string, newStatus: "won" | "lost" | "pending") => {
    // Optimistically update local state
    setParlays((prev) =>
      prev.map((p) => p.id === parlayId ? { ...p, status: newStatus, resolved_at: newStatus !== "pending" ? new Date().toISOString() : null } : p)
    )

    try {
      const res = await fetch(`/api/parlays/${parlayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        // Revert on failure
        setParlays((prev) =>
          prev.map((p) => p.id === parlayId ? { ...p, status: "pending", resolved_at: null } : p)
        )
      }
    } catch {
      // Revert on failure
      setParlays((prev) =>
        prev.map((p) => p.id === parlayId ? { ...p, status: "pending", resolved_at: null } : p)
      )
    }
  }, [])

  // Status filter tabs
  const filters: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Won", value: "won" },
    { label: "Lost", value: "lost" },
  ]

  // --- Loading state ---
  if (!authChecked || (isLoading && parlays.length === 0)) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--color-background)] p-4">
        <div className="flex flex-col mx-auto max-w-2xl w-full">
          <h1 className="mb-6 text-xl font-bold text-[var(--color-text-primary)]">My Bets</h1>
          <div className="flex flex-col space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-[var(--color-border)]" />
                  <div className="flex flex-col flex-1 space-y-2">
                    <div className="h-4 w-24 rounded bg-[var(--color-border)]" />
                    <div className="h-3 w-16 rounded bg-[var(--color-border)]/60" />
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <div className="h-10 rounded-lg bg-[var(--color-border)]/60" />
                  <div className="h-10 rounded-lg bg-[var(--color-border)]/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // --- Error state ---
  if (error && parlays.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--color-background)] items-center justify-center p-4">
        <div className="flex flex-col max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-[var(--color-text-primary)]">
            {error === "Sign in to view your bets." ? "Sign in required" : "Failed to load bets"}
          </h2>
          <p className="mb-6 text-sm text-[var(--color-text-muted)]">{error}</p>
          {error !== "Sign in to view your bets." && (
            <button
              type="button"
              onClick={fetchMyParlays}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30 transition-colors mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  // --- Empty state ---
  if (!isLoading && parlays.length === 0 && !error) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--color-background)] p-4">
        <div className="flex flex-col mx-auto max-w-2xl w-full">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">My Bets</h1>
          </div>

          {/* Filter tabs */}
          <div className="mb-6 flex items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === f.value
                    ? "bg-[var(--color-lime)] text-black"
                    : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/30 hover:text-[var(--color-text-primary)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center py-16">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
              <BarChart3 className="h-7 w-7 text-[var(--color-text-muted)]" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-[var(--color-text-primary)]">
              {statusFilter === "all" ? "No bets yet" : `No ${statusFilter} bets`}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {statusFilter === "all"
                ? "Build a parlay from the analysis page to start tracking your bets."
                : `You don't have any ${statusFilter} parlays. Try a different filter.`}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // --- Bets content ---
  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-background)] p-4">
      <div className="flex flex-col mx-auto max-w-2xl w-full">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">My Bets</h1>
          <button
            type="button"
            onClick={fetchMyParlays}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/30 hover:text-[var(--color-text-primary)] transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex items-center gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === f.value
                  ? "bg-[var(--color-lime)] text-black"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/30 hover:text-[var(--color-text-primary)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col space-y-4">
          {parlays.map((parlay) => (
            <div
              key={parlay.id}
              className="flex flex-col"
            >
              <ParlayBetslipCard
                parlay={parlay}
                variant={expandedId === parlay.id ? "expanded" : "compact"}
                onToggleExpand={() => handleToggleExpand(parlay.id)}
                onStatusChange={(status) => handleStatusChange(parlay.id, status)}
                showActions={true}
                currentUserId={currentUserId ?? undefined}
              />
            </div>
          ))}
        </div>

        {/* Loading indicator */}
        {isLoading && parlays.length > 0 && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        )}
      </div>
    </div>
  )
}
