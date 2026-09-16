"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronRight, Bot, Gauge, Trophy, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NflPlayerCard } from "@/components/nfl/NflPlayerCard"
import { NflBudgetPanel } from "@/components/nfl/NflBudgetPanel"
import { NflBidControls } from "@/components/nfl/NflBidControls"
import { NflSimulationScreen } from "@/components/nfl/NflSimulationScreen"
import { NflGameSummary } from "@/components/nfl/NflGameSummary"
import { NflSoldStamp } from "@/components/nfl/NflSoldStamp"
import { useNflGame } from "./useNflGame"
import type { AIDifficulty, BudgetPreset, Season } from "@/lib/nfl/types"
import { BUDGET_PRESETS, bidIncrementForBudget } from "@/lib/nfl/types"
import { AVAILABLE_SEASONS } from "@/lib/nfl/data"
import { cn, formatMoney } from "@/lib/utils"

const DIFFICULTIES: { id: AIDifficulty; label: string; blurb: string }[] = [
  { id: "easy", label: "Easy", blurb: "Loose bids, makes mistakes" },
  { id: "medium", label: "Medium", blurb: "Balanced, solid drafter" },
  { id: "hard", label: "Hard", blurb: "Sharp value, plays tough" },
]

const BUDGET_META: Record<BudgetPreset, { label: string; sub: string }> = {
  25: { label: "$25", sub: "Rookie League" },
  50: { label: "$50", sub: "Pro League" },
  100: { label: "$100", sub: "All-Pro League" },
}

// The CPU's on-screen identity per difficulty — makes bot behavior legible
// without changing any decision logic (that stays in lib/nfl/ai.ts).
const CPU_IDENTITY: Record<AIDifficulty, { name: string; persona: string }> = {
  easy: { name: "The Gambler", persona: "Aggressive · overspends" },
  medium: { name: "The Strategist", persona: "Balanced · protects roster" },
  hard: { name: "The Closer", persona: "Value hunter · ruthless" },
}

const P1_LABEL = "You"

