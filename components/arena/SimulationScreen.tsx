"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import type { GameResult, TeamId } from "@/lib/arena/types"
import { cn } from "@/lib/utils"

/**
 * Paces the reveal of a pre-computed GameResult: walks the recorded scoring
 * moments, ticking a live scoreboard and a quarter-by-quarter line score, then
 * hands off to results. No play-by-play narration — just score progression.
 */
export function SimulationScreen({
  result,
  p1Label,
  p2Label,
  onDone,
}: {
  result: GameResult
  p1Label: string
  p2Label: string
  onDone: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState({ p1: 0, p2: 0 })
  const [quarter, setQuarter] = useState(1)

  const moments = result.moments

  // Walk the scoring moments, updating the scoreboard as the game "plays".
  useEffect(() => {
    if (idx >= moments.length) {
      const t = setTimeout(onDone, 1400)
      return () => clearTimeout(t)
    }
    const m = moments[idx]
    const delay = m.big ? 520 : 240
    const t = setTimeout(() => {
      setScore({ p1: m.p1Score, p2: m.p2Score })
      setQuarter(m.quarter)
      setIdx((i) => i + 1)
    }, delay)
    return () => clearTimeout(t)
  }, [idx, moments, onDone])

  const leader: TeamId | null = score.p1 === score.p2 ? null : score.p1 > score.p2 ? "P1" : "P2"
  const qLabel = quarter <= 4 ? `Q${quarter}` : `OT${quarter - 4}`
  const progress = moments.length ? Math.min(100, (idx / moments.length) * 100) : 100
  const done = idx >= moments.length

  // Cumulative → per-quarter points, revealed only up to the current quarter.
  const lines = buildQuarterLines(result.quarters, quarter, done)

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-8">
      <span className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--color-lime)]">
        Live Simulation · {qLabel}
      </span>

      {/* Scoreboard */}
      <div className="grid w-full grid-cols-3 items-center gap-4 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-6 backdrop-blur-xl">
        <ScoreSide label={p1Label} score={score.p1} leading={leader === "P1"} align="left" />
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">{qLabel}</div>
          <div className="text-2xl font-black text-[var(--color-text-muted)]">vs</div>
        </div>
        <ScoreSide label={p2Label} score={score.p2} leading={leader === "P2"} align="right" />
      </div>

      {/* Progress */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div className="h-full bg-[var(--color-lime)]" animate={{ width: `${progress}%` }} transition={{ ease: "linear" }} />
      </div>

      {/* Quarter-by-quarter line score */}
      <div className="w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black/20">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              <th className="px-4 py-2 text-left font-bold">Team</th>
              {lines.headers.map((h) => (
                <th key={h} className="px-3 py-2 text-center font-bold">{h}</th>
              ))}
              <th className="px-4 py-2 text-center font-black text-[var(--color-lime)]">T</th>
            </tr>
          </thead>
          <tbody>
            <LineRow label={p1Label} cells={lines.p1} total={score.p1} leading={leader === "P1"} />
            <LineRow label={p2Label} cells={lines.p2} total={score.p2} leading={leader === "P2"} />
          </tbody>
        </table>
        {done && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-2 text-center text-sm font-bold text-[var(--color-lime)]">
            Final buzzer…
          </motion.div>
        )}
      </div>
    </div>
  )
}

/**
 * Turns cumulative quarter scores into per-quarter points, revealing only the
 * quarters that have finished (or are current) as the sim progresses.
 */
function buildQuarterLines(
  quarters: GameResult["quarters"],
  currentQuarter: number,
  done: boolean,
): { headers: string[]; p1: (number | null)[]; p2: (number | null)[] } {
  const headers: string[] = []
  const p1: (number | null)[] = []
  const p2: (number | null)[] = []
  let prevP1 = 0
  let prevP2 = 0
  for (const q of quarters) {
    headers.push(q.quarter <= 4 ? `Q${q.quarter}` : `OT${q.quarter - 4}`)
    const revealed = done || q.quarter < currentQuarter
    p1.push(revealed ? q.p1 - prevP1 : null)
    p2.push(revealed ? q.p2 - prevP2 : null)
    prevP1 = q.p1
    prevP2 = q.p2
  }
  return { headers, p1, p2 }
}

function LineRow({
  label,
  cells,
  total,
  leading,
}: {
  label: string
  cells: (number | null)[]
  total: number
  leading: boolean
}) {
  return (
    <tr className="border-b border-[var(--color-border)]/40 last:border-0">
      <td className="max-w-[9rem] truncate px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </td>
      {cells.map((c, i) => (
        <td key={i} className="px-3 py-2.5 text-center text-[var(--color-text-primary)]">
          {c === null ? <span className="text-[var(--color-text-muted)]">–</span> : c}
        </td>
      ))}
      <td className={cn("px-4 py-2.5 text-center text-lg font-black", leading ? "text-[var(--color-lime)]" : "text-[var(--color-text-primary)]")}>
        {total}
      </td>
    </tr>
  )
}

function ScoreSide({ label, score, leading, align }: { label: string; score: number; leading: boolean; align: "left" | "right" }) {
  return (
    <div className={cn("flex flex-col", align === "right" ? "items-end text-right" : "items-start text-left")}>
      <span className="max-w-full truncate text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      <motion.span
        key={score}
        initial={{ scale: 1.3 }}
        animate={{ scale: 1 }}
        className={cn("text-5xl font-black tabular-nums", leading ? "text-[var(--color-lime)]" : "text-[var(--color-text-primary)]")}
      >
        {score}
      </motion.span>
    </div>
  )
}
