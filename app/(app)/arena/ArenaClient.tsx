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

  // If a server game is active, render the server-authoritative flow.
  if (server.view) {
    return <ServerArena server={server} labelFor={serverLabelFor} />
  }

  // ── LOBBY ────────────────────────────────────────────────────────────────
  if (!state) {
    return (
      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-4 py-10">
        {/* Ambient glow — game-menu vibe */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-64 w-[120%] -translate-x-1/2 rounded-full bg-[var(--color-lime)]/10 blur-[120px]" />

        <div className="relative text-center">
          <span className="text-xs font-bold uppercase tracking-[0.4em] text-[var(--color-lime)]">Lasyly Arena</span>
          <h1 className="mt-3 text-5xl font-black tracking-tight text-[var(--color-text-primary)]">
            NBA <span className="text-[var(--color-lime)]">Auction</span>
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-muted)]">
            Win a live bidding war for 6 players, then watch your squad battle it out.
          </p>
        </div>

        {/* STEP 1 — Opponent */}
        <Section step={1} title="Choose your opponent">
          <div className="grid grid-cols-2 gap-3">
            <ModeCard
              active={mode === "ai"} onClick={() => setMode("ai")}
              icon={<Bot className="h-6 w-6" />} title="vs CPU" sub="Play solo against the AI"
            />
            <ModeCard
              active={mode === "human"} onClick={() => setMode("human")}
              icon={<Users className="h-6 w-6" />} title="vs Player" sub="Invite a friend to a live 1v1"
            />
          </div>
        </Section>

        {/* STEP 2 — Difficulty (CPU only) */}
        {mode === "ai" && (
          <Section step={2} title="Difficulty">
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTIES.map((d) => (
                <SelectCard
                  key={d.id} active={difficulty === d.id} onClick={() => setDifficulty(d.id)}
                  title={d.label} sub={d.blurb}
                />
              ))}
            </div>
          </Section>
        )}

        {/* STEP 3 — League / budget */}
        <Section step={mode === "ai" ? 3 : 2} title="Pick your league">
          <div className="grid grid-cols-3 gap-3">
            {BUDGET_PRESETS.map((b) => (
              <button
                key={b}
                onClick={() => setBudget(b)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border p-5 text-center transition-all",
                  budget === b
                    ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 shadow-[0_0_40px_-14px_rgba(212,255,0,0.6)]"
                    : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]"
                )}
              >
                <div className={cn("text-3xl font-black", budget === b ? "text-[var(--color-lime)]" : "text-[var(--color-text-primary)]")}>
                  {BUDGET_META[b].label}
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                  {BUDGET_META[b].sub}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-[var(--color-text-muted)]">
            Player prices scale to your league — everyone&apos;s affordable. Bids go up in ${bidStep(budget)} steps.
          </p>
        </Section>

        {AVAILABLE_SEASONS.length > 1 && (
          <Section step={mode === "ai" ? 4 : 3} title="Season">
            <div className="flex gap-2">
              {AVAILABLE_SEASONS.map((s) => (
                <Chip key={s} active={season === s} onClick={() => setSeason(s)}>{s}</Chip>
              ))}
            </div>
          </Section>
        )}

        {server.error && <p className="text-center text-sm text-[var(--color-danger)]">{server.error}</p>}

        <div className="sticky bottom-4 z-10">
          <Button
            size="lg"
            className="w-full rounded-2xl py-6 text-lg font-black shadow-[0_10px_40px_-10px_rgba(212,255,0,0.5)]"
            disabled={server.connecting}
            onClick={() => {
              if (mode === "ai") {
                game.start({ season, budget, difficulty })
              } else {
                server.create({ season, budget, difficulty, mode: "human" })
              }
            }}
          >
            {mode === "ai" ? "Start Draft" : "Create 1v1 Game"} <ChevronRight className="ml-1 h-5 w-5" />
          </Button>
        </div>
      </div>
    )
  }

  // ── SIMULATION ─────────────────────────────────────────────────────────
  if (state.status === "simulating" && result) {
    return (
      <SimulationScreen
        result={result}
        p1Label={P1_LABEL}
        p2Label={P2_LABEL}
        onDone={game.finishSimulation}
      />
    )
  }

  // ── RESULTS ────────────────────────────────────────────────────────────
  if (state.status === "complete" && result) {
    return (
      <GameSummary
        result={result}
        humanSeat={game.humanSeat}
        p1Label={P1_LABEL}
        p2Label={P2_LABEL}
        onRematch={() => game.start({ season, budget, difficulty })}
        onNewAuction={() => game.reset()}
        onExit={() => game.reset()}
      />
    )
  }

  // ── LINEUP CONFIRM ───────────────────────────────────────────────────────
  if (state.status === "lineup") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-10">
        <h2 className="text-3xl font-black text-[var(--color-text-primary)]">Rosters Set</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Lineups are locked. Ready to run the game?</p>
        <div className="grid w-full gap-4 md:grid-cols-2">
          {game.budgets && (
            <>
              <BudgetPanel team="P1" label={P1_LABEL} budget={game.budgets.P1} roster={state.rosters.P1} />
              <BudgetPanel team="P2" label={P2_LABEL} budget={game.budgets.P2} roster={state.rosters.P2} isAI />
            </>
          )}
        </div>
        <Button size="lg" className="font-black" onClick={game.simulate}>Start Simulation</Button>
      </div>
    )
  }

  // ── AUCTION ────────────────────────────────────────────────────────────
  const lot = state.lot
  const timeSec = Math.ceil(game.timeLeft / 1000)
  return (
    <div className="relative mx-auto max-w-6xl px-4 py-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr_1fr]">
        {/* LEFT — You */}
        <div className="order-2 lg:order-1">
          {game.budgets && (
            <BudgetPanel
              team="P1"
              label={P1_LABEL}
              budget={game.budgets.P1}
              roster={state.rosters.P1}
              currentBid={lot?.currentBid}
              isHighBidder={lot?.highBidder === "P1"}
            />
          )}
        </div>

        {/* CENTER — Card + controls */}
        <div className="order-1 flex flex-col items-center gap-4 lg:order-2">
          {lot && (
            <AuctionHeader
              lotNumber={state.results.length + 1}
              totalLots={state.results.length + state.queue.length}
              timeSec={timeSec}
              maxSec={state.config.auctionTimerSeconds}
              currentBid={lot.currentBid}
              status={
                lot.highBidder === "P1"
                  ? { text: "You're leading — CPU deciding…", tone: "good" }
                  : lot.highBidder === "P2"
                  ? { text: "CPU leads — your move", tone: "warn" }
                  : { text: "Opening bid — make an offer", tone: "neutral" }
              }
            />
          )}

          {/* Player card + card-scoped SOLD stamp */}
          <div className="relative w-full max-w-md">
            <div className={cn("transition-[filter] duration-200", game.lastAward && "blur-[2px]")}>
              <AnimatePresence mode="wait">
                {lot && <PlayerCard key={lot.player.id} player={lot.player} />}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {game.lastAward && (
                <SoldStamp
                  name={game.lastAward.name}
                  winnerLabel={game.lastAward.winner === "P1" ? P1_LABEL : P2_LABEL}
                  price={game.lastAward.price}
                />
              )}
            </AnimatePresence>
          </div>

          {lot && (
            <div className="w-full max-w-md">
              <BidControls
                state={state}
                humanSeat={game.humanSeat}
                minRaise={game.humanMinRaise}
                onBid={game.bid}
                onMax={game.bidMax}
                onPass={game.passLot}
              />
            </div>
          )}
        </div>

        {/* RIGHT — Opponent */}
        <div className="order-3">
          {game.budgets && (
            <BudgetPanel
              team="P2"
              label={P2_LABEL}
              budget={game.budgets.P2}
              roster={state.rosters.P2}
              currentBid={lot?.currentBid}
              isHighBidder={lot?.highBidder === "P2"}
              isAI
            />
          )}
        </div>
      </div>
    </div>
  )
}

