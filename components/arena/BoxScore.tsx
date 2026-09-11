"use client"

import type { GameResult, TeamId } from "@/lib/arena/types"
import { teamTotalsFromLines, pct } from "@/lib/arena/boxscore"
import { cn } from "@/lib/utils"

export function BoxScore({ result, team, label }: { result: GameResult; team: TeamId; label: string }) {
  const lines = result.boxScore.filter((l) => l.team === team)
  const box = result.teamBox[team]
  const totals = teamTotalsFromLines(result.boxScore, team)
  // Flags an overtime game so 50+ minute lines read as intentional, not a bug.
  const otPeriods = Math.max(0, result.quarters.length - 4)
  const overtimeLabel = otPeriods === 0 ? null : otPeriods === 1 ? "OT" : `${otPeriods}OT`

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60">
      <div className="flex items-center justify-between bg-white/[0.03] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black uppercase tracking-wide text-[var(--color-lime)]">{label}</span>
          {overtimeLabel && (
            <span className="rounded bg-[var(--color-warning)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-warning)]">
              {overtimeLabel}
            </span>
          )}
        </div>
        <span className="text-lg font-black tabular-nums text-[var(--color-text-primary)]">{box.points}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="px-3 py-1.5 text-left font-medium">Player</th>
              {["MIN", "PTS", "REB", "AST", "STL", "BLK", "FG", "3P", "TO"].map((h) => (
                <th key={h} className="px-2 py-1.5 text-right font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.playerId} className="border-t border-[var(--color-border)]/60">
                <td className="px-3 py-1.5 text-left">
                  <span className="font-medium text-[var(--color-text-primary)]">{l.name}</span>
                  <span className="ml-1 text-[9px] text-[var(--color-text-muted)]">{l.slot}</span>
                </td>
                <Cell v={l.min} />
                <Cell v={l.pts} bold />
                <Cell v={l.reb} />
                <Cell v={l.ast} />
                <Cell v={l.stl} />
                <Cell v={l.blk} />
                <td className="px-2 py-1.5 text-right tabular-nums text-[var(--color-text-muted)]">{l.fgm}-{l.fga}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-[var(--color-text-muted)]">{l.tpm}-{l.tpa}</td>
                <Cell v={l.tov} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-[var(--color-border)] px-4 py-3 text-center text-[11px] sm:grid-cols-6">
        <Stat label="FG%" value={`${pct(totals.fgm, totals.fga)}`} />
        <Stat label="3P%" value={`${pct(totals.tpm, totals.tpa)}`} />
        <Stat label="FT%" value={`${pct(totals.ftm, totals.fta)}`} />
        <Stat label="Paint" value={`${box.paintPoints}`} />
        <Stat label="Fast Br" value={`${box.fastBreakPoints}`} />
        <Stat label="2nd Ch" value={`${box.secondChancePoints}`} />
      </div>
    </div>
  )
}

function Cell({ v, bold }: { v: number; bold?: boolean }) {
  return (
    <td className={cn("px-2 py-1.5 text-right tabular-nums", bold ? "font-bold text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]")}>
      {v}
    </td>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">{label}</div>
      <div className="font-bold text-[var(--color-text-primary)]">{value}</div>
    </div>
  )
}
