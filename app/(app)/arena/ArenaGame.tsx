"use client"

import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlayerCard } from "@/components/arena/PlayerCard"
import { BudgetPanel } from "@/components/arena/BudgetPanel"
import { BidControls } from "@/components/arena/BidControls"
import { SimulationScreen } from "@/components/arena/SimulationScreen"
import { GameSummary } from "@/components/arena/GameSummary"
import { SoldStamp } from "@/components/arena/SoldStamp"
import { useArenaGame } from "./useArenaGame"
import { useArenaServer } from "./useArenaServer"
import { ServerArena } from "./ServerArena"
import type { ArenaLaunch } from "./ArenaSetup"
import type { TeamId } from "@/lib/arena/types"
import { getSeasonPlayers } from "@/lib/arena/data"
import { cn } from "@/lib/utils"
import { Hourglass } from "lucide-react"

/**
 * Everything expensive about /arena/nba: the auction engine, the AI, the
 * simulation, the season player pool and framer-motion.
 *
 * ArenaClient imports this with next/dynamic so none of it is fetched until the
 * user commits to a game. Before the split all of it was a static import of the
 * single ArenaClient component, which meant the option-picker screen shipped
 * ~430 KB of gameplay code (383 KB of it the player pool alone) that most
 * visitors to the route never executed.
 */

const P1_LABEL = "You"
const P2_LABEL = "CPU"