function AuctionHeader({
  lotNumber,
  totalLots,
  timeSec,
  maxSec,
  currentBid,
  status,
}: {
  lotNumber: number
  totalLots: number
  timeSec: number
  maxSec: number
  currentBid: number
  status: { text: string; tone: "good" | "warn" | "neutral" }
}) {
  const pct = Math.max(0, Math.min(1, timeSec / maxSec))
  const R = 26
  const C = 2 * Math.PI * R
  const urgent = timeSec <= 3
  const ringColor = urgent ? "var(--color-danger)" : "var(--color-lime)"
  const toneColor =
    status.tone === "good" ? "var(--color-lime)" : status.tone === "warn" ? "var(--color-warning)" : "var(--color-text-muted)"

  return (
    <div className="flex w-full max-w-md items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-4 py-3 backdrop-blur-xl">
      {/* Countdown ring */}
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
          <motion.circle
            cx="32" cy="32" r={R} fill="none" stroke={ringColor} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C * (1 - pct) }}
            transition={{ ease: "linear", duration: 0.1 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-lg font-black tabular-nums", urgent ? "text-[var(--color-danger)]" : "text-[var(--color-text-primary)]")}>
            {timeSec}
          </span>
        </div>
      </div>

      {/* Bid + status */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Lot {lotNumber} / {totalLots}</span>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Current Bid</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold" style={{ color: toneColor }}>{status.text}</span>
          <motion.span key={currentBid} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-2xl font-black tabular-nums text-[var(--color-lime)]">
            ${currentBid}
          </motion.span>
        </div>
      </div>
    </div>
  )
}

function bidStep(budget: number): number {
  return bidIncrementForBudget(budget)
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-lime)] text-xs font-black text-black">{step}</span>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function ModeCard({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-4 text-left transition-all",
        active
          ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 shadow-[0_0_30px_-14px_rgba(212,255,0,0.6)]"
          : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]"
      )}
    >
      <span className={cn(active ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)]")}>{icon}</span>
      <span>
        <span className="block text-base font-black text-[var(--color-text-primary)]">{title}</span>
        <span className="block text-[11px] text-[var(--color-text-muted)]">{sub}</span>
      </span>
    </button>
  )
}

function SelectCard({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-center transition-all",
        active
          ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10"
          : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]"
      )}
    >
      <div className={cn("text-base font-black", active ? "text-[var(--color-lime)]" : "text-[var(--color-text-primary)]")}>{title}</div>
      <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{sub}</div>
    </button>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
        active ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
      )}
    >
      {children}
    </button>
  )
}
