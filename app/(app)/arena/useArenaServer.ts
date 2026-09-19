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

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ArenaServerView } from "@/lib/arena/server"
import type { AIDifficulty, Season, TeamId } from "@/lib/arena/types"
import { createClient } from "@/lib/supabase/client"
import { arenaChannelName, ARENA_UPDATE_EVENT, type ArenaBroadcast } from "@/lib/realtime/arena"
import { markBidSent, recordBroadcastLatency, recordActionAck } from "./latency"

type View = ArenaServerView

/**
 * Fallback poll cadence while a lot is live.
 *
 * Real-time responsiveness now comes from the Supabase broadcast subscription
 * below — the server pushes a nudge the instant state changes and we re-fetch
 * on it. This timed poll only exists to self-heal a dropped nudge or a brief
 * disconnect, so it can be much slower than the old 2.5s (which was carrying the
 * whole real-time illusion and dominating request volume). 5s is a safe net.
 */
const POLL_ACTIVE_MS = 5_000
/** Fallback poll cadence while waiting in the lobby / between phases. */
const POLL_IDLE_MS = 6_000
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
  // True while we're sitting in a PUBLIC (matchmade) lobby. Drives the "Finding
  // an opponent" state instead of the private "share this link" one. A private
  // (invite-link) lobby leaves this false.
  const [publicLobby, setPublicLobby] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const viewRef = useRef<View | null>(null)
  const gameIdRef = useRef<string | null>(null)
  // The seat this client controls. A broadcast view is computed for whoever
  // acted, so on receipt we re-point `viewer` at our own seat. Learned from the
  // first authoritative response (create/join/matchmake/poll) and held stable.
  const viewerRef = useRef<TeamId>("P1")
  // Highest `rev` (sequence number) we've applied. Broadcasts and polls can
  // arrive out of order; we never move the view backwards, and a gap tells us a
  // push was dropped so we resync with an authoritative GET.
  const lastRevRef = useRef<number>(-1)
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

  /**
   * Apply a view we fetched OURSELVES (create/join/matchmake/poll/action
   * response). Its `viewer` is authoritative for this client, so we trust and
   * record it. We still guard against applying a view older than one we've
   * already shown — a slow GET that resolves after a newer push must not rewind
   * the board.
   */
  const apply = useCallback((v: (View & { error?: string }) | null) => {
    if (!v) return
    if (v.error) setError(v.error)
    else setError(null)
    if (!v.gameId) return
    // Record our seat from an authoritative, self-fetched view.
    if (v.viewer === "P1" || v.viewer === "P2") viewerRef.current = v.viewer
    // Monotonic: never move the board backwards. `rev` may be absent on some
    // error bodies; when present, drop anything not strictly newer.
    if (typeof v.rev === "number") {
      if (v.rev < lastRevRef.current) return
      lastRevRef.current = v.rev
    }
    setView(v)
    setGameId(v.gameId)
  }, [])

  /**
   * Apply a view that arrived via BROADCAST (pushed from another player's
   * action). One difference from `apply`: `viewer` was computed for whoever
   * acted, so we re-point it at OUR seat.
   *
   * The broadcast carries a COMPLETE authoritative snapshot, so a `rev` jump of
   * more than one is NOT a hole to fill — the newer snapshot already supersedes
   * every intermediate state (a single mutate can legitimately advance `rev` by
   * more than one: bid → driveAI → serverTick). We therefore apply any strictly
   * newer snapshot directly and never GET-resync on the rev delta. The only
   * reason to resync is a push with no snapshot (a bare nudge) — handled by the
   * caller, which calls `pollOnce()` when `payload.view` is absent — or the
   * reconnect path, which already re-fetches on SUBSCRIBED.
   *
   * Returns true if the view was applied directly (always, for a valid newer or
   * equal snapshot); false only when the payload isn't a usable snapshot, so the
   * caller falls back to a GET.
   */
  const applyRemote = useCallback((v: View | null): boolean => {
    if (!v || !v.gameId || typeof v.rev !== "number") return false
    // Already have this or newer — ignore (a push racing our own action reply).
    if (v.rev <= lastRevRef.current) return true
    // Strictly newer complete snapshot: apply it directly, whatever the delta.
    lastRevRef.current = v.rev
    setError(null)
    setView({ ...v, viewer: viewerRef.current })
    setGameId(v.gameId)
    return true
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

  const matchmake = useCallback(
    async (opts: { season: Season; budget: number; difficulty: AIDifficulty }) => {
      setConnecting(true)
      setError(null)
      try {
        const res = await api("/api/arena/matchmake", opts)
        if (!res.ok) {
          setError((res.body as { error?: string })?.error ?? "Failed to find a match.")
          return null
        }
        // If the server sat us as P1, we're the one waiting → public lobby.
        // If it seated us as P2, we joined a stranger and the auction is live.
        setPublicLobby((res.body as View).viewer === "P1")
        apply(res.body as View)
        return (res.body as View).gameId
      } catch {
        setError("Failed to find a match.")
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

      // Dev-only timing mark (no-op in production).
      markBidSent(amount)

      // ── Optimistic echo ──────────────────────────────────────────────────
      // Reflect the bidder's own click immediately so THEIR bid controls feel
      // instant, without waiting for the round-trip. This is a display-only
      // guess on the local view; the server remains the sole authority. The
      // authoritative response (below) or the next broadcast overwrites it, and
      // the monotonic `rev` guard means this optimistic frame — which we do NOT
      // bump `rev` for — is always superseded by the real one. On rejection the
      // fresh view the server returns snaps the price back.
      const current = viewRef.current
      const mySeat = viewerRef.current
      if (
        current?.lot &&
        amount > current.lot.currentBid &&
        current.lot.highBidder !== mySeat
      ) {
        setView({
          ...current,
          lot: { ...current.lot, currentBid: amount, highBidder: mySeat },
        })
      }

      try {
        const res = await api(`/api/arena/${id}/bid`, {
          amount,
          // Lot-identity guard: if the lot resolved while this request was in
          // flight, the server refuses rather than spending the money on whoever
          // is up now. Replaces the old `rev` check, which polls churned.
          lotPlayerId: current?.lot?.player.id,
          rev: current?.rev,
        })
        recordActionAck("bid")
        // 400 (illegal bid) and 409 (lot moved on) both carry the fresh view.
        // apply() is monotonic-guarded, so if a broadcast for this same bid
        // already landed first, the (equal-rev) HTTP body is harmlessly ignored.
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

  // ── Deadline nudge ──────────────────────────────────────────────────────────
  // The server clock is lazy: a lot only resolves when an action runs OR a poll
  // hits the GET after `lotDeadline` (see the GET route + serverTick). With the
  // fallback poll at 5s, a lot could otherwise sit visibly "at 0:00" for up to
  // 5s before the server notices. Here we schedule a single GET a hair after the
  // deadline so the server resolves it right at zero. The SERVER still decides
  // whether the auction is over — we only ask it to evaluate the clock on time;
  // we never resolve locally. Both clients arm this; whoever's GET lands first
  // advances the clock and broadcasts the resolution to the other.
  const lotDeadline = view?.lotDeadline ?? null
  useEffect(() => {
    if (status !== "auction" || lotDeadline === null) return
    // +150ms guard so the server's `now >= lotDeadline` check is unambiguously
    // true accounting for minor clock skew and network jitter.
    const delay = Math.max(0, lotDeadline - Date.now()) + 150
    const t = setTimeout(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      void pollOnce()
    }, delay)
    return () => clearTimeout(t)
  }, [status, lotDeadline, pollOnce])

  // ── Realtime push ──────────────────────────────────────────────────────────
  // The poll chain above is now only a FALLBACK. The primary path is a Supabase
  // broadcast the server sends after every real state change (bid, pass, lot
  // resolution, join, simulate). On each nudge we re-fetch the authoritative
  // view immediately, so the opponent sees a bid in ~100-300ms instead of on
  // their next 2.5s poll. pollOnce dedupes in-flight requests, so a nudge that
  // races the fallback timer is harmless.
  useEffect(() => {
    if (!gameId) return
    if (status === "complete") return

    const channel = supabase
      .channel(arenaChannelName(gameId))
      .on("broadcast", { event: ARENA_UPDATE_EVENT }, (msg) => {
        backoffRef.current = 0
        idleLobbyPolls.current = 0
        const payload = (msg as { payload?: ArenaBroadcast }).payload
        // Dev-only: server→client transit + total ack latency for the bidder.
        recordBroadcastLatency(payload)
        // Primary path: the push carried the authoritative view, so apply it in
        // a single hop — no second GET. Fall back to a GET only when the payload
        // has no view (a bare nudge) or a sequence gap means we'd be applying a
        // snapshot with a hole behind it.
        const applied = payload?.view ? applyRemote(payload.view) : false
        if (!applied) void pollOnce()
      })
      .subscribe((subStatus) => {
        // Fires on the initial connect AND on every reconnect. A client that
        // briefly dropped its socket would have missed any nudges sent while it
        // was gone; re-fetch on (re)subscribe so it re-syncs to the current
        // authoritative view the moment the channel is live again.
        if (subStatus === "SUBSCRIBED") {
          backoffRef.current = 0
          idleLobbyPolls.current = 0
          void pollOnce()
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [gameId, status, supabase, pollOnce, applyRemote])

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    backoffRef.current = 0
    idleLobbyPolls.current = 0
    lastRevRef.current = -1
    viewerRef.current = "P1"
    setView(null)
    setGameId(null)
    setError(null)
    setPublicLobby(false)
  }, [])

  return {
    view,
    gameId,
    error,
    connecting,
    viewer: (view?.viewer ?? "P1") as TeamId,
    isPublicLobby: publicLobby,
    create,
    matchmake,
    join,
    refresh,
    bid,
    pass,
    simulate,
    reset,
  }
}