export default function ArenaGame({
  launch,
  onExit,
}: {
  launch: ArenaLaunch
  /** Hands control back to the setup screen, optionally with an error to show. */
  onExit: (error?: string | null) => void
}) {
  const game = useArenaGame()
  const server = useArenaServer()
  const { state, result } = game
  const serverLabelFor = (seat: TeamId) => (seat === server.viewer ? "You" : "Opponent")

  // Fire the chosen game mode exactly once, on mount. The config is fixed for
  // the lifetime of this component — changing it means going back to setup.
  const launched = useRef(false)
  useEffect(() => {
    if (launched.current) return
    launched.current = true
    const { season, budget, difficulty, kind } = launch
    if (kind === "ai") game.start({ season, budget, difficulty })
    else if (kind === "global") server.matchmake({ season, budget, difficulty })
    else server.create({ season, budget, difficulty, mode: "human" })
    // `game` / `server` are stable-enough hook bags; re-running this would start
    // a second game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-run the simulation the moment both rosters are locked — no "Start
  // simulation" click. A short beat lets the "Rosters set" screen register
  // before the sim takes over. Guarded so it fires once per lineup phase.
  const autoSimFired = useRef(false)
  useEffect(() => {
    if (state?.status === "lineup" && !autoSimFired.current) {
      autoSimFired.current = true
      const t = setTimeout(() => game.simulate(), 1400)
      return () => clearTimeout(t)
    }
    if (state?.status !== "lineup") autoSimFired.current = false
  }, [state?.status, game])

  if (server.view) return <ServerArena server={server} labelFor={serverLabelFor} />

  // No local game and no server view yet. Previously the setup screen stayed on
  // screen through this window (it owned `server.connecting` / `server.error`);
  // now that setup is a separate chunk, this is where connecting and failure are
  // reported.
  if (!state) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-5 px-4 py-24 text-center">
        {server.error ? (
          <>
            <h2 className="text-xl font-black text-[var(--color-text-primary)]">Couldn&apos;t start that game</h2>
            <p className="text-sm text-[var(--color-danger)]">{server.error}</p>
            <Button variant="outline" onClick={() => onExit(server.error)}>Back to options</Button>
          </>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-lime)]" />
            <p className="text-sm font-semibold text-[var(--color-text-muted)]">
              {launch.kind === "global" ? "Finding you a match…" : launch.kind === "private" ? "Creating your room…" : "Building the auction…"}
            </p>
            <Button variant="ghost" size="sm" onClick={() => onExit(null)}>Cancel</Button>
          </>
        )}
      </div>
    )
  }

  if (state.status === "simulating" && result) return <SimulationScreen result={result} p1Label={P1_LABEL} p2Label={P2_LABEL} onDone={game.finishSimulation} />
  if (state.status === "complete" && result) return <GameSummary result={result} humanSeat={game.humanSeat} p1Label={P1_LABEL} p2Label={P2_LABEL} onRematch={() => game.start(launch)} onNewAuction={() => onExit(null)} onExit={() => onExit(null)} />

  if (state.status === "lineup") {
    return <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-10 pb-40 md:pb-10"><h2 className="text-3xl font-black text-[var(--color-text-primary)]">Rosters set</h2><p className="text-sm text-[var(--color-text-muted)]">Lineups are locked. Tipping off…</p><div className="grid w-full gap-4 md:grid-cols-2">{game.budgets && <><BudgetPanel team="P1" label={P1_LABEL} budget={game.budgets.P1} roster={state.rosters.P1} /><BudgetPanel team="P2" label={P2_LABEL} budget={game.budgets.P2} roster={state.rosters.P2} isAI /></>}</div><div className="flex items-center gap-2 text-sm font-bold text-[var(--color-lime)]"><Loader2 className="h-4 w-4 animate-spin" />Starting simulation…</div></div>
  }

  const lot = state.lot
  const timeSec = Math.ceil(game.timeLeft / 1000)
  return (
    <div className="relative mx-auto max-w-[1280px] px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 md:pb-16 lg:pb-8">
      {/* MOBILE — compact wallets side by side up top so balance stays visible
          while the card + bid buttons stay above the fold. Hidden on lg+. */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:hidden">
        {game.budgets && <BudgetPanel team="P1" label={P1_LABEL} budget={game.budgets.P1} roster={state.rosters.P1} currentBid={lot?.currentBid} isHighBidder={lot?.highBidder === "P1"} />}
        {game.budgets && <BudgetPanel team="P2" label={P2_LABEL} budget={game.budgets.P2} roster={state.rosters.P2} currentBid={lot?.currentBid} isHighBidder={lot?.highBidder === "P2"} isAI />}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.83fr)_minmax(24rem,1.32fr)_minmax(0,0.83fr)] lg:gap-5">
        <div className="hidden lg:order-1 lg:block lg:pt-1">{game.budgets && <BudgetPanel team="P1" label={P1_LABEL} budget={game.budgets.P1} roster={state.rosters.P1} currentBid={lot?.currentBid} isHighBidder={lot?.highBidder === "P1"} />}</div>
        <main className="order-1 flex min-w-0 flex-col items-center gap-3 lg:order-2">
          {lot && <AuctionHeader lotNumber={state.results.length + 1} totalLots={state.results.length + state.queue.length} timeSec={timeSec} maxSec={state.config.auctionTimerSeconds} currentBid={lot.currentBid} status={lot.highBidder === "P1" ? { text: "You lead. CPU is deciding.", tone: "good" } : lot.highBidder === "P2" ? { text: "CPU leads. Your move.", tone: "warn" } : { text: "Opening bid. Make an offer.", tone: "neutral" }} />}
          <div className="relative w-full"><div className={cn("transition-[filter] duration-200", game.lastAward && "blur-[2px]")}><AnimatePresence mode="wait">{lot && <PlayerCard key={lot.player.id} player={lot.player} />}</AnimatePresence></div><AnimatePresence>{game.lastAward && <SoldStamp name={game.lastAward.name} winnerLabel={game.lastAward.winner === "P1" ? P1_LABEL : P2_LABEL} price={game.lastAward.price} />}</AnimatePresence></div>
          {/* Bid controls flow inline like the mockup — no fixed overlay that
              clips the card or hides the queue bar. On lg+ this sits inside the
              center column. */}
          {lot && <div className="w-full"><BidControls state={state} humanSeat={game.humanSeat} minRaise={game.humanMinRaise} onBid={game.bid} onMax={game.bidMax} onPass={game.passLot} /></div>}
          {lot && <NextInQueue season={state.season} queue={state.queue} currentId={lot.player.id} />}
        </main>
        <div className="hidden lg:order-3 lg:block lg:pt-1">{game.budgets && <BudgetPanel team="P2" label={P2_LABEL} budget={game.budgets.P2} roster={state.rosters.P2} currentBid={lot?.currentBid} isHighBidder={lot?.highBidder === "P2"} isAI />}</div>
      </div>
    </div>
  )
}

