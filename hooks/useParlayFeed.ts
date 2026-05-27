"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { ParlayWithLegs } from "@/lib/types/parlay"

const DEFAULT_LIMIT = 20

interface UseParlayFeedReturn {
  parlays: ParlayWithLegs[]
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  refresh: () => void
}

export function useParlayFeed(options?: { limit?: number }): UseParlayFeedReturn {
  const limit = options?.limit ?? DEFAULT_LIMIT

  const [parlays, setParlays] = useState<ParlayWithLegs[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)

  const isLoadingMore = useRef(false)
  const supabase = useMemo(() => createClient(), [])

  // Fetch parlays from the feed API
  const fetchFeed = useCallback(
    async (cursorId: string | null, append: boolean) => {
      try {
        const params = new URLSearchParams()
        params.set("limit", String(limit))
        if (cursorId) {
          params.set("cursor", cursorId)
        }

        const res = await fetch(`/api/parlays/feed?${params.toString()}`)

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Failed to load feed (${res.status})`)
        }

        const data = await res.json()
        const fetched: ParlayWithLegs[] = data.parlays ?? []
        const nextCursor: string | null = data.nextCursor ?? null

        setParlays((prev) => {
          if (append) {
            // Deduplicate in case of race conditions
            const existingIds = new Set(prev.map((p) => p.id))
            const newItems = fetched.filter((p) => !existingIds.has(p.id))
            return [...prev, ...newItems]
          }
          return fetched
        })

        setCursor(nextCursor)
        setHasMore(fetched.length === limit)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load feed")
      } finally {
        setIsLoading(false)
        isLoadingMore.current = false
      }
    },
    [limit]
  )

  // Initial fetch
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    setParlays([])
    setCursor(null)
    setHasMore(true)
    fetchFeed(null, false)
  }, [fetchFeed])

  // Subscribe to Realtime broadcast channel (matches ChatPanel pattern)
  useEffect(() => {
    const channel = supabase
      .channel("parlays-feed")
      .on("broadcast", { event: "new_parlay" }, (payload) => {
        const parlay = payload.payload as ParlayWithLegs
        setParlays((prev) => {
          // Avoid duplicates
          if (prev.some((p) => p.id === parlay.id)) return prev
          return [parlay, ...prev]
        })
      })
      .on("broadcast", { event: "status_update" }, (payload) => {
        const { id, status, resolved_at } = payload.payload as {
          id: string
          status: string
          resolved_at: string | null
        }
        setParlays((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, status: status as ParlayWithLegs["status"], resolved_at }
              : p
          )
        )
      })
      .on("broadcast", { event: "remove_parlay" }, (payload) => {
        const { id } = payload.payload as { id: string }
        setParlays((prev) => prev.filter((p) => p.id !== id))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Load more for infinite scroll
  const loadMore = useCallback(() => {
    if (isLoadingMore.current || !hasMore || !cursor) return
    isLoadingMore.current = true
    fetchFeed(cursor, true)
  }, [cursor, hasMore, fetchFeed])

  // Refresh: reset and re-fetch from the beginning
  const refresh = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setParlays([])
    setCursor(null)
    setHasMore(true)
    fetchFeed(null, false)
  }, [fetchFeed])

  return { parlays, isLoading, error, hasMore, loadMore, refresh }
}
