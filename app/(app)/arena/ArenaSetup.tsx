"use client"

import { useState } from "react"
import { Users, ChevronRight, Bot, Link2, Globe, Info, Trophy, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
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

  const launch = () => {
    if (launching) return
    setLaunching(true)
    onLaunch({ season, budget, difficulty, kind: mode === "ai" ? "ai" : matchType })
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
      {AVAILABLE_SEASONS.length > 1 && <Section step={4} title="Season"><div className="flex gap-2">{AVAILABLE_SEASONS.map((item) => <Chip key={item} active={season === item} onClick={() => setSeason(item)}>{item}</Chip>)}</div></Section>}
      {initialError && <p className="text-center text-sm text-[var(--color-danger)]">{initialError}</p>}

      {/* CTA — in-flow, matching the clean layout. */}
      <Button size="lg" className="w-full rounded-2xl py-6 text-lg font-black shadow-[0_10px_40px_-10px_rgba(212,255,0,0.5)]" disabled={launching} onClick={launch}>{ctaLabel(mode, matchType, launching)} <ChevronRight className="ml-1 h-5 w-5" /></Button>

      {/* Entry Pool — single clean card with inline stake pills. */}
      <div className="relative flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-lime)]/10 text-[var(--color-lime)]"><Trophy className="h-5 w-5" /></span>
          <div>
            <span className="block text-sm font-bold text-[var(--color-text-primary)]">Entry Pool</span>
            <span className="block text-[11px] text-[var(--color-text-muted)]">Higher stakes. Bigger competition.</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
      <p className="-mt-4 text-[11px] text-[var(--color-text-muted)]">Player prices scale to your pool. Bids go up in ${bidIncrementForBudget(budget)} steps.</p>
    </div>
  )
}

function ctaLabel(mode: "ai" | "human", matchType: "private" | "global", launching: boolean): string {
  if (mode === "ai") return launching ? "Starting…" : "Start Draft"
  if (matchType === "global") return launching ? "Finding a match…" : "Find a Match"
  return launching ? "Creating…" : "Create 1v1 Game"
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) { return <section className="relative flex flex-col gap-3"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-lime)] text-xs font-black text-black">{step}</span><h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)]">{title}</h2></div>{hint && <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]"><Info className="h-3.5 w-3.5" />{hint}</span>}</div>{children}</section> }
function ModeCard({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string }) { return <button type="button" onClick={onClick} className={cn("flex items-center gap-3 rounded-2xl border p-4 text-left transition-all", active ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 shadow-[0_0_30px_-14px_rgba(212,255,0,0.6)]" : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]")}><span className={cn(active ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)]")}>{icon}</span><span><span className="block text-base font-black text-[var(--color-text-primary)]">{title}</span><span className="block text-[11px] leading-snug text-[var(--color-text-muted)]">{sub}</span></span></button> }
function SelectCard({ active, onClick, title, sub, icon }: { active: boolean; onClick: () => void; title: string; sub: string; icon?: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn("flex flex-col items-center gap-1 rounded-2xl border p-4 text-center transition-all", active ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 shadow-[0_0_30px_-14px_rgba(212,255,0,0.6)]" : "border-[var(--color-border)] hover:border-white/20 hover:bg-white/[0.03]")}>{icon && <span className="mb-1">{icon}</span>}<span className={cn("block text-base font-black", active ? "text-[var(--color-lime)]" : "text-[var(--color-text-primary)]")}>{title}</span><span className="block text-[10px] leading-snug text-[var(--color-text-muted)]">{sub}</span></button> }
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn("rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors", active ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]" : "border-[var(--color-border)] text-[var(--color-text-muted)]")}>{children}</button> }
