"use client"

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
import { PlayerVersusCard } from "@/components/arena/PlayerVersusCard"
import type { ArenaServerView } from "@/lib/arena/server"
import type { ArenaState } from "@/lib/arena/auction"
import type { TeamId } from "@/lib/arena/types"
import { useArenaServer } from "./useArenaServer"
import { cn, formatMoney } from "@/lib/utils"

function asState(view: ArenaServerView): ArenaState {
  return { gameId: view.gameId, seed: 0, season: view.season, config: view.config, status: view.status, queue: [], lot: view.lot, passed: view.passed, rosters: view.rosters, isAI: view.isAI, history: [], results: view.results, lotDeadline: view.lotDeadline, completedAt: view.completedAt }
}

export function ServerArena({ server, labelFor }: { server: ReturnType<typeof useArenaServer>; labelFor: (seat: TeamId) => string }) {
  const { view, viewer, error } = server
  const [timeLeft, setTimeLeft] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [justSold, setJustSold] = useState<{ name: string; winner: TeamId; price: number } | null>(null)
  const deadlineRef = useRef<number | null>(null)
  const soldCount = useRef(0)
  const soldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasInitialResults = useRef(false)

  useEffect(() => {
    const results = view?.results ?? []
    if (!hasInitialResults.current) {
      soldCount.current = results.length
      hasInitialResults.current = true
      return
    }
    if (results.length <= soldCount.current) return
    soldCount.current = results.length
    const last = results[results.length - 1]
    setJustSold({ name: last.playerName, winner: last.winner, price: last.price })
    if (soldTimer.current) clearTimeout(soldTimer.current)
    soldTimer.current = setTimeout(() => setJustSold(null), 1600)
  }, [view?.results])
  useEffect(() => () => { if (soldTimer.current) clearTimeout(soldTimer.current) }, [])
  useEffect(() => { deadlineRef.current = view?.lotDeadline ?? null }, [view?.lotDeadline])
  useEffect(() => { const id = setInterval(() => { const deadline = deadlineRef.current; setTimeLeft(deadline ? Math.max(0, deadline - Date.now()) : 0) }, 100); return () => clearInterval(id) }, [])

  // Auto-run the simulation once both rosters lock — no manual "Start" click.
  // Only the owner (P1) fires it to avoid both clients racing; startSimulation
  // is idempotent server-side anyway, so a double call is harmless.
  const autoSimFired = useRef(false)
  useEffect(() => {
    if (view?.status === "lineup" && viewer === "P1" && !autoSimFired.current) {
      autoSimFired.current = true
      const t = setTimeout(() => server.simulate(), 1400)
      return () => clearTimeout(t)
    }
    if (view?.status !== "lineup") autoSimFired.current = false
  }, [view?.status, viewer, server])

  const opponent: TeamId = viewer === "P1" ? "P2" : "P1"
  const state = useMemo(() => (view ? asState(view) : null), [view])
  const timeSec = Math.ceil(timeLeft / 1000)

  if (!view || !state) return <div className="flex items-center justify-center py-20 text-[var(--color-text-muted)]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Connecting…</div>
  if (view.status === "lobby") return <WaitingRoom gameId={view.gameId} error={error} isPublic={server.isPublicLobby} />
  if (view.status === "complete" && view.result) return !revealed ? <SimulationScreen result={view.result} p1Label={labelFor("P1")} p2Label={labelFor("P2")} onDone={() => setRevealed(true)} /> : <GameSummary result={view.result} humanSeat={viewer} p1Label={labelFor("P1")} p2Label={labelFor("P2")} onRematch={server.reset} onNewAuction={server.reset} onExit={server.reset} />
  if (view.status === "lineup") return <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-10 pb-40 md:pb-10"><h2 className="text-3xl font-black text-[var(--color-text-primary)]">Rosters set</h2><p className="text-sm text-[var(--color-text-muted)]">Both lineups are locked. Tipping off…</p><div className="grid w-full gap-4 md:grid-cols-2"><BudgetPanel team="P1" label={labelFor("P1")} budget={view.budgets.P1} roster={view.rosters.P1} isAI={view.isAI.P1} /><BudgetPanel team="P2" label={labelFor("P2")} budget={view.budgets.P2} roster={view.rosters.P2} isAI={view.isAI.P2} /></div><div className="flex items-center gap-2 text-sm font-bold text-[var(--color-lime)]"><Loader2 className="h-4 w-4 animate-spin" />Starting simulation…</div></div>

  const lot = view.lot
  const lastResult = view.results[view.results.length - 1]
  const pct = Math.max(0, Math.min(1, timeSec / view.config.auctionTimerSeconds))
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const urgent = timeSec <= 3
  const tone = lot?.highBidder === viewer ? "#d4ff00" : lot?.highBidder ? "#f3c66e" : "#aab4c6"
  const status = lot?.highBidder === viewer ? "You lead. Opponent is deciding." : lot?.highBidder ? `${labelFor(opponent)} leads. Your move.` : "Opening bid. Make an offer."

  return <div className="relative mx-auto max-w-[1280px] px-4 py-5 pb-[19rem] md:px-6 md:pb-40 lg:pb-8">{error && <div className="mt-3 rounded-lg bg-[var(--color-danger)]/10 px-3 py-2 text-center text-sm text-[var(--color-danger)]">{error}</div>}<PlayerVersusCard gameId={view.gameId} viewerSeat={viewer} className="mb-4" /><div className="mb-4 grid grid-cols-2 gap-3 lg:hidden"><BudgetPanel team={viewer} label={labelFor(viewer)} budget={view.budgets[viewer]} roster={view.rosters[viewer]} currentBid={lot?.currentBid} isHighBidder={lot?.highBidder === viewer} /><BudgetPanel team={opponent} label={labelFor(opponent)} budget={view.budgets[opponent]} roster={view.rosters[opponent]} currentBid={lot?.currentBid} isHighBidder={lot?.highBidder === opponent} isAI={view.isAI[opponent]} /></div><div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.83fr)_minmax(24rem,1.32fr)_minmax(0,0.83fr)] lg:gap-5"><div className="hidden lg:order-1 lg:block lg:pt-1"><BudgetPanel team={viewer} label={labelFor(viewer)} budget={view.budgets[viewer]} roster={view.rosters[viewer]} currentBid={lot?.currentBid} isHighBidder={lot?.highBidder === viewer} /></div><main className="order-1 flex min-w-0 flex-col items-center gap-3 lg:order-2">{lot && <section className="flex w-full items-center gap-3 rounded-[1.1rem] border border-white/[0.08] bg-[#11141e]/90 px-3.5 py-3 shadow-[0_14px_32px_rgba(0,0,0,0.16)]"><div className="relative h-12 w-12 shrink-0"><svg viewBox="0 0 56 56" className="h-12 w-12 -rotate-90"><circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="4" /><motion.circle cx="28" cy="28" r={radius} fill="none" stroke={urgent ? "var(--color-danger)" : "#d4ff00"} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} animate={{ strokeDashoffset: circumference * (1 - pct) }} transition={{ ease: "linear", duration: 0.1 }} /></svg><span className={cn("absolute inset-0 grid place-items-center text-base font-black tabular-nums", urgent ? "text-[var(--color-danger)]" : "text-[#f4f6fb]")}>{timeSec}</span></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3 text-[8px] font-semibold uppercase tracking-[0.15em] text-[#8f9ab0]"><span>Lot {view.results.length + 1}</span><span>Current bid</span></div><div className="mt-1 flex items-end justify-between gap-3"><strong className="truncate text-xs font-bold" style={{ color: tone }}>{status}</strong><span className="text-xl font-black leading-none tabular-nums text-[#d4ff00]">${formatMoney(lot.currentBid)}</span></div></div></section>}<div className="relative w-full"><div className={cn("transition-[filter] duration-200", justSold && "blur-[2px]")}><AnimatePresence mode="wait">{lot && <PlayerCard key={lot.player.id} player={lot.player} />}</AnimatePresence></div><AnimatePresence>{justSold && <SoldStamp name={justSold.name} winnerLabel={labelFor(justSold.winner)} price={justSold.price} />}</AnimatePresence></div>{lot && <div className="fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-20 border-t border-white/10 bg-[var(--color-background)]/95 px-4 pb-3 pt-3 backdrop-blur-xl md:bottom-0 md:pb-[calc(1rem+env(safe-area-inset-bottom))] lg:static lg:z-auto lg:w-full lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"><div className="mx-auto w-full max-w-md lg:max-w-none"><BidControls state={state} humanSeat={viewer} minRaise={view.minRaise[viewer]} onBid={server.bid} onMax={() => { const max = view.budgets[viewer].maxAffordable; if (max > (lot?.currentBid ?? 0)) server.bid(max) }} onPass={() => server.pass()} /></div></div>}</main><div className="hidden lg:order-3 lg:block lg:pt-1"><BudgetPanel team={opponent} label={labelFor(opponent)} budget={view.budgets[opponent]} roster={view.rosters[opponent]} currentBid={lot?.currentBid} isHighBidder={lot?.highBidder === opponent} isAI={view.isAI[opponent]} /></div></div><AnimatePresence>{lastResult && <motion.p key={lastResult.playerId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center text-sm text-[var(--color-text-muted)]">Last sold: <span className="font-semibold text-[var(--color-text-primary)]">{lastResult.playerName}</span> to {labelFor(lastResult.winner)} for ${formatMoney(lastResult.price)}</motion.p>}</AnimatePresence></div>
}

