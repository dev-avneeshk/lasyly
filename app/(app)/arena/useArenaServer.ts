"use client"

/**
 * useArenaServer — client driver for SERVER-AUTHORITATIVE games (real 1v1 and
 * server-persisted CPU games). Unlike useArenaGame (which runs the engine
 * locally), this posts every action to /api/arena/* and polls the server view.
 * The server owns budgets, ownership, timers, AI, and the winner — the client
 * only renders the returned view and proposes bids/passes.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { ArenaServerView } from "@/lib/arena/server"
import type { AIDifficulty, Season, TeamId } from "@/lib/arena/types"

type View = ArenaServerView

async function api<T = View>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok && res.status !== 409 && res.status !== 400) {
    throw new Error(json?.error || `Request failed (${res.status})`)
  }
  return json as T
}

export function useArenaServer() {
  const [view, setView] = useState<View | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const viewRef = useRef<View | null>(null)
  const gameIdRef = useRef<string | null>(null)

  useEffect(() => { viewRef.current = view }, [view])
  useEffect(() => { gameIdRef.current = gameId }, [gameId])

  const apply = useCallback((v: View & { error?: string }) => {
    if (v?.error) setError(v.error)
    if (v?.gameId) {
      setView(v)
      setGameId(v.gameId)
    }
  }, [])

  const create = useCallback(
    async (opts: { season: Season; budget: number; difficulty: AIDifficulty; mode: "ai" | "human" }) => {
      setConnecting(true)
      setError(null)
      try {
        const v = await api("/api/arena", opts)
        apply(v as View)
        return (v as View).gameId
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create game.")
        return null
      } finally {
        setConnecting(false)
      }
    },
    [apply]
  )

  const join = useCallback(async (id: string) => {
    setConnecting(true)
    setError(null)
    try {
      const v = await api(`/api/arena/${id}/join`, {})
      apply(v as View)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join game.")
    } finally {
      setConnecting(false)
    }
  }, [apply])

  const refresh = useCallback(async () => {
    const id = gameIdRef.current
    if (!id) return
    try {
      const v = await api(`/api/arena/${id}`)
      apply(v as View)
    } catch {
      // transient poll failure — ignore
    }
  }, [apply])

  const bid = useCallback(async (amount: number) => {
    const id = gameIdRef.current
    if (!id) return
    const rev = viewRef.current?.rev
    const v = await api(`/api/arena/${id}/bid`, { amount, rev })
    apply(v as View & { error?: string })
  }, [apply])

  const pass = useCallback(async () => {
    const id = gameIdRef.current
    if (!id) return
    const v = await api(`/api/arena/${id}/pass`, {})
    apply(v as View)
  }, [apply])

  const simulate = useCallback(async () => {
    const id = gameIdRef.current
    if (!id) return
    const v = await api(`/api/arena/${id}/simulate`, {})
    apply(v as View)
  }, [apply])

  // Poll while the game is active so both players stay in sync and the server
  // clock (lot resolution + AI) advances.
  useEffect(() => {
    if (!gameId) return
    const status = view?.status
    if (status === "complete") return
    const interval = status === "auction" || status === "lobby" ? 900 : 1500
    const id = setInterval(refresh, interval)
    return () => clearInterval(id)
  }, [gameId, view?.status, refresh])

  const reset = useCallback(() => {
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
