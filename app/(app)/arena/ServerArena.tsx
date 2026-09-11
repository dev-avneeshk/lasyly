"use client"

/**
 * ServerArena — renders a SERVER-AUTHORITATIVE game (real 1v1 human-vs-human,
 * or a server-persisted CPU game) using the same presentational components as
 * the local mode. It adapts the server view into the shapes those components
 * expect. All actions round-trip through /api/arena/* via useArenaServer.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Copy, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlayerCard } from "@/components/arena/PlayerCard"
import { BudgetPanel } from "@/components/arena/BudgetPanel"
import { BidControls } from "@/components/arena/BidControls"
import { SimulationScreen } from "@/components/arena/SimulationScreen"
import { GameSummary } from "@/components/arena/GameSummary"
import { SoldStamp } from "@/components/arena/SoldStamp"
import type { ArenaServerView } from "@/lib/arena/server"
import type { ArenaState } from "@/lib/arena/auction"
import type { TeamId } from "@/lib/arena/types"
import { useArenaServer } from "./useArenaServer"
import { cn } from "@/lib/utils"

/** Adapt the server view into the ArenaState shape BidControls consumes. */
function asState(view: ArenaServerView): ArenaState {
  return {
    gameId: view.gameId,
    seed: 0,
    season: view.season,
    config: view.config,
    status: view.status,
    queue: [],
    lot: view.lot,
    passed: view.passed,
    rosters: view.rosters,
    isAI: view.isAI,
    history: [],
    results: view.results,
    lotDeadline: view.lotDeadline,
    completedAt: view.completedAt,
  }
}