function WaitingRoom({ gameId, error, isPublic }: { gameId: string; error: string | null; isPublic: boolean }) {
  const [copied, setCopied] = useState(false)
  const link = typeof window !== "undefined" ? `${window.location.origin}/arena/${gameId}` : ""

  // Public matchmaking: no link to share — we're just waiting for the queue to
  // pair us with someone. The client keeps polling; when a stranger joins, the
  // status flips to "auction" and this screen is replaced automatically.
  if (isPublic) {
    return <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--color-lime)]" /><h2 className="text-2xl font-black text-[var(--color-text-primary)]">Finding an opponent…</h2><p className="text-sm text-[var(--color-text-muted)]">Hang tight while we pair you with another player. The auction starts the moment someone joins.</p>{error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}</div>
  }

  return <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--color-lime)]" /><h2 className="text-2xl font-black text-[var(--color-text-primary)]">Waiting for opponent…</h2><p className="text-sm text-[var(--color-text-muted)]">Share this link. The auction begins when your opponent joins.</p><div className="flex w-full items-center gap-2 rounded-xl border border-[var(--color-border)] bg-black/30 p-2"><input readOnly value={link} className="flex-1 truncate bg-transparent px-2 text-xs text-[var(--color-text-primary)] outline-none" /><Button size="sm" onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button></div>{error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}</div>
}
