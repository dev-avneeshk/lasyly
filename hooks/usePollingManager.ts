"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { LiveMatch } from "@/types"

const LIVE_INTERVAL = 12_000   // 12s when live matches exist
const IDLE_INTERVAL = 60_000   // 60s when no live matches
const REQUEST_TIMEOUT = 10_000 // 10s abort timeout
const MAX_RETRIES = 3

type PollingState = "active" | "paused" | "stopped"

interface UsePollingManagerOptions {
  date: string // YYYYMMDD
  sport?: string
}

interface UsePollingManagerReturn {
  matches: LiveMatch[]
  isLoading: boolean
  error: string | null
  meta: { date: string; source: string } | null
  refetch: () => void
}

function isToday(date: string): boolean {
  const now = new Date()
  const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
  return date === today
}

function hasLiveMatches(matches: LiveMatch[]): boolean {
  return matches.some((m) =>
    m.status === "In Progress" ||
    m.status === "Halftime" ||
    m.status === "First Half" ||
    m.status === "Second Half" ||
    m.status === "Q1" ||
    m.status === "Q2" ||
    m.status === "Q3" ||
    m.status === "Q4" ||
    m.status === "OT"
  )
}

export function usePollingManager({ date, sport }: UsePollingManagerOptions): UsePollingManagerReturn {
  const [matches, setMatches] = useState<LiveMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ date: string; source: string } | null>(null)

  const pollingState = useRef<PollingState>("stopped")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const fetchScores = useCallback(async () => {
    // Abort any pending request
    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()
    abortRef.current = controller

    // Set timeout
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

    try {
      const params = new URLSearchParams()
      params.set("date", date)
      if (sport && sport !== "All") params.set("sport", sport)

      const res = await fetch(`/api/scores?${params.toString()}`, {
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const json = await res.json()

      if (json.success) {
        setMatches(json.data)
        setMeta(json.meta ?? null)
        setError(null)
        retryCount.current = 0
      } else {
        throw new Error(json.error || "Failed to fetch scores")
      }
    } catch (err) {
      clearTimeout(timeout)

      if ((err as Error).name === "AbortError") {
        // Request was aborted (timeout or manual)
      }

      retryCount.current++

      if (retryCount.current <= MAX_RETRIES) {
        // Exponential backoff: 2^N seconds
        const backoffMs = Math.pow(2, retryCount.current) * 1000
        timerRef.current = setTimeout(() => {
          if (pollingState.current === "active") {
            fetchScores()
          }
        }, backoffMs)
        return
      }

      // Max retries exceeded — show error, reset retry count for next cycle
      setError("Unable to load scores. Will retry shortly.")
      retryCount.current = 0
    } finally {
      setIsLoading(false)
    }
  }, [date, sport])

  const scheduleNext = useCallback(() => {
    if (pollingState.current !== "active") return

    const interval = hasLiveMatches(matches) ? LIVE_INTERVAL : IDLE_INTERVAL

    timerRef.current = setTimeout(() => {
      if (pollingState.current === "active") {
        fetchScores().then(scheduleNext)
      }
    }, interval)
  }, [matches, fetchScores])

  // Initial fetch and polling setup
  useEffect(() => {
    const shouldPoll = isToday(date)

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (shouldPoll) {
      pollingState.current = "active"
    } else {
      pollingState.current = "stopped"
    }

    setIsLoading(true)
    setError(null)
    retryCount.current = 0

    fetchScores().then(() => {
      if (shouldPoll && pollingState.current === "active") {
        scheduleNext()
      }
    })

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, sport])

  // Re-schedule when matches change (to adjust interval)
  useEffect(() => {
    if (pollingState.current === "active" && !isLoading) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      scheduleNext()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches])

  // Page Visibility API
  useEffect(() => {
    const handleVisibility = () => {
      if (!isToday(date)) return

      if (document.hidden) {
        // Pause polling
        pollingState.current = "paused"
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        if (abortRef.current) {
          abortRef.current.abort()
        }
      } else {
        // Resume polling
        pollingState.current = "active"
        retryCount.current = 0
        fetchScores().then(scheduleNext)
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, fetchScores, scheduleNext])

  const refetch = useCallback(() => {
    setIsLoading(true)
    setError(null)
    retryCount.current = 0
    fetchScores()
  }, [fetchScores])

  return { matches, isLoading, error, meta, refetch }
}