export function ServerArena({
  server,
  labelFor,
}: {
  server: ReturnType<typeof useArenaServer>
  labelFor: (seat: TeamId) => string
}) {
  const { view, viewer, error } = server
  const [timeLeft, setTimeLeft] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [justSold, setJustSold] = useState<{ name: string; winner: TeamId; price: number } | null>(null)
  const deadlineRef = useRef<number | null>(null)
  const soldCount = useRef(0)
  const soldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fire the SOLD stamp when the server reports a newly awarded player.
  useEffect(() => {
    const results = view?.results ?? []
    if (results.length > soldCount.current) {
      soldCount.current = results.length
      const last = results[results.length - 1]
      setJustSold({ name: last.playerName, winner: last.winner, price: last.price })
      if (soldTimer.current) clearTimeout(soldTimer.current)
      soldTimer.current = setTimeout(() => setJustSold(null), 1600)
    }
  }, [view?.results])
  useEffect(() => () => { if (soldTimer.current) clearTimeout(soldTimer.current) }, [])

  // Local ticking clock derived from the server deadline (smooth countdown).
  useEffect(() => {
    deadlineRef.current = view?.lotDeadline ?? null
  }, [view?.lotDeadline])
  useEffect(() => {
    const id = setInterval(() => {
      const dl = deadlineRef.current
      setTimeLeft(dl ? Math.max(0, dl - Date.now()) : 0)
    }, 100)
    return () => clearInterval(id)
  }, [])

  const opp: TeamId = viewer === "P1" ? "P2" : "P1"
  const state = useMemo(() => (view ? asState(view) : null), [view])
  const timeSec = Math.ceil(timeLeft / 1000)

  if (!view || !state) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Connecting…
      </div>
    )
  }

  // ── Waiting for opponent (human game, lobby) ─────────────────────────────
  if (view.status === "lobby") {
    return <WaitingRoom gameId={view.gameId} error={error} />
  }

  // ── Results / paced simulation reveal ─────────────────────────────────────
  // The server jumps lineup → complete (it computes the result server-side).
  // We still play the animated SimulationScreen once before showing the summary.
  if (view.status === "complete" && view.result) {
    if (!revealed) {
      return (
        <SimulationScreen
          result={view.result}
          p1Label={labelFor("P1")}
          p2Label={labelFor("P2")}
          onDone={() => setRevealed(true)}
        />
      )
    }
    return (
      <GameSummary
        result={view.result}
        humanSeat={viewer}
        p1Label={labelFor("P1")}
        p2Label={labelFor("P2")}
        onRematch={() => server.reset()}
        onNewAuction={() => server.reset()}
        onExit={() => server.reset()}
      />
    )
  }

  // ── Lineup confirm ────────────────────────────────────────────────────────
  if (view.status === "lineup") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-10">
        <h2 className="text-3xl font-black text-[var(--color-text-primary)]">Rosters Set</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Both lineups are locked. Run the game?</p>
        <div className="grid w-full gap-4 md:grid-cols-2">
          <BudgetPanel team="P1" label={labelFor("P1")} budget={view.budgets.P1} roster={view.rosters.P1} isAI={view.isAI.P1} />
          <BudgetPanel team="P2" label={labelFor("P2")} budget={view.budgets.P2} roster={view.rosters.P2} isAI={view.isAI.P2} />
        </div>
        <Button size="lg" className="font-black" onClick={() => server.simulate()}>Start Simulation</Button>
      </div>
    )
  }

  // ── Auction ────────────────────────────────────────────────────────────
  const lot = view.lot
  const lastResult = view.results[view.results.length - 1]

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-6">
      {error && (
        <div className="mb-3 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-center text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr_1fr]">
        <div className="order-2 lg:order-1">
          <BudgetPanel
            team={viewer}
            label={labelFor(viewer)}
            budget={view.budgets[viewer]}
            roster={view.rosters[viewer]}
            currentBid={lot?.currentBid}
            isHighBidder={lot?.highBidder === viewer}
          />
        </div>

        <div className="order-1 flex flex-col items-center gap-4 lg:order-2">
          {lot && (
            <div className="flex w-full max-w-md items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3">
              <span className="text-xs text-[var(--color-text-muted)]">Lot {view.results.length + 1}</span>
              <span className={cn("text-sm font-semibold", lot.highBidder === viewer ? "text-[var(--color-lime)]" : lot.highBidder ? "text-[var(--color-warning)]" : "text-[var(--color-text-muted)]")}>
                {lot.highBidder === viewer ? "You're leading" : lot.highBidder ? `${labelFor(opp)} leads` : "Open"}
              </span>
              <span className={cn("text-lg font-black tabular-nums", timeSec <= 3 ? "text-[var(--color-danger)]" : "text-[var(--color-lime)]")}>{timeSec}s</span>
            </div>
          )}
          <div className="relative w-full max-w-md">
            <div className={cn("transition-[filter] duration-200", justSold && "blur-[2px]")}>
              <AnimatePresence mode="wait">
                {lot && <PlayerCard key={lot.player.id} player={lot.player} />}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {justSold && (
                <SoldStamp name={justSold.name} winnerLabel={labelFor(justSold.winner)} price={justSold.price} />
              )}
            </AnimatePresence>
          </div>
          {lot && (
            <div className="w-full max-w-md">
              <BidControls
                state={state}
                humanSeat={viewer}
                minRaise={view.minRaise[viewer]}
                onBid={(amount) => { server.bid(amount); return { ok: true } }}
                onMax={() => {
                  const max = view.budgets[viewer].maxAffordable
                  if (max > (lot?.currentBid ?? 0)) server.bid(max)
                }}
                onPass={() => server.pass()}
              />
            </div>
          )}
        </div>

        <div className="order-3">
          <BudgetPanel
            team={opp}
            label={labelFor(opp)}
            budget={view.budgets[opp]}
            roster={view.rosters[opp]}
            currentBid={lot?.currentBid}
            isHighBidder={lot?.highBidder === opp}
            isAI={view.isAI[opp]}
          />
        </div>
      </div>

      <AnimatePresence>
        {lastResult && (
          <motion.div
            key={lastResult.playerId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center text-sm text-[var(--color-text-muted)]"
          >
            Last sold: <span className="font-semibold text-[var(--color-text-primary)]">{lastResult.playerName}</span> → {labelFor(lastResult.winner)} for ${lastResult.price}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function WaitingRoom({ gameId, error }: { gameId: string; error: string | null }) {
  const [copied, setCopied] = useState(false)
  const link = typeof window !== "undefined" ? `${window.location.origin}/arena/${gameId}` : ""
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-16 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--color-lime)]" />
      <h2 className="text-2xl font-black text-[var(--color-text-primary)]">Waiting for opponent…</h2>
      <p className="text-sm text-[var(--color-text-muted)]">Share this link. When they open it and join, the auction begins for both of you.</p>
      <div className="flex w-full items-center gap-2 rounded-xl border border-[var(--color-border)] bg-black/30 p-2">
        <input readOnly value={link} className="flex-1 truncate bg-transparent px-2 text-xs text-[var(--color-text-primary)] outline-none" />
        <Button
          size="sm"
          onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
