"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Users, ChevronRight, Bot } from "lucide-react"
import { bidIncrementForBudget } from "@/lib/arena/types"
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
import type { AIDifficulty, BudgetPreset, Season, TeamId } from "@/lib/arena/types"
import { BUDGET_PRESETS } from "@/lib/arena/types"
import { AVAILABLE_SEASONS } from "@/lib/arena/data"
import { cn } from "@/lib/utils"

const DIFFICULTIES: { id: AIDifficulty; label: string; blurb: string }[] = [
  { id: "easy", label: "Easy", blurb: "Makes mistakes, bids soft" },
  { id: "medium", label: "Medium", blurb: "Solid, balanced drafter" },
  { id: "hard", label: "Hard", blurb: "Sharp value, plays tough" },
]

const BUDGET_META: Record<BudgetPreset, { label: string; sub: string }> = {
  25: { label: "$25", sub: "Rookie League" },
  50: { label: "$50", sub: "Pro League" },
  100: { label: "$100", sub: "All-Star League" },
}

const P1_LABEL = "You"
const P2_LABEL = "CPU"

export default function ArenaClient() {
  const game = useArenaGame()
  const server = useArenaServer()
  const [budget, setBudget] = useState<BudgetPreset>(25)
  const [season, setSeason] = useState<Season>(AVAILABLE_SEASONS[0])
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium")
  const [mode, setMode] = useState<"ai" | "human">("ai")
  const { state, result } = game
  const serverLabelFor = (seat: TeamId) => (seat === server.viewer ? "You" : "Opponent")

  if (server.view) return <ServerArena server={server} labelFor={serverLabelFor} />

  if (!state) {
    return (
      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-4 py-10 pb-40 md:pb-10">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-64 w-[120%] -translate-x-1/2 rounded-full bg-[var(--color-lime)]/10 blur-[120px]" />
        <div className="relative text-center">
          <span className="text-xs font-bold uppercase tracking-[0.4em] text-[var(--color-lime)]">Lasyly Arena</span>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-5xl">NBA <span className="text-[var(--color-lime)]">Auction</span></h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-muted)]">Win a live bidding war for 6 players, then watch your squad battle it out.</p>
        </div>
        <Section step={1} title="Choose your opponent"><div className="grid grid-cols-2 gap-3"><ModeCard active={mode === "ai"} onClick={() => setMode("ai")} icon={<Bot className="h-6 w-6" />} title="vs CPU" sub="Play solo against the AI" /><ModeCard active={mode === "human"} onClick={() => setMode("human")} icon={<Users className="h-6 w-6" />} title="vs Player" sub="Invite a friend to a live 1v1" /></div></Section>
        {mode === "ai" && <Section step={2} title="Difficulty"><div className="grid grid-cols-3 gap-3">{DIFFICULTIES.map((item) => <SelectCard key={item.id} active={difficulty === item.id} onClick={() => setDifficulty(item.id)} title={item.label} sub={item.blurb} />)}</div></Section>}
        <Section step={mode === "ai" ? 3 : 2} title="Pick your league">
          <div className="grid grid-cols-3 gap-3">{BUDGET_PRESETS.map((item) => <button key={item} type="button" aria-pressed={budget === item} onClick={() => setBudget(item)} className={cn("group relative overflow-hidden rounded-2xl border p-5 text-center transition-all", budget === item ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 shadow-[0_0_40px_-14px_rgba(212,255,0,0.6)]" : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]")}><span className={cn("text-3xl font-black", budget === item ? "text-[var(--color-lime)]" : "text-[var(--color-text-primary)]")}>{BUDGET_META[item].label}</span><span className="mt-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">{BUDGET_META[item].sub}</span></button>)}</div>
          <p className="mt-2 text-center text-[11px] text-[var(--color-text-muted)]">Player prices scale to your league. Bids go up in ${bidStep(budget)} steps.</p>
        </Section>
        {AVAILABLE_SEASONS.length > 1 && <Section step={mode === "ai" ? 4 : 3} title="Season"><div className="flex gap-2">{AVAILABLE_SEASONS.map((item) => <Chip key={item} active={season === item} onClick={() => setSeason(item)}>{item}</Chip>)}</div></Section>}
        {server.error && <p className="text-center text-sm text-[var(--color-danger)]">{server.error}</p>}
        <div className="sticky bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-10 md:bottom-4"><Button size="lg" className="w-full rounded-2xl py-6 text-lg font-black shadow-[0_10px_40px_-10px_rgba(212,255,0,0.5)]" disabled={server.connecting} onClick={() => { if (mode === "ai") game.start({ season, budget, difficulty }); else server.create({ season, budget, difficulty, mode: "human" }) }}>{mode === "ai" ? "Start Draft" : "Create 1v1 Game"} <ChevronRight className="ml-1 h-5 w-5" /></Button></div>
      </div>
    )
  }

  if (state.status === "simulating" && result) return <SimulationScreen result={result} p1Label={P1_LABEL} p2Label={P2_LABEL} onDone={game.finishSimulation} />
  if (state.status === "complete" && result) return <GameSummary result={result} humanSeat={game.humanSeat} p1Label={P1_LABEL} p2Label={P2_LABEL} onRematch={() => game.start({ season, budget, difficulty })} onNewAuction={game.reset} onExit={game.reset} />

  if (state.status === "lineup") {
    return <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-10 pb-40 md:pb-10"><h2 className="text-3xl font-black text-[var(--color-text-primary)]">Rosters set</h2><p className="text-sm text-[var(--color-text-muted)]">Lineups are locked. Ready to run the game?</p><div className="grid w-full gap-4 md:grid-cols-2">{game.budgets && <><BudgetPanel team="P1" label={P1_LABEL} budget={game.budgets.P1} roster={state.rosters.P1} /><BudgetPanel team="P2" label={P2_LABEL} budget={game.budgets.P2} roster={state.rosters.P2} isAI /></>}</div><Button size="lg" className="font-black" onClick={game.simulate}>Start simulation</Button></div>
  }

  const lot = state.lot
  const timeSec = Math.ceil(game.timeLeft / 1000)
  return (
    <div className="relative mx-auto max-w-[1280px] px-4 py-5 pb-40 md:px-6 md:pb-8">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.83fr)_minmax(24rem,1.32fr)_minmax(0,0.83fr)] lg:gap-5">
        <div className="order-2 lg:order-1 lg:pt-1">{game.budgets && <BudgetPanel team="P1" label={P1_LABEL} budget={game.budgets.P1} roster={state.rosters.P1} currentBid={lot?.currentBid} isHighBidder={lot?.highBidder === "P1"} />}</div>
        <main className="order-1 flex min-w-0 flex-col items-center gap-3 lg:order-2">
          {lot && <AuctionHeader lotNumber={state.results.length + 1} totalLots={state.results.length + state.queue.length} timeSec={timeSec} maxSec={state.config.auctionTimerSeconds} currentBid={lot.currentBid} status={lot.highBidder === "P1" ? { text: "You lead. CPU is deciding.", tone: "good" } : lot.highBidder === "P2" ? { text: "CPU leads. Your move.", tone: "warn" } : { text: "Opening bid. Make an offer.", tone: "neutral" }} />}
          <div className="relative w-full"><div className={cn("transition-[filter] duration-200", game.lastAward && "blur-[2px]")}><AnimatePresence mode="wait">{lot && <PlayerCard key={lot.player.id} player={lot.player} />}</AnimatePresence></div><AnimatePresence>{game.lastAward && <SoldStamp name={game.lastAward.name} winnerLabel={game.lastAward.winner === "P1" ? P1_LABEL : P2_LABEL} price={game.lastAward.price} />}</AnimatePresence></div>
          {lot && <div className="w-full"><BidControls state={state} humanSeat={game.humanSeat} minRaise={game.humanMinRaise} onBid={game.bid} onMax={game.bidMax} onPass={game.passLot} /></div>}
        </main>
        <div className="order-3 lg:pt-1">{game.budgets && <BudgetPanel team="P2" label={P2_LABEL} budget={game.budgets.P2} roster={state.rosters.P2} currentBid={lot?.currentBid} isHighBidder={lot?.highBidder === "P2"} isAI />}</div>
      </div>
    </div>
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

function bidStep(budget: number): number { return bidIncrementForBudget(budget) }
function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) { return <section className="relative flex flex-col gap-3"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-lime)] text-xs font-black text-black">{step}</span><h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)]">{title}</h2></div>{children}</section> }
function ModeCard({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) { return <button type="button" onClick={onClick} className={cn("flex items-center gap-3 rounded-2xl border p-4 text-left transition-all", active ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 shadow-[0_0_30px_-14px_rgba(212,255,0,0.6)]" : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]")}><span className={cn(active ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)]")}>{icon}</span><span><span className="block text-base font-black text-[var(--color-text-primary)]">{title}</span><span className="block text-[11px] text-[var(--color-text-muted)]">{sub}</span></span></button> }
function SelectCard({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) { return <button type="button" onClick={onClick} className={cn("rounded-2xl border p-4 text-center transition-all", active ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10" : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]")}><span className={cn("block text-base font-black", active ? "text-[var(--color-lime)]" : "text-[var(--color-text-primary)]")}>{title}</span><span className="mt-0.5 block text-[10px] text-[var(--color-text-muted)]">{sub}</span></button> }
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors", active ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]" : "border-[var(--color-border)] text-[var(--color-text-muted)]")}>{children}</button> }