/**
 * MOBILE-ONLY "up next" strip. `state.queue` holds the ids still to be
 * auctioned (the current lot is already popped off), so the head of the queue
 * — minus the current player, guarding the transient window where it hasn't
 * been removed yet — is the next lot, and the queue length is what's left. The
 * progress bar shows how far through the board we are. Hidden on lg+ where the
 * side rails already carry roster/budget context.
 */
function NextInQueue({ season, queue, currentId }: { season: Parameters<typeof getSeasonPlayers>[0]; queue: string[]; currentId: string }) {
  const remainingIds = queue.filter((id) => id !== currentId)
  const remaining = remainingIds.length
  if (remaining === 0) return null

  const pool = getSeasonPlayers(season)
  const next = pool.find((p) => p.id === remainingIds[0])
  if (!next) return null

  const positions = [next.primaryPosition, ...next.secondaryPositions].join(" / ")
  // Rough board progress: filled portion grows as the queue drains. Uses the
  // next player's overall as a light visual so the bar isn't static; purely
  // decorative, not a real metric.
  const pct = Math.max(0.08, Math.min(1, next.overall / 100))

  return (
    <section className="w-full rounded-[1.1rem] border border-white/[0.08] bg-[#11141e]/90 px-3.5 py-3 shadow-[0_14px_32px_rgba(0,0,0,0.16)] lg:hidden">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[#8f9ab0]">
          <Hourglass className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-[8px] font-semibold uppercase tracking-[0.15em] text-[#8f9ab0]">Next in queue</span>
          <strong className="block truncate text-sm font-black text-[#f4f6fb]">{next.name}</strong>
        </div>
        <span className="shrink-0 text-[10px] font-semibold text-[#8f9ab0]">{remaining} remaining</span>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.span className="block h-full rounded-full bg-[#7c6bff]" initial={{ scaleX: 0 }} animate={{ scaleX: pct }} transition={{ duration: 0.4 }} style={{ transformOrigin: "left" }} />
        </div>
        <span className="shrink-0 text-[9px] font-medium text-[#8f9ab0]">{positions}</span>
      </div>
    </section>
  )
}

function AuctionHeader({ lotNumber, totalLots, timeSec, maxSec, currentBid, status }: { lotNumber: number; totalLots: number; timeSec: number; maxSec: number; currentBid: number; status: { text: string; tone: "good" | "warn" | "neutral" } }) {
  const pct = Math.max(0, Math.min(1, timeSec / maxSec))
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const urgent = timeSec <= 3
  const ringColor = urgent ? "var(--color-danger)" : "#d4ff00"
  const toneColor = status.tone === "good" ? "#d4ff00" : status.tone === "warn" ? "#f3c66e" : "#aab4c6"
  return <section className="flex w-full items-center gap-3 rounded-[1.1rem] border border-white/[0.08] bg-[#11141e]/90 px-3.5 py-3 shadow-[0_14px_32px_rgba(0,0,0,0.16)]"><div className="relative h-12 w-12 shrink-0"><svg viewBox="0 0 56 56" className="h-12 w-12 -rotate-90"><circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="4" /><motion.circle cx="28" cy="28" r={radius} fill="none" stroke={ringColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} animate={{ strokeDashoffset: circumference * (1 - pct) }} transition={{ ease: "linear", duration: 0.1 }} /></svg><span className={cn("absolute inset-0 grid place-items-center text-base font-black tabular-nums", urgent ? "text-[var(--color-danger)]" : "text-[#f4f6fb]")}>{timeSec}</span></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3 text-[8px] font-semibold uppercase tracking-[0.15em] text-[#8f9ab0]"><span>Lot {lotNumber} / {totalLots}</span><span>Current bid</span></div><div className="mt-1 flex items-end justify-between gap-3"><strong className="truncate text-xs font-bold" style={{ color: toneColor }}>{status.text}</strong><motion.span key={currentBid} initial={{ scale: 1.18 }} animate={{ scale: 1 }} className="text-xl font-black leading-none tabular-nums text-[#d4ff00]">${currentBid}</motion.span></div></div></section>
}
