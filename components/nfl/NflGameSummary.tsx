"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { Check, X, Trophy, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NflGameResult, RosterState, TeamId } from "@/lib/nfl/types"
import { gradeManager } from "@/lib/nfl/grades"
import { NflBoxScore } from "./NflBoxScore"
import { NflManagerGrade } from "./NflManagerGrade"
import { cn } from "@/lib/utils"

const COMP_ROWS: { key: keyof NflGameResult["teamComparison"]; label: string }[] = [
  { key: "passingOffense", label: "Passing O" },
  { key: "rushingOffense", label: "Rushing O" },
  { key: "explosiveness", label: "Explosiveness" },
  { key: "passProtection", label: "Protection" },
  { key: "passRush", label: "Pass Rush" },
  { key: "coverage", label: "Coverage" },
  { key: "runDefense", label: "Run Defense" },
  { key: "balance", label: "Balance" },
]

export function NflGameSummary({
  result,
  humanSeat,
  rosters,
  budget,
  rosterSize,
  p1Label,
  p2Label,
  onRematch,
  onNewAuction,
  onExit,
}: {
  result: NflGameResult
  humanSeat: TeamId
  rosters: Record<TeamId, RosterState>
  budget: number
  rosterSize: number
  p1Label: string
  p2Label: string
  onRematch: () => void
  onNewAuction: () => void
  onExit: () => void
}) {
  const humanWon = result.winner === humanSeat
  const label = (t: TeamId) => (t === "P1" ? p1Label : p2Label)
  const loser: TeamId = result.winner === "P1" ? "P2" : "P1"

  const humanGrade = useMemo(
    () => gradeManager(humanSeat, rosters[humanSeat], budget, rosterSize),
    [humanSeat, rosters, budget, rosterSize]
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 pb-40 md:pb-8">
      {/* Verdict */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-3xl border p-8 text-center",
          humanWon ? "border-[var(--color-lime)]/60 shadow-[0_0_60px_-18px_rgba(212,255,0,0.6)]" : "border-[var(--color-danger)]/40"
        )}
      >
        <span className={cn("text-4xl font-black uppercase tracking-tight", humanWon ? "text-[var(--color-lime)]" : "text-[var(--color-danger)]")}>
          {humanWon ? "You Win" : "You Lose"}
        </span>
        <div className="flex items-center gap-4 text-5xl font-black tabular-nums">
          <span className={result.winner === "P1" ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)]"}>{result.finalScore.p1}</span>
          <span className="text-2xl text-[var(--color-text-muted)]">—</span>
          <span className={result.winner === "P2" ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)]"}>{result.finalScore.p2}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-sm">
          <Trophy className="h-4 w-4 text-[var(--color-lime)]" />
          <span className="text-[var(--color-text-muted)]">Player of the Game</span>
          <span className="font-bold text-[var(--color-text-primary)]">{result.mvp.name}</span>
          <span className="text-xs text-[var(--color-text-muted)]">({label(result.mvp.team)}) · {result.mvp.line}</span>
        </div>
      </motion.div>

      {/* Manager grade — the post-auction report card */}
      <NflManagerGrade grade={humanGrade} title={`${p1Label} · Draft Grade`} />

      {/* Why won / lost */}
      <div className="grid gap-4 md:grid-cols-2">
        <AnalysisCard title={`Why ${label(result.winner)} Won`} points={result.analysis[result.winner]} tone="win" />
        <AnalysisCard title={`Why ${label(loser)} Lost`} points={result.analysis[loser]} tone="lose" />
      </div>

      {/* Key matchups */}
      {result.matchupNotes.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-[var(--color-text-primary)]">
            <Swords className="h-4 w-4 text-[var(--color-lime)]" /> Key Matchups
          </h3>
          <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
            {result.matchupNotes.map((m, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 rounded bg-[var(--color-lime)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--color-lime)]">
                  {label(m.favors)}
                </span>
                {m.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Team comparison */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-[var(--color-text-primary)]">Team Comparison</h3>
        <div className="space-y-2">
          {COMP_ROWS.map((row) => {
            const raw = result.teamComparison[row.key]
            // Ratings are rounded at the source (lib/nfl/teamRating.ts), but
            // round again at the render boundary so a stray float can never show
            // a repeating-decimal tail here.
            const p1 = Math.round(raw.p1)
            const p2 = Math.round(raw.p2)
            const total = p1 + p2 || 1
            return (
              <div key={row.key} className="flex items-center gap-3 text-xs">
                <span className="w-8 text-right font-semibold tabular-nums text-[var(--color-text-primary)]">{p1}</span>
                <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full bg-[var(--color-lime)]" style={{ width: `${(p1 / total) * 100}%` }} />
                  <div className="h-full bg-[var(--color-primary)]" style={{ width: `${(p2 / total) * 100}%` }} />
                </div>
                <span className="w-8 font-semibold tabular-nums text-[var(--color-text-primary)]">{p2}</span>
                <span className="w-24 shrink-0 text-center text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{row.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Box scores */}
      <div className="grid gap-4 lg:grid-cols-2">
        <NflBoxScore result={result} team="P1" label={p1Label} />
        <NflBoxScore result={result} team="P2" label={p2Label} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={onRematch} className="font-bold">Rematch</Button>
        <Button size="lg" variant="outline" onClick={onNewAuction} className="font-bold">New Auction</Button>
        <Button size="lg" variant="ghost" onClick={onExit} className="font-bold">Exit</Button>
      </div>
    </div>
  )
}

function AnalysisCard({ title, points, tone }: { title: string; points: NflGameResult["analysis"][TeamId]; tone: "win" | "lose" }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
      <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-[var(--color-text-primary)]">{title}</h3>
      <ul className="space-y-2 text-sm">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-[var(--color-text-muted)]">
            {tone === "win" ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success)]" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
            )}
            {p.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
