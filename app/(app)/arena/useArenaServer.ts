"use client"

/**
 * useArenaServer — client driver for SERVER-AUTHORITATIVE games (real 1v1).
 *
 * Unlike useArenaGame (which runs the engine locally for CPU games), this posts
 * every action to /api/arena/* and polls the server view. The server owns
 * budgets, ownership, timers, AI, and the winner — the client only renders the
 * returned view and proposes bids/passes.
 *
 * ── The polling loop, and why it looks like this ─────────────────────────────
 * It used to be one line:
 *
 *     const interval = status === "auction" || status === "lobby" ? 900 : 1500
 *     const id = setInterval(refresh, interval)
 *
 * with `refresh` swallowing every error. Four separate problems:
 *
 *   1. 900ms is 66.7 requests/minute, which by itself exceeded the server's
 *      whole-app per-IP budget of 60/min. One player, one tab, guaranteed 429s.
 *   2. setInterval has no idea whether the previous request finished. When the
 *      server slowed to 2s, each client had ~2 requests in flight instead of 1 —
 *      so load rose exactly when the server was struggling. A textbook pileup.
 *   3. `catch {}` meant a 429 or 503 was indistinguishable from success, so the
 *      client hammered on at full rate and never recovered.
 *   4. Polling ran in `lobby` too, so a game window left open on a second
 *      monitor polled every 900ms for as long as the tab lived (up to the
 *      3-hour server-side game TTL).
 *
 * Now: self-scheduling setTimeout chain (cannot overlap), 2.5s while bidding,
 * exponential backoff honouring Retry-After, and a bounded number of idle lobby
 * polls. Steady-state request rate per player drops from 66.7/min to 24/min.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { ArenaServerView } from "@/lib/arena/server"
import type { AIDifficulty, Season, TeamId } from "@/lib/arena/types"

type View = ArenaServerView

/** Poll cadence while a lot is live. Fast enough to feel real-time. */
const POLL_ACTIVE_MS = 2_500
/** Poll cadence while waiting in the lobby / between phases. */
const POLL_IDLE_MS = 4_000
/** Ceiling for backoff after repeated failures. */
const POLL_MAX_BACKOFF_MS = 30_000
/**
 * Stop polling an unattended lobby. 150 polls at 4s ≈ 10 minutes, which is far
 * longer than anyone waits for an opponent, and bounds an abandoned tab.
 */
const MAX_IDLE_LOBBY_POLLS = 150

interface ApiResult<T> {
  ok: boolean
  status: number
  retryAfterMs: number | null
  body: T
}

async function api<T = View>(url: string, body?: unknown): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const json = await res.json().catch(() => ({}))

  // The server tells us how long to wait on 429/503. Honour it instead of
  // guessing — this is the difference between backing off and retry-storming.
  const retryAfter = res.headers.get("retry-after")
  const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : null

  return {
    ok: res.ok,
    status: res.status,
    retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : null,
    body: json as T,
  }
}

/** Statuses that mean "the server is fine, just not now" — back off, don't fail. */
function isBackoffStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500
}

