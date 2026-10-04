"use client"

import { useId, useRef, useState } from "react"
import Link from "next/link"
import { Users, ChevronRight, Bot, Link2, Globe, Info, Trophy, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
// Pure constants/math and pure request helpers only: both are tiny and engine-free.
import { MIN_STAKE, STAKE_PRESETS } from "@/lib/economy/arena"
import { stakeOptionState, stakeTerms } from "@/lib/arena/clientRequests"
import { useWalletBalance } from "./useWalletBalance"
import { bidIncrementForBudget, BUDGET_PRESETS } from "@/lib/arena/types"
import type { AIDifficulty, BudgetPreset, Season } from "@/lib/arena/types"
// Deliberately NOT "@/lib/arena/data" — that barrel pulls in the 383 KB player
// pool. See the header comment in lib/arena/seasons.ts.
import { AVAILABLE_SEASONS } from "@/lib/arena/seasons"
import { cn } from "@/lib/utils"

/**
 * The pre-game options screen for the NBA arena.
 *
 * This file exists so that the *entry* view of /arena/nba can be cheap. It has
 * no dependency on the auction engine, the simulation, the player pool or
 * framer-motion — all of which used to be static imports of the single
 * ArenaClient component and therefore downloaded before this screen could be
 * interacted with. Everything heavy now lives in ArenaGame.tsx, which
 * ArenaClient loads on demand once the user actually starts a game.
 *
 * Keep it that way: any import added here lands on the critical path of the
 * route.
 */

const DIFFICULTIES: { id: AIDifficulty; label: string; blurb: string; tone: string }[] = [
  { id: "easy", label: "Easy", blurb: "Makes mistakes, bids soft", tone: "text-emerald-400" },
  { id: "medium", label: "Medium", blurb: "Solid, balanced drafter", tone: "text-[var(--color-lime)]" },
  { id: "hard", label: "Hard", blurb: "Sharp value, plays tough", tone: "text-[var(--color-text-muted)]" },
]

const BUDGET_META: Record<BudgetPreset, { label: string; sub: string }> = {
  25: { label: "$25", sub: "Rookie League" },
  50: { label: "$50", sub: "Pro League" },
  100: { label: "$100", sub: "All-Star League" },
}

/** What the user picked, handed to ArenaGame to act on. */
export type ArenaLaunch = {
  season: Season
  budget: BudgetPreset
  difficulty: AIDifficulty
  /** "ai" runs the engine locally; the others are server-authoritative 1v1. */
  kind: "ai" | "private" | "global"
  /** Coins each player stakes in a 1v1. Ignored when `kind === "ai"`. */
  stake: number
}

export default function ArenaSetup({
  onLaunch,
  initialError,
}: {
  onLaunch: (launch: ArenaLaunch) => void
  /** Surfaced when a server game failed and we dropped back to this screen. */
  initialError?: string | null
}) {
  const [budget, setBudget] = useState<BudgetPreset>(25)
  const [season, setSeason] = useState<Season>(AVAILABLE_SEASONS[0])
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium")
  const [mode, setMode] = useState<"ai" | "human">("ai")
  // Only relevant when mode === "human": "private" opens an invite link for a
  // specific friend; "global" drops you into public matchmaking with anyone.
  const [matchType, setMatchType] = useState<"private" | "global">("private")
  // Covers the gap between the click and ArenaGame's chunk arriving, so the CTA
  // can't be double-fired on a slow connection.
  const [launching, setLaunching] = useState(false)
  // 1v1 coin stake. Fetched lazily: vs CPU never asks for the balance.
  const [pickedStake, setPickedStake] = useState<number>(MIN_STAKE)
  const { balance, status: balanceStatus } = useWalletBalance(mode === "human")
  // If the balance can't cover the pick, fall back to the highest preset it can
  // (or MIN_STAKE when none fit, where the CTA explains instead).
  const affordablePresets = STAKE_PRESETS.filter((s) => stakeOptionState(s, balance).affordable)
  const stake = stakeOptionState(pickedStake, balance).affordable
    ? pickedStake
    : (affordablePresets[affordablePresets.length - 1] ?? MIN_STAKE)
  const cantAffordAny = mode === "human" && balanceStatus === "ready" && balance !== null && balance < MIN_STAKE
  const stakeHintId = useId()
  const terms = stakeTerms(stake)

  const launch = () => {
    if (launching || cantAffordAny) return
    setLaunching(true)
    onLaunch({ season, budget, difficulty, kind: mode === "ai" ? "ai" : matchType, stake })
  }

  return (
    <div className="relative mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-4 py-10 pb-40 md:pb-10">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-64 w-[120%] -translate-x-1/2 rounded-full bg-[var(--color-lime)]/10 blur-[120px]" />
      <div className="relative text-center">
        <span className="text-xs font-bold uppercase tracking-[0.4em] text-[var(--color-lime)]">Lasyly Arena</span>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--color-text-primary)] sm:text-5xl">NBA <span className="text-[var(--color-lime)]">Auction</span></h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-muted)]">Win a live bidding war for 6 players, then watch your squad battle it out.</p>
      </div>
      <Section step={1} title="Choose your opponent" hint="How it works?"><div className="grid grid-cols-2 gap-3"><ModeCard active={mode === "ai"} onClick={() => setMode("ai")} icon={<Bot className="h-6 w-6" />} title="vs CPU" sub="Play solo against the AI" /><ModeCard active={mode === "human"} onClick={() => setMode("human")} icon={<Users className="h-6 w-6" />} title="vs Player" sub="Face a real person in a live 1v1" /></div></Section>
      {mode === "ai" && <Section step={2} title="Difficulty" hint="Which should I choose?"><div className="grid grid-cols-3 gap-3">{DIFFICULTIES.map((item) => <SelectCard key={item.id} active={difficulty === item.id} onClick={() => setDifficulty(item.id)} title={item.label} sub={item.blurb} icon={<BarChart3 className={cn("h-5 w-5", difficulty === item.id ? "text-[var(--color-lime)]" : item.tone)} />} />)}</div></Section>}
      {mode === "human" && <Section step={2} title="How do you want to match?"><div className="grid grid-cols-2 gap-3"><ModeCard active={matchType === "private"} onClick={() => setMatchType("private")} icon={<Link2 className="h-6 w-6" />} title="Private room" sub="Invite a friend with a link" /><ModeCard active={matchType === "global"} onClick={() => setMatchType("global")} icon={<Globe className="h-6 w-6" />} title="Global match" sub="Get paired with anyone online" /></div></Section>}
      {mode === "human" && (
        <Section step={3} title="Coin stake">
          <StakePicker value={stake} balance={balance} onChange={setPickedStake} hintId={stakeHintId} />
          <div className="flex flex-col gap-1 text-[11px] text-[var(--color-text-muted)]">
            <p>
              {balanceStatus === "ready" && balance !== null ? (
                <>Balance: <span className="font-bold tabular-nums text-[var(--color-text-primary)]">{balance.toLocaleString()} coins</span></>
              ) : balanceStatus === "unavailable" ? (
                "Balance unavailable"
              ) : (
                "Loading balance…"
              )}{" "}
              · <Link href="/wallet" className="text-[var(--color-lime)] underline-offset-2 hover:underline">Open wallet</Link>
            </p>
            <p>
              Winner takes <span className="font-bold tabular-nums text-[var(--color-text-primary)]">{terms.payout} coins</span>{terms.commission > 0 && <> ({terms.commission}-coin commission)</>}. Lose and your stake is gone.
            </p>
            {affordablePresets.length < STAKE_PRESETS.length && <p id={stakeHintId}>Options above your balance are disabled.</p>}
          </div>
        </Section>
      )}
      {AVAILABLE_SEASONS.length > 1 && <Section step={4} title="Season"><div className="flex gap-2">{AVAILABLE_SEASONS.map((item) => <Chip key={item} active={season === item} onClick={() => setSeason(item)}>{item}</Chip>)}</div></Section>}
      {initialError && <p className="text-center text-sm text-[var(--color-danger)]">{initialError}</p>}

      {/* CTA — in-flow, matching the clean layout. */}
      <Button size="lg" className="w-full rounded-2xl py-6 text-lg font-black shadow-[0_10px_40px_-10px_rgba(212,255,0,0.5)]" disabled={launching || cantAffordAny} onClick={launch}>{ctaLabel(mode, matchType, launching)} <ChevronRight className="ml-1 h-5 w-5" /></Button>
      {cantAffordAny && (
        <p className="-mt-4 text-center text-sm text-[var(--color-danger)]">
          You need at least {MIN_STAKE} coins to play a 1v1.{" "}
          <Link href="/wallet" className="font-semibold text-[var(--color-lime)] underline-offset-2 hover:underline">Open wallet</Link>
        </p>
      )}

      {/* Draft budget: auction dollars each side drafts with. Not coins. */}
      <div className="relative flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-lime)]/10 text-[var(--color-lime)]"><Trophy className="h-5 w-5" /></span>
          <div>
            <span className="block text-sm font-bold text-[var(--color-text-primary)]">Draft budget</span>
            <span className="block text-[11px] text-[var(--color-text-muted)]">Auction dollars for drafting players, not coins.</span>
          </div>
        </div>
        <div role="group" aria-label="Draft budget" className="flex shrink-0 items-center gap-2">
          {BUDGET_PRESETS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={budget === item}
              onClick={() => setBudget(item)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-black transition-all",
                budget === item
                  ? "border-[var(--color-lime)] text-[var(--color-lime)] shadow-[0_0_24px_-10px_rgba(212,255,0,0.7)]"
                  : "border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-white/20 hover:bg-white/[0.03]"
              )}
            >
              {BUDGET_META[item].label}
            </button>
          ))}
        </div>
      </div>
      <p className="-mt-4 text-[11px] text-[var(--color-text-muted)]">Player prices scale to your draft budget. Bids go up in ${bidIncrementForBudget(budget)} steps.</p>
    </div>
  )
}

