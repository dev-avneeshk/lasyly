"use client"

/**
 * useNflGame — client-side driver for the full NFL Auction loop.
 *
 * A sibling of the NBA arena's useArenaGame: it runs the (pure,
 * server-authoritative-shaped) NFL engine locally so the mode is fully playable
 * vs the AI with zero backend dependency. It holds NflAuctionState, runs the
 * countdown, drives the AI seat's bids, and transitions
 * auction → lineup → simulation → results.
 *
 * All authoritative logic lives in lib/nfl/*. This hook only orchestrates.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  createGame,
  placeBid as enginePlaceBid,
  resolveLot,
  openNextLot,
  minRaise,
  type NflAuctionState,
} from "@/lib/nfl/auction"
import { decideAI } from "@/lib/nfl/ai"
import { snapshot, maxAffordable } from "@/lib/nfl/budget"
import { runSimulation, difficultyEdge } from "@/lib/nfl/game"
import type {
  AIDifficulty,
  NflGameConfig,
  NflGameResult,
  Season,
  TeamId,
} from "@/lib/nfl/types"
import { DEFAULT_CONFIG, bidIncrementForBudget, bestPersonalityForDifficulty } from "@/lib/nfl/types"

// Deep clone so React sees new references on every transition.
function clone(state: NflAuctionState): NflAuctionState {
  return JSON.parse(JSON.stringify(state))
}

export interface NflViewState {
  state: NflAuctionState | null
  result: NflGameResult | null
  timeLeft: number
  lastAward: { name: string; winner: TeamId; price: number } | null
  humanSeat: TeamId
}

export function useNflGame() {
  const [state, setState] = useState<NflAuctionState | null>(null)
  const [result, setResult] = useState<NflGameResult | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [lastAward, setLastAward] = useState<NflViewState["lastAward"]>(null)
  const humanSeat: TeamId = "P1"

  const stateRef = useRef<NflAuctionState | null>(null)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const resultsSeen = useRef(0)
  const soldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (soldTimer.current) clearTimeout(soldTimer.current) }, [])

  const commit = useCallback((next: NflAuctionState) => {
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
      const config: NflGameConfig = {
        ...DEFAULT_CONFIG,
        season: opts.season,
        budgetPerPlayer: opts.budget,
        bidIncrement: bidIncrementForBudget(opts.budget),
        difficulty: opts.difficulty,
        aiPersonality: bestPersonalityForDifficulty(opts.difficulty),
      }
      const g = createGame({
        gameId: `nfl-local-${Date.now()}`,
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
  // The AI opens bidding on lots it wants and raises up to its walk-away price.
  // It never calls the engine's pass (that would auto-resolve instantly); it
  // simply stops raising and the countdown resolves the lot, giving a visible
  // "going once… SOLD" beat. Mirrors the NBA arena behavior.
  useEffect(() => {
    if (!state || state.status !== "auction" || !state.lot) return
    const aiSeat: TeamId = state.isAI.P2 ? "P2" : state.isAI.P1 ? "P1" : "P2"
    if (!state.isAI[aiSeat]) return
    if (state.lot.highBidder === aiSeat) return

    const delay = 650 + Math.random() * 850
    const id = setTimeout(() => {
      const s = stateRef.current
      if (!s || s.status !== "auction" || !s.lot) return
      if (s.lot.highBidder === aiSeat) return
      const decision = decideAI(s, aiSeat)
      if (decision.action !== "bid") return
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

    if (nextLot.highBidder === humanSeat) return

    if (nextLot.highBidder === aiSeat) {
      // CPU already leads and you've conceded — resolve to CPU shortly.
      next.lotDeadline = Date.now() + 700
      commit(next)
      return
    }

    // Nobody has bid yet (you're skipping the opener): give the CPU its move.
    const decision = decideAI(next, aiSeat)
    if (decision.action === "bid") {
      enginePlaceBid(next, aiSeat, decision.amount)
      if (next.lot) next.lotDeadline = Date.now() + 700
    } else {
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
