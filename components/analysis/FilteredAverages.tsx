"use client"

import { ArrowDown, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { nbaStatValue, type NbaGameLogEntry } from "@/lib/props/nbaGameLog"

interface FilteredAveragesProps {
  /** Games after the chart's filters (season type, vs opponent), oldest first. */
  games: NbaGameLogEntry[] | null
  /** Active stat-tab key, e.g. "PTS" or "PTS+AST". */
  statKey: string
  /** Display label for the active stat. */
  statLabel: string
  /** Describes the active filters, e.g. "vs DET · Regular season". */
  filterLabel: string
}

type Metric = {
  key: string
  label: string
  /** Average per game, or a shooting % from totals; null when undefined. */
  compute: (games: NbaGameLogEntry[]) => number | null
  percent?: boolean
  /** Fewer is better (turnovers): flips the trend colour. */
  lowerIsBetter?: boolean
}

const avg = (games: NbaGameLogEntry[], pick: (g: NbaGameLogEntry) => number) =>
  games.length ? games.reduce((s, g) => s + pick(g), 0) / games.length : null

/** Shooting % from totals (made / attempted), not an average of per-game %. */
const pct = (games: NbaGameLogEntry[], made: (g: NbaGameLogEntry) => number, att: (g: NbaGameLogEntry) => number) => {
  const a = games.reduce((s, g) => s + att(g), 0)
  return a > 0 ? (games.reduce((s, g) => s + made(g), 0) / a) * 100 : null
}

const SUPPORT_METRICS: Metric[] = [
  { key: "MIN", label: "Minutes", compute: (g) => avg(g, (x) => x.minutes) },
  { key: "FGA", label: "FG att.", compute: (g) => avg(g, (x) => x.fga) },
  { key: "FG%", label: "FG %", compute: (g) => pct(g, (x) => x.fgm, (x) => x.fga), percent: true },
  { key: "3PM", label: "3PT made", compute: (g) => avg(g, (x) => x.tpm) },
  { key: "3P%", label: "3PT %", compute: (g) => pct(g, (x) => x.tpm, (x) => x.tpa), percent: true },
  { key: "FTA", label: "FT att.", compute: (g) => avg(g, (x) => x.fta) },
  { key: "FT%", label: "FT %", compute: (g) => pct(g, (x) => x.ftm, (x) => x.fta), percent: true },
  { key: "OREB", label: "Off. reb", compute: (g) => avg(g, (x) => x.oreb) },
  { key: "DREB", label: "Def. reb", compute: (g) => avg(g, (x) => x.dreb) },
  { key: "TOV", label: "Turnovers", compute: (g) => avg(g, (x) => x.tov), lowerIsBetter: true },
]

function format(value: number | null, percent?: boolean): string {
  if (value == null) return "—"
  return percent ? `${value.toFixed(1)}%` : value.toFixed(1)
}

/** L5 vs L10 change in percent; null when either side is missing or L10 is 0. */
function trend(l5: number | null, l10: number | null): number | null {
  if (l5 == null || l10 == null || l10 === 0) return null
  return ((l5 - l10) / l10) * 100
}

function Trend({ change, lowerIsBetter }: { change: number | null; lowerIsBetter?: boolean }) {
  if (change == null || Math.abs(change) < 1) {
    return <span className="w-11 text-right text-[10px] text-[var(--color-text-muted)]">—</span>
  }
  const up = change > 0
  const good = lowerIsBetter ? !up : up
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        "w-11 inline-flex items-center justify-end gap-0.5 text-[10px] font-bold tabular-nums",
        good ? "text-emerald-400" : "text-red-400"
      )}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {Math.abs(change).toFixed(0)}%
    </span>
  )
}

/**
 * L10 / L5 averages over the same games the chart is filtered to, so toggling
 * "vs opponent" or a season type updates both together.
 */
export function FilteredAverages({ games, statKey, statLabel, filterLabel }: FilteredAveragesProps) {
  const l10 = games ? games.slice(-10) : []
  const l5 = games ? games.slice(-5) : []

  const statMetric: Metric = {
    key: statKey,
    label: statLabel,
    compute: (g) => avg(g, (x) => nbaStatValue(x, statKey) ?? 0),
  }
  const rows = [statMetric, ...SUPPORT_METRICS]
  const loading = games === null

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <header className="px-4 pt-4 pb-3 border-b border-[var(--color-border)]">
        <h3 className="text-[15px] font-bold text-white">Filtered Averages</h3>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)] truncate">{filterLabel}</p>
      </header>

      <div className="px-4 py-2">
        <div className="flex items-center gap-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          <span className="flex-1">Metric</span>
          <span className="w-12 text-right">L10</span>
          <span className="w-12 text-right">L5</span>
          <span className="w-11 text-right">Trend</span>
        </div>

        {!loading && games!.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No games match these filters</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]/60">
            {rows.map((m, i) => {
              const v10 = loading ? null : m.compute(l10)
              const v5 = loading ? null : m.compute(l5)
              const isStat = i === 0
              return (
                <li
                  key={m.key}
                  className={cn(
                    "flex items-center gap-2 py-2",
                    isStat && "-mx-2 px-2 rounded-lg bg-[var(--color-lime)]/[0.06] border-none"
                  )}
                >
                  <span
                    className={cn(
                      "flex-1 min-w-0 truncate text-xs",
                      isStat ? "font-bold text-[var(--color-lime)]" : "font-medium text-white/80"
                    )}
                  >
                    {m.label}
                  </span>
                  <span className="w-12 text-right text-xs tabular-nums text-[var(--color-text-muted)]">
                    {loading ? <span className="inline-block h-3 w-8 rounded bg-white/5 animate-pulse" /> : format(v10, m.percent)}
                  </span>
                  <span className={cn("w-12 text-right text-xs font-bold tabular-nums", isStat ? "text-white" : "text-white/90")}>
                    {loading ? <span className="inline-block h-3 w-8 rounded bg-white/5 animate-pulse" /> : format(v5, m.percent)}
                  </span>
                  <Trend change={loading ? null : trend(v5, v10)} lowerIsBetter={m.lowerIsBetter} />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
