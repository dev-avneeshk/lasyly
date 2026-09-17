"use client"

import { useMemo } from "react"
import {
  Bar,
  Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatGameTime } from "@/lib/props/dates"
import { pricesFromProbability } from "@/lib/props/odds"

export interface PerformanceGame {
  value: number
  date: string
  opponent: string
  minutes?: number
}

interface PerformanceCardProps {
  /** Human label for the stat, e.g. "Receptions". */
  statLabel: string
  /** Games to plot, oldest first. */
  games: PerformanceGame[]
  /** Threshold the bars are compared against (the prop line, user-adjustable). */
  threshold: number
  onThresholdChange: (value: number) => void
  /** Sub-heading, e.g. "Last 15 Games". */
  sampleLabel: string
  /** Rendered instead of the chart when there are no games. */
  emptyState?: React.ReactNode
}

/**
 * Two-line x-axis tick: opponent above, game date below.
 *
 * Recharts types its tick/label coordinates as `string | number`, so the props
 * are typed loosely and coerced here rather than fighting the library types.
 */
function DualTick({
  x,
  y,
  payload,
  dateByOpponentIndex,
}: {
  x?: string | number
  y?: string | number
  payload?: { value?: string | number; index?: number }
  dateByOpponentIndex: string[]
}) {
  const index = payload?.index ?? 0
  const dateLabel = dateByOpponentIndex[index] ?? ""
  return (
    <g transform={`translate(${Number(x ?? 0)},${Number(y ?? 0)})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="middle"
        fill="var(--color-text-muted)"
        fontSize={10}
        fontWeight={600}
      >
        {payload?.value ?? ""}
      </text>
      <text x={0} y={0} dy={26} textAnchor="middle" fill="var(--color-text-muted)" fontSize={9} opacity={0.6}>
        {dateLabel}
      </text>
    </g>
  )
}

function MetricTile({
  value,
  label,
  accent,
}: {
  value: string
  label: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-w-[74px] px-3 py-2 rounded-lg border",
        accent
          ? "border-[var(--color-lime)]/30 bg-[var(--color-lime)]/[0.08]"
          : "border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60"
      )}
    >
      <span
        className={cn(
          "text-[14px] font-black leading-none tabular-nums whitespace-nowrap",
          accent ? "text-[var(--color-lime)]" : "text-white"
        )}
      >
        {value}
      </span>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap">
        {label}
      </span>
    </div>
  )
}

export function PerformanceCard({
  statLabel,
  games,
  threshold,
  onThresholdChange,
  sampleLabel,
  emptyState,
}: PerformanceCardProps) {
  const chartData = useMemo(
    () =>
      games.map((game) => ({
        opponent: game.opponent,
        dateLabel: formatGameTime(game.date) ?? "",
        value: game.value,
        minutes: game.minutes ?? 0,
        date: game.date,
      })),
    [games]
  )

  const dateLabels = useMemo(() => chartData.map((d) => d.dateLabel), [chartData])

  const overCount = games.filter((g) => g.value >= threshold).length
  const total = games.length
  const overPct = total > 0 ? Math.round((overCount / total) * 100) : 0
  const average = total > 0
    ? Math.round((games.reduce((sum, g) => sum + g.value, 0) / total) * 10) / 10
    : null

  // Priced from the window on screen so the odds and the hit rate agree.
  const prices = total > 0 ? pricesFromProbability(overCount / total) : null

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 rounded-lg bg-[var(--color-lime)]/10 flex items-center justify-center">
            <BarChart3 className="w-4.5 h-4.5 text-[var(--color-lime)]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold leading-tight text-white truncate">{statLabel}</h2>
            <p className="text-[11px] text-[var(--color-text-muted)]">{sampleLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* Line doubles as the threshold control. */}
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60">
            <div className="flex flex-col items-center">
              <span className="text-[14px] font-black leading-none text-white tabular-nums">
                {threshold}
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Line
              </span>
            </div>
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => onThresholdChange(threshold + 0.5)}
                aria-label="Raise threshold by 0.5"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-lime)] transition-colors"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onThresholdChange(Math.max(0, threshold - 0.5))}
                aria-label="Lower threshold by 0.5"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-lime)] transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <MetricTile value={average != null ? String(average) : "—"} label="Average" />
          <MetricTile
            value={total > 0 ? `${overCount} / ${total}` : "—"}
            label={total > 0 ? `Over (${overPct}%)` : "Over"}
            accent
          />
          <MetricTile value={prices?.over ?? "—"} label="Over Odds" />
          <MetricTile value={prices?.under ?? "—"} label="Under Odds" />
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 pt-5">
        {chartData.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center">
            {emptyState ?? (
              <p className="text-sm text-[var(--color-text-muted)]">No games in this range</p>
            )}
          </div>
        ) : (
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 22, right: 44, left: 4, bottom: 26 }}>
                <XAxis
                  dataKey="opponent"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  height={38}
                  tick={(tickProps) => <DualTick {...tickProps} dateByOpponentIndex={dateLabels} />}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "auto"]}
                  width={28}
                  allowDecimals={false}
                />
                <ReferenceLine
                  y={threshold}
                  stroke="rgba(255,255,255,0.28)"
                  strokeDasharray="4 4"
                  label={{
                    value: String(threshold),
                    position: "right",
                    fill: "var(--color-text-primary)",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0].payload as (typeof chartData)[number]
                    const isOver = point.value >= threshold
                    return (
                      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-3 shadow-xl">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">vs {point.opponent}</span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {point.dateLabel}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">
                            {statLabel}
                          </span>
                          <span
                            className={cn(
                              "text-sm font-black tabular-nums",
                              isOver ? "text-[var(--color-lime)]" : "text-white"
                            )}
                          >
                            {point.value}
                          </span>
                          <span
                            className={cn(
                              "text-[9px] font-bold uppercase",
                              isOver ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)]"
                            )}
                          >
                            {isOver ? "Over" : "Under"}
                          </span>
                        </div>
                        {point.minutes > 0 && (
                          <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                            {point.minutes} min
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={30}
                  isAnimationActive={false}
                  label={(labelProps: {
                    x?: string | number
                    y?: string | number
                    width?: string | number
                    // Recharts' RenderableText is deliberately wide.
                    value?: string | number | boolean | null
                  }) => {
                    const value = Number(labelProps.value ?? 0)
                    return (
                      <text
                        x={Number(labelProps.x ?? 0) + Number(labelProps.width ?? 0) / 2}
                        y={Number(labelProps.y ?? 0) - 6}
                        textAnchor="middle"
                        fill={value >= threshold ? "var(--color-lime)" : "var(--color-text-muted)"}
                        fontSize={10}
                        fontWeight={700}
                      >
                        {value}
                      </text>
                    )
                  }}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.value >= threshold ? "var(--color-lime)" : "var(--color-text-muted)"
                      }
                      opacity={entry.value >= threshold ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  )
}