export function useArenaServer() {
  const [view, setView] = useState<View | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const viewRef = useRef<View | null>(null)
  const gameIdRef = useRef<string | null>(null)
  // Guards against overlapping polls. A poll that is still in flight must not be
  // joined by another one.
  const pollInFlight = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backoffRef = useRef(0)
  const idleLobbyPolls = useRef(0)

  useEffect(() => {
    viewRef.current = view
  }, [view])
  useEffect(() => {
    gameIdRef.current = gameId
  }, [gameId])

  const apply = useCallback((v: (View & { error?: string }) | null) => {
    if (!v) return
    if (v.error) setError(v.error)
    else setError(null)
    if (v.gameId) {
      setView(v)
      setGameId(v.gameId)
    }
  }, [])

  const create = useCallback(
    async (opts: { season: Season; budget: number; difficulty: AIDifficulty; mode: "ai" | "human" }) => {
      setConnecting(true)
      setError(null)
      try {
        const res = await api("/api/arena", opts)
        if (!res.ok) {
          setError((res.body as { error?: string })?.error ?? "Failed to create game.")
          return null
        }
        apply(res.body as View)
        return (res.body as View).gameId
      } catch {
        setError("Failed to create game.")
        return null
      } finally {
        setConnecting(false)
      }
    },
    [apply]
  )

  const join = useCallback(
    async (id: string) => {
      setConnecting(true)
      setError(null)
      try {
        const res = await api(`/api/arena/${id}/join`, {})
        if (!res.ok) {
          setError((res.body as { error?: string })?.error ?? "Failed to join game.")
          return
        }
        apply(res.body as View)
      } catch {
        setError("Failed to join game.")
      } finally {
        setConnecting(false)
      }
    },
    [apply]
  )

  /**
   * One poll. Returns the delay before the next one so the caller can chain.
   * Never throws: a transient failure becomes a longer delay, not an exception.
   */
  const pollOnce = useCallback(async (): Promise<number> => {
    const id = gameIdRef.current
    if (!id) return POLL_IDLE_MS
    if (pollInFlight.current) return POLL_ACTIVE_MS

    pollInFlight.current = true
    try {
      const res = await api(`/api/arena/${id}`)

      if (res.ok) {
        backoffRef.current = 0
        apply(res.body as View)
        const status = (res.body as View)?.status
        if (status === "lobby") {
          idleLobbyPolls.current += 1
        } else {
          idleLobbyPolls.current = 0
        }
        return status === "auction" ? POLL_ACTIVE_MS : POLL_IDLE_MS
      }

      if (isBackoffStatus(res.status)) {
        // Exponential backoff with jitter, floored by the server's Retry-After.
        backoffRef.current = Math.min(
          POLL_MAX_BACKOFF_MS,
          Math.max(POLL_ACTIVE_MS, (backoffRef.current || POLL_ACTIVE_MS) * 2)
        )
        const jitter = Math.random() * 500
        return Math.max(res.retryAfterMs ?? 0, backoffRef.current) + jitter
      }

      // 4xx that isn't a rate limit (e.g. 404 after the game expired): stop
      // chasing it at speed.
      return POLL_MAX_BACKOFF_MS
    } catch {
      // Network error / offline. Back off rather than spin.
      backoffRef.current = Math.min(
        POLL_MAX_BACKOFF_MS,
        Math.max(POLL_ACTIVE_MS, (backoffRef.current || POLL_ACTIVE_MS) * 2)
      )
      return backoffRef.current + Math.random() * 500
    } finally {
      pollInFlight.current = false
    }
  }, [apply])

  /** Manual refresh (used after an action, and by the UI's retry affordance). */
  const refresh = useCallback(async () => {
    await pollOnce()
  }, [pollOnce])

  const bid = useCallback(
    async (amount: number): Promise<{ ok: boolean; error?: string }> => {
      const id = gameIdRef.current
      if (!id) return { ok: false, error: "The game is no longer available." }

      try {
        const current = viewRef.current
        const res = await api(`/api/arena/${id}/bid`, {
          amount,
          // Lot-identity guard: if the lot resolved while this request was in
          // flight, the server refuses rather than spending the money on whoever
          // is up now. Replaces the old `rev` check, which polls churned.
          lotPlayerId: current?.lot?.player.id,
          rev: current?.rev,
        })
        // 400 (illegal bid) and 409 (lot moved on) both carry the fresh view.
        apply(res.body as View & { error?: string })
        if (!res.ok) {
          const error = (res.body as { error?: string })?.error ?? "That bid is no longer available."
          setError(error)
          return { ok: false, error }
        }
        return { ok: true }
      } catch {
        const error = "We could not send your bid. Please try again."
        setError(error)
        return { ok: false, error }
      }
    },
    [apply]
  )

  const pass = useCallback(async () => {
    const id = gameIdRef.current
    if (!id) return
    const res = await api(`/api/arena/${id}/pass`, {})
    apply(res.body as View & { error?: string })
  }, [apply])

  const simulate = useCallback(async () => {
    const id = gameIdRef.current
    if (!id) return
    const res = await api(`/api/arena/${id}/simulate`, {})
    apply(res.body as View & { error?: string })
  }, [apply])

  // ── Self-scheduling poll chain ─────────────────────────────────────────────
  // setTimeout, not setInterval: the next poll is scheduled only after the
  // previous one settles, so slow responses stretch the cadence instead of
  // stacking up concurrent requests.
  const status = view?.status
  useEffect(() => {
    if (!gameId) return
    if (status === "complete") return

    let cancelled = false
    idleLobbyPolls.current = 0

    const schedule = (delay: number) => {
      if (cancelled) return
      timerRef.current = setTimeout(async () => {
        if (cancelled) return
        // Don't poll a hidden tab; the visibility listener below resumes it.
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          schedule(POLL_IDLE_MS)
          return
        }
        if (idleLobbyPolls.current > MAX_IDLE_LOBBY_POLLS) return // give up on an abandoned lobby
        const next = await pollOnce()
        schedule(next)
      }, delay)
    }

    schedule(status === "auction" ? POLL_ACTIVE_MS : POLL_IDLE_MS)

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        backoffRef.current = 0
        idleLobbyPolls.current = 0
        void pollOnce()
      }
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [gameId, status, pollOnce])

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    backoffRef.current = 0
    idleLobbyPolls.current = 0
    setView(null)
    setGameId(null)
    setError(null)
  }, [])

  return {
    view,
    gameId,
    error,
    connecting,
    viewer: (view?.viewer ?? "P1") as TeamId,
    create,
    join,
    refresh,
    bid,
    pass,
    simulate,
    reset,
  }
}