function ctaLabel(mode: "ai" | "human", matchType: "private" | "global", launching: boolean): string {
  if (mode === "ai") return launching ? "Starting…" : "Start Draft"
  if (matchType === "global") return launching ? "Finding a match…" : "Find a Match"
  return launching ? "Creating…" : "Create 1v1 Game"
}

/**
 * Coin stake radiogroup. Roving tabindex: Tab lands on the checked option and
 * the arrow keys (plus Home/End) move between affordable ones. Unaffordable
 * options use aria-disabled rather than `disabled` so screen readers still reach
 * them and read why they're unavailable.
 */
function StakePicker({ value, balance, onChange, hintId }: { value: number; balance: number | null; onChange: (stake: number) => void; hintId: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const options = STAKE_PRESETS.map((s) => ({ stake: s, ...stakeOptionState(s, balance) }))
  const enabledIdx = options.flatMap((o, i) => (o.affordable ? [i] : []))

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (enabledIdx.length === 0) return
    let next: number | undefined
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
      const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1
      for (let step = 1; step <= options.length; step++) {
        const j = (i + dir * step + options.length) % options.length
        if (options[j].affordable) { next = j; break }
      }
    } else if (e.key === "Home") next = enabledIdx[0]
    else if (e.key === "End") next = enabledIdx[enabledIdx.length - 1]
    else return
    e.preventDefault()
    if (next === undefined) return
    onChange(options[next].stake)
    refs.current[next]?.focus()
  }

  const someDisabled = enabledIdx.length < options.length
  return (
    <div role="radiogroup" aria-label="Coin stake per player" aria-describedby={someDisabled ? hintId : undefined} className="grid grid-cols-4 gap-2">
      {options.map((o, i) => {
        const checked = o.stake === value
        const shortId = `${hintId}-short-${o.stake}`
        return (
          <button
            key={o.stake}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={o.affordable ? undefined : true}
            aria-describedby={o.affordable ? undefined : shortId}
            tabIndex={checked ? 0 : -1}
            onClick={() => { if (o.affordable) onChange(o.stake) }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "flex flex-col items-center rounded-xl border px-3 py-2 text-sm font-black transition-all",
              !o.affordable
                ? "cursor-not-allowed border-[var(--color-border)] text-[var(--color-text-muted)] opacity-50"
                : checked
                  ? "border-[var(--color-lime)] text-[var(--color-lime)] shadow-[0_0_24px_-10px_rgba(212,255,0,0.7)]"
                  : "border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-white/20 hover:bg-white/[0.03]"
            )}
          >
            <span className="tabular-nums">{o.stake}</span>
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">coins</span>
            {!o.affordable && balance !== null && (
              <span id={shortId} className="text-[9px] font-semibold text-[var(--color-text-muted)]">Needs {o.stake}, you have {balance}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) { return <section className="relative flex flex-col gap-3"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-lime)] text-xs font-black text-black">{step}</span><h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)]">{title}</h2></div>{hint && <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]"><Info className="h-3.5 w-3.5" />{hint}</span>}</div>{children}</section> }
function ModeCard({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) { return <button type="button" onClick={onClick} className={cn("flex items-center gap-3 rounded-2xl border p-4 text-left transition-all", active ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 shadow-[0_0_30px_-14px_rgba(212,255,0,0.6)]" : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]")}><span className={cn(active ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)]")}>{icon}</span><span><span className="block text-base font-black text-[var(--color-text-primary)]">{title}</span><span className="block text-[11px] leading-snug text-[var(--color-text-muted)]">{sub}</span></span></button> }
function SelectCard({ active, onClick, title, sub, icon }: { active: boolean; onClick: () => void; title: string; sub: string; icon?: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn("flex flex-col items-center gap-1 rounded-2xl border p-4 text-center transition-all", active ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 shadow-[0_0_30px_-14px_rgba(212,255,0,0.6)]" : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]")}>{icon && <span className="mb-1">{icon}</span>}<span className={cn("block text-base font-black", active ? "text-[var(--color-lime)]" : "text-[var(--color-text-primary)]")}>{title}</span><span className="block text-[10px] leading-snug text-[var(--color-text-muted)]">{sub}</span></button> }
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors", active ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]" : "border-[var(--color-border)] text-[var(--color-text-muted)]")}>{children}</button> }
