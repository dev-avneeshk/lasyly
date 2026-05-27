"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Loader2, AlertCircle, RefreshCw, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useParlayFeed } from "@/hooks/useParlayFeed"
import ParlayBetslipCard from "@/components/parlays/ParlayBetslipCard"

export default function BetsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { parlays, isLoading, error, hasMore, loadMore, refresh } = useParlayFeed()

  // Sentinel ref for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null)

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

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore()
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoading, loadMore])

  // Toggle expand/collapse
  const handleToggleExpand = useCallback((parlayId: string) => {
    setExpandedId((prev) => (prev === parlayId ? null : parlayId))
  }, [])

  // --- Loading state ---
  if (isLoading && parlays.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--color-background)] p-4">
        <div className="flex flex-col mx-auto max-w-2xl">
          <h1 className="mb-6 text-xl font-bold text-white">Parlay Feed</h1>
          <div className="flex flex-col space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-zinc-700" />
                  <div className="flex flex-col flex-1 space-y-2">
                    <div className="h-4 w-24 rounded bg-zinc-700" />
                    <div className="h-3 w-16 rounded bg-zinc-800" />
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <div className="h-10 rounded-lg bg-zinc-800" />
                  <div className="h-10 rounded-lg bg-zinc-800" />
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
          <h2 className="mb-2 text-lg font-bold text-white">
            Failed to load feed
          </h2>
          <p className="mb-6 text-sm text-zinc-400">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // --- Empty state ---
  if (!isLoading && parlays.length === 0 && !error) {
    return (
      <div className="flex flex-col min-h-screen bg-[var(--color-background)] items-center justify-center p-4">
        <div className="flex flex-col max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
            <Users className="h-7 w-7 text-zinc-400" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-white">
            No public parlays yet
          </h2>
          <p className="text-sm text-zinc-400">
            Be the first to share a parlay with the community. Build one from
            the analysis page and set it to public.
          </p>
        </div>
      </div>
    )
  }

  // --- Feed content ---
  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-background)] p-4">
      <div className="flex flex-col mx-auto max-w-2xl w-full">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Parlay Feed</h1>
          {!currentUserId && authChecked && (
            <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">
              Read-only
            </span>
          )}
        </div>

        <div className="flex flex-col space-y-4">
          {parlays.map((parlay) => (
            <div
              key={parlay.id}
              onClick={() => handleToggleExpand(parlay.id)}
              className="flex flex-col cursor-pointer"
            >
              <ParlayBetslipCard
                parlay={parlay}
                variant={expandedId === parlay.id ? "expanded" : "feed"}
                onToggleExpand={() => handleToggleExpand(parlay.id)}
                showActions={false}
                currentUserId={currentUserId ?? undefined}
              />
            </div>
          ))}
        </div>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-px" />

        {/* Loading more indicator */}
        {isLoading && parlays.length > 0 && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        )}

        {/* End of feed */}
        {!hasMore && parlays.length > 0 && (
          <p className="py-6 text-center text-xs text-zinc-600">
            You&apos;ve reached the end
          </p>
        )}
      </div>
    </div>
  )
}