export default function NflClient() {
  const game = useNflGame()
  const [budget, setBudget] = useState<BudgetPreset>(25)
  const [season, setSeason] = useState<Season>(AVAILABLE_SEASONS[0])
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium")

  const { state, result } = game
  const cpu = CPU_IDENTITY[difficulty]
  const p2Label = cpu.name

  // ── LANDING / LOBBY ────────────────────────────────────────────────────
  if (!state) {
    return (
      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-4 py-10 pb-40 md:pb-10">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-64 w-[120%] -translate-x-1/2 rounded-full bg-[var(--color-lime)]/10 blur-[120px]" />

        {/* Hero */}
        <div className="relative text-center">
          <span className="text-xs font-bold uppercase tracking-[0.4em] text-[var(--color-lime)]">Lasyly Gridiron</span>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-5xl">
            NFL <span className="text-[var(--color-lime)]">Auction</span>
          </h1>
          <p className="mt-3 text-lg font-black uppercase tracking-tight text-[var(--color-text-primary)] sm:text-xl">
            Build your squad. Outplay the league.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-muted)]">
            Win a live bidding war for 9 players — 5 on offense, 4 on defense — then send your roster to battle.
          </p>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-3">
          <HowStep icon={<Bot className="h-5 w-5" />} step="Bid" text="Outbid the CPU for stars & sleepers" />
          <HowStep icon={<ClipboardList className="h-5 w-5" />} step="Build" text="Fill every offense & defense slot" />
          <HowStep icon={<Trophy className="h-5 w-5" />} step="Dominate" text="Simulate the game & grab the grade" />
        </div>

        {/* STEP 1 — Difficulty / opponent */}
        <Section step={1} title="Choose your opponent">
          <div className="grid grid-cols-3 gap-3">
            {DIFFICULTIES.map((d) => (
              <SelectCard
                key={d.id}
                active={difficulty === d.id}
                onClick={() => setDifficulty(d.id)}
                title={d.label}
                sub={d.blurb}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white/[0.03] px-3 py-2">
            <Bot className="h-4 w-4 text-[var(--color-primary)]" />
            <span className="text-xs text-[var(--color-text-muted)]">
              You&apos;ll face <span className="font-bold text-[var(--color-text-primary)]">{cpu.name}</span> — {cpu.persona}
            </span>
          </div>
        </Section>

        {/* STEP 2 — Budget / league */}
        <Section step={2} title="Pick your league">
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
            Player prices scale to your league — everyone&apos;s affordable. Bids rise in ${bidIncrementForBudget(budget)} steps.
          </p>
        </Section>

        {AVAILABLE_SEASONS.length > 1 && (
          <Section step={3} title="Season">
            <div className="flex gap-2">
              {AVAILABLE_SEASONS.map((s) => (
                <Chip key={s} active={season === s} onClick={() => setSeason(s)}>{s}</Chip>
              ))}
            </div>
          </Section>
        )}

        <div className="sticky bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-10 md:bottom-4">
          <Button
            size="lg"
            className="w-full rounded-2xl py-6 text-lg font-black shadow-[0_10px_40px_-10px_rgba(212,255,0,0.5)]"
            onClick={() => game.start({ season, budget, difficulty })}
          >
            Start Auction <ChevronRight className="ml-1 h-5 w-5" />
          </Button>
        </div>
      </div>
    )
  }

  // ── SIMULATION ─────────────────────────────────────────────────────────
  if (state.status === "simulating" && result) {
    return (
      <NflSimulationScreen
        result={result}
        p1Label={P1_LABEL}
        p2Label={p2Label}
        onDone={game.finishSimulation}
      />
    )
  }

  // ── RESULTS ────────────────────────────────────────────────────────────
  if (state.status === "complete" && result) {
    return (
      <NflGameSummary
        result={result}
        humanSeat={game.humanSeat}
        rosters={state.rosters}
        budget={state.config.budgetPerPlayer}
        rosterSize={state.config.rosterSize}
        p1Label={P1_LABEL}
        p2Label={p2Label}
        onRematch={() => game.start({ season, budget, difficulty })}
        onNewAuction={() => game.reset()}
        onExit={() => game.reset()}
      />
    )
  }

  // ── LINEUP CONFIRM ───────────────────────────────────────────────────────
  if (state.status === "lineup") {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-10 pb-40 md:pb-10">
        <h2 className="text-3xl font-black text-[var(--color-text-primary)]">Rosters Set</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Both squads are locked. Ready for kickoff?</p>
        <div className="grid w-full gap-4 md:grid-cols-2">
          {game.budgets && (
            <>
              <NflBudgetPanel team="P1" label={P1_LABEL} budget={game.budgets.P1} roster={state.rosters.P1} />
              <NflBudgetPanel team="P2" label={p2Label} budget={game.budgets.P2} roster={state.rosters.P2} isAI personaLabel={cpu.persona} />
            </>
          )}
        </div>
        <Button size="lg" className="font-black" onClick={game.simulate}>
          <Gauge className="mr-2 h-5 w-5" /> Kick Off
        </Button>
      </div>
    )
  }

  // ── AUCTION ────────────────────────────────────────────────────────────
  const lot = state.lot
  const timeSec = Math.ceil(game.timeLeft / 1000)
  return (
    <div className="relative mx-auto max-w-6xl px-4 py-6 pb-40 lg:pb-6">
      {/* MOBILE — the two roster panels sit side by side up top in compact form
          so the player card and bid buttons stay above the fold. On lg+ this row
          is hidden and the panels render in the 3-column grid below instead. */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:hidden">
        {game.budgets && (
          <NflBudgetPanel
            team="P1"
            label={P1_LABEL}
            budget={game.budgets.P1}
            roster={state.rosters.P1}
            currentBid={lot?.currentBid}
            isHighBidder={lot?.highBidder === "P1"}
          />
        )}
        {game.budgets && (
          <NflBudgetPanel
            team="P2"
            label={p2Label}
            budget={game.budgets.P2}
            roster={state.rosters.P2}
            currentBid={lot?.currentBid}
            isHighBidder={lot?.highBidder === "P2"}
            isAI
            personaLabel={cpu.persona}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr_1fr]">
        {/* LEFT — You (lg+ only; mobile uses the compact row above) */}
        <div className="hidden lg:order-1 lg:block">
          {game.budgets && (
            <NflBudgetPanel
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
                  ? { text: `You're leading — ${cpu.name} deciding…`, tone: "good" }
                  : lot.highBidder === "P2"
                  ? { text: `${cpu.name} leads — your move`, tone: "warn" }
                  : { text: "On the clock — make an offer", tone: "neutral" }
              }
            />
          )}

          <div className="relative w-full max-w-md">
            <div className={cn("transition-[filter] duration-200", game.lastAward && "blur-[2px]")}>
              <AnimatePresence mode="wait">
                {lot && <NflPlayerCard key={lot.player.id} player={lot.player} />}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {game.lastAward && (
                <NflSoldStamp
                  name={game.lastAward.name}
                  winnerLabel={game.lastAward.winner === "P1" ? P1_LABEL : p2Label}
                  price={game.lastAward.price}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Bid controls: pinned to the bottom on mobile so you never have to
              scroll to bid mid-auction; inline within the center column on lg+. */}
          {lot && (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-background)]/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:static lg:z-auto lg:w-full lg:max-w-md lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
              <div className="mx-auto w-full max-w-md">
                <NflBidControls
                  state={state}
                  humanSeat={game.humanSeat}
                  minRaise={game.humanMinRaise}
                  onBid={game.bid}
                  onMax={game.bidMax}
                  onPass={game.passLot}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Opponent (lg+ only; mobile uses the compact row up top) */}
        <div className="hidden lg:order-3 lg:block">
          {game.budgets && (
            <NflBudgetPanel
              team="P2"
              label={p2Label}
              budget={game.budgets.P2}
              roster={state.rosters.P2}
              currentBid={lot?.currentBid}
              isHighBidder={lot?.highBidder === "P2"}
              isAI
              personaLabel={cpu.persona}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function AuctionHeader({
  lotNumber, totalLots, timeSec, maxSec, currentBid, status,
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

      <div className="flex flex-1 flex-col">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Lot {lotNumber} / {totalLots}</span>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Current Bid</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold" style={{ color: toneColor }}>{status.text}</span>
          <motion.span key={currentBid} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-2xl font-black tabular-nums text-[var(--color-lime)]">
            ${formatMoney(currentBid)}
          </motion.span>
        </div>
      </div>
    </div>
  )
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

function HowStep({ icon, step, text }: { icon: React.ReactNode; step: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4 text-center">
      <span className="text-[var(--color-lime)]">{icon}</span>
      <span className="text-sm font-black uppercase tracking-wide text-[var(--color-text-primary)]">{step}</span>
      <span className="text-[11px] leading-tight text-[var(--color-text-muted)]">{text}</span>
    </div>
  )
}

function SelectCard({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-center transition-all",
        active ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10" : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]"
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
