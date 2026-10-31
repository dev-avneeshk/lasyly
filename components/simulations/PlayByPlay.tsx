"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { SimPlay, SimTeam } from "@/lib/simulations/types"

type Filter = "all" | "scoring"

interface Row {
  period: string
  clock: string
  team: string
  text: string
  score: string
  scoring: boolean
  marker: boolean
  inferred: boolean
}

/** The featured simulated game's play-by-play, by period, with an all / scoring-only toggle. */
export function PlayByPlay({ plays, home, away }: { plays: SimPlay[]; home: SimTeam; away: SimTeam }) {
  const rows = useMemo<Row[]>(
    () =>
      plays.map(([period, clock, team, text, score], i) => {
        const marker = period === ""
        return {
          period,
          clock,
          team,
          text,
          score,
          marker,
          // a scoring play is one that moved the score from the row before it
          scoring: !marker && i > 0 && score !== plays[i - 1][4],
          inferred: text.includes("[inferred]"),
        }
      }),
    [plays]
  )
  const periods = useMemo(() => Array.from(new Set(rows.filter((r) => !r.marker).map((r) => r.period))), [rows])
  const [period, setPeriod] = useState<string>("all")
  const [filter, setFilter] = useState<Filter>("all")

  const shown = rows.filter((r) => {
    if (period !== "all" && !r.marker && r.period !== period) return false
    if (period !== "all" && r.marker) return false
    if (filter === "scoring" && !r.scoring && !r.marker) return false
    return true
  })

  const chip = (active: boolean) =>
    cn(
      "h-8 shrink-0 rounded-full border px-3 text-[12px] font-bold transition-colors",
      active
        ? "border-[var(--color-lime)] bg-[var(--color-lime)] text-black"
        : "border-[var(--color-border)] bg-[var(--color-surface)]/70 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
    )

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button type="button" className={chip(period === "all")} onClick={() => setPeriod("all")}>
            Full game
          </button>
          {periods.map((p) => (
            <button key={p} type="button" className={chip(period === p)} onClick={() => setPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={chip(filter === "all")} onClick={() => setFilter("all")}>
            All plays
          </button>
          <button type="button" className={chip(filter === "scoring")} onClick={() => setFilter("scoring")}>
            Scoring only
          </button>
        </div>
      </div>
      <div className="max-h-[640px] overflow-y-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 z-10 bg-[var(--color-surface)]">
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="w-14 px-4 py-2">Per.</th>
              <th className="w-16 px-2 py-2">Clock</th>
              <th className="w-14 px-2 py-2">Team</th>
              <th className="px-2 py-2">Play</th>
              <th className="w-24 px-4 py-2 text-right">
                {away.abbr}–{home.abbr}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              // stored as home-away; shown away-home to match the header
              const [h, a] = r.score.split("-")
              const score = `${a}–${h}`
              if (r.marker) {
                return (
                  <tr key={i} className="border-t border-[var(--color-border)] bg-white/[0.04]">
                    <td colSpan={4} className="px-4 py-2 font-bold text-[var(--color-text-primary)]">
                      {r.text}
                    </td>
                    <td className="px-4 py-2 text-right font-bold tabular-nums text-[var(--color-text-primary)]">{score}</td>
                  </tr>
                )
              }
              return (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-1.5 text-[var(--color-text-muted)]">{r.period}</td>
                  <td className="px-2 py-1.5 tabular-nums text-[var(--color-text-muted)]">{r.clock}</td>
                  <td className="px-2 py-1.5 font-bold text-[var(--color-text-muted)]">{r.team}</td>
                  <td
                    className={cn(
                      "px-2 py-1.5",
                      r.scoring ? "font-semibold text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)]/75",
                      r.inferred && "italic text-[var(--color-text-muted)]"
                    )}
                  >
                    {r.text}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-1.5 text-right tabular-nums",
                      r.scoring ? "font-bold text-[var(--color-lime)]" : "text-[var(--color-text-muted)]"
                    )}
                  >
                    {score}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[var(--color-border)] px-4 py-3 text-[11px] text-[var(--color-text-muted)]">
        The engine does not log substitutions, individual fouls or who got each steal; those show only in the box score.
        Rows marked [inferred] are points it scored without logging the play (and-1 and technical free throws).
      </p>
    </div>
  )
}
