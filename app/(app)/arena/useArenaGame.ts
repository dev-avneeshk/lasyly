"use client"

/**
 * useArenaGame — client-side driver for the full Auction Arena loop.
 *
 * For the MVP this runs the (pure, server-authoritative-shaped) engine locally
 * so the mode is fully playable vs AI with zero backend dependency. The server
 * routes (Phase 8) mirror these exact transitions for persistence and real 1v1.
 *
 * Responsibilities:
 *  - hold ArenaState, expose derived view data
 *  - run the countdown timer & resolve lots on expiry
 *  - drive the AI seat's bids reactively
 *  - transition auction → lineup → simulation → results
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  createGame,
  placeBid as enginePlaceBid,
  resolveLot,
  openNextLot,
  minRaise,
  type ArenaState,
} from "@/lib/arena/auction"
import { decideAI } from "@/lib/arena/ai"
import { snapshot, maxAffordable } from "@/lib/arena/budget"
import { runSimulation, difficultyEdge } from "@/lib/arena/game"
import type {
  AIDifficulty,
  ArenaGameConfig,
  GameResult,
  Season,
  TeamId,
} from "@/lib/arena/types"
import { DEFAULT_CONFIG, bidIncrementForBudget, bestPersonalityForDifficulty } from "@/lib/arena/types"

// Deep clone helper so React sees new references on every transition.
function clone(state: ArenaState): ArenaState {
  return JSON.parse(JSON.stringify(state))
}

export interface ArenaViewState {
  state: ArenaState | null
  result: GameResult | null
  timeLeft: number
  lastAward: { name: string; winner: TeamId; price: number } | null
  humanSeat: TeamId
}

export function useArenaGame() {
  const [state, setState] = useState<ArenaState | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [lastAward, setLastAward] = useState<ArenaViewState["lastAward"]>(null)
  const humanSeat: TeamId = "P1"

  const stateRef = useRef<ArenaState | null>(null)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Track results length to detect a new award for the "SOLD" animation.
  const resultsSeen = useRef(0)
  const soldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear any pending SOLD-banner timer on unmount to avoid setting state on an
  // unmounted component.
  useEffect(() => () => { if (soldTimer.current) clearTimeout(soldTimer.current) }, [])

  const commit = useCallback((next: ArenaState) => {
    // Detect newly awarded player for the SOLD banner.
    if (next.results.length > resultsSeen.current) {
      const last = next.results[next.results.length - 1]
      resultsSeen.current = next.results.length
      setLastAward({ name: last.playerName, winner: last.winner, price: last.price })
      if (soldTimer.current) clearTimeout(soldTimer.current)
      soldTimer.current = setTimeout(() => setLastAward(null), 1600)
    }
    setState(clone(next))
  }, [])

  const start = useCallback(
    (opts: { season: Season; budget: number; difficulty: AIDifficulty; seed?: number }) => {
      const config: ArenaGameConfig = {
        ...DEFAULT_CONFIG,
        season: opts.season,
        budgetPerPlayer: opts.budget,
        bidIncrement: bidIncrementForBudget(opts.budget),
        difficulty: opts.difficulty,
        aiPersonality: bestPersonalityForDifficulty(opts.difficulty),
      }
      const g = createGame({
        gameId: `local-${Date.now()}`,
        config,
        vsAI: true,
        seed: opts.seed,
      })
      openNextLot(g)
      resultsSeen.current = g.results.length
      setResult(null)
      commit(g)
    },
    [commit]
  )

  // ── Countdown timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!state || state.status !== "auction" || !state.lotDeadline) {
      setTimeLeft(0)
      return
    }
    const id = setInterval(() => {
      const s = stateRef.current
      if (!s || !s.lotDeadline) return
      const left = Math.max(0, s.lotDeadline - Date.now())
      setTimeLeft(left)
      if (left <= 0) {
        const next = clone(s)
        resolveLot(next)
        commit(next)
      }
    }, 100)
    return () => clearInterval(id)
  }, [state, commit])

  // ── AI reactions ─────────────────────────────────────────────────────────
  // The AI actively contests lots it wants — it will OPEN bidding (even when
  // nobody has bid yet) and RAISE your bids up to its walk-away price, creating
  // a real back-and-forth instead of instantly conceding. Crucially, the AI
  // never calls the engine's `pass` (which would auto-resolve the lot the
  // instant it declines). It simply stops raising; the countdown timer then
  // decides the lot, so you always get a visible "going once… SOLD" beat.
  useEffect(() => {
    if (!state || state.status !== "auction" || !state.lot) return
    const aiSeat: TeamId = state.isAI.P2 ? "P2" : state.isAI.P1 ? "P1" : "P2"
    if (!state.isAI[aiSeat]) return
    // If the AI already holds the high bid, it waits (no self-bidding).
    if (state.lot.highBidder === aiSeat) return

    // React a touch faster when it's an uncontested open, slower in a war.
    const delay = 650 + Math.random() * 850
    const id = setTimeout(() => {
      const s = stateRef.current
      if (!s || s.status !== "auction" || !s.lot) return
      if (s.lot.highBidder === aiSeat) return
      const decision = decideAI(s, aiSeat)
      if (decision.action !== "bid") return // AI stands pat; timer will resolve
      const next = clone(s)
      const res = enginePlaceBid(next, aiSeat, decision.amount)
      if (res.ok) commit(next)
    }, delay)
    return () => clearTimeout(id)
  }, [state, commit])

  // ── Human actions ────────────────────────────────────────────────────────
  const bid = useCallback(
    (amount: number) => {
      const s = stateRef.current
      if (!s) return { ok: false, error: "No game." }
      const next = clone(s)
      const res = enginePlaceBid(next, humanSeat, amount)
      if (res.ok) commit(next)
      return res
    },
    [commit]
  )

  const raise = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const next = minRaise(s, humanSeat)
    if (next != null) bid(next)
  }, [bid])

  const passLot = useCallback(() => {
    const s = stateRef.current
    if (!s || !s.lot) return
    const next = clone(s)
    const nextLot = next.lot
    if (!nextLot) return
    const aiSeat: TeamId = next.isAI.P2 ? "P2" : "P1"

    // Pressing Pass while you're already leading is a no-op.
    if (nextLot.highBidder === humanSeat) return

    if (nextLot.highBidder === aiSeat) {
      // The CPU already has a bid in and you've conceded — the lot is decided,
      // CPU wins. Resolve after a short beat so the SOLD banner reads clean.
      next.lotDeadline = Date.now() + 700
      commit(next)
      return
    }

    // Nobody has bid yet (you're skipping the opener). It's now the CPU's turn:
    // give it a decision. If it wants the player it bids (and, since you've
    // already passed, wins); if it declines too, the lot is skipped.
    const decision = decideAI(next, aiSeat)
    if (decision.action === "bid") {
      enginePlaceBid(next, aiSeat, decision.amount)
      // CPU now leads and you've passed → resolve to CPU shortly.
      if (next.lot) next.lotDeadline = Date.now() + 700
    } else {
      // Both sides pass → skip the lot immediately.
      resolveLot(next)
    }
    commit(next)
  }, [commit])

  const bidMax = useCallback(() => {
    const s = stateRef.current
    if (!s || !s.lot) return
    const max = maxAffordable(s.config.budgetPerPlayer, s.rosters[humanSeat])
    if (max > s.lot.currentBid) bid(max)
  }, [bid])

  // ── Simulation ─────────────────────────────────────────────────────────
  const simulate = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const next = clone(s)
    next.status = "simulating"
    commit(next)
    // Compute result immediately; the SimulationScreen paces the reveal.
    // The CPU seat (P2) gets a difficulty execution edge.
    const edges = {
      P1: next.isAI.P1 ? difficultyEdge(next.config.difficulty) : 0,
      P2: next.isAI.P2 ? difficultyEdge(next.config.difficulty) : 0,
    }
    const r = runSimulation(next.rosters.P1, next.rosters.P2, next.season, next.seed, edges)
    setResult(r)
  }, [commit])

  const finishSimulation = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const next = clone(s)
    next.status = "complete"
    next.completedAt = Date.now()
    commit(next)
  }, [commit])

  const reset = useCallback(() => {
    setState(null)
    setResult(null)
    setLastAward(null)
    resultsSeen.current = 0
  }, [])

  // ── Derived view data ────────────────────────────────────────────────────
  const budgets = useMemo(() => {
    if (!state) return null
    return {
      P1: snapshot(state.config.budgetPerPlayer, state.rosters.P1),
      P2: snapshot(state.config.budgetPerPlayer, state.rosters.P2),
    }
  }, [state])

  const humanMinRaise = useMemo(
    () => (state ? minRaise(state, humanSeat) : null),
    [state]
  )

  return {
    state,
    result,
    timeLeft,
    lastAward,
    humanSeat,
    budgets,
    humanMinRaise,
    start,
    bid,
    raise,
    passLot,
    bidMax,
    simulate,
    finishSimulation,
    reset,
  }
}
