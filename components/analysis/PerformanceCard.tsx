"use client"

import { useMemo, useRef, useState } from "react"
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
import { BarChart3, ChevronDown, ChevronUp, GripHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatGameTime } from "@/lib/props/dates"

export interface PerformanceGame {
  value: number
  date: string
  opponent: string
  minutes?: number
  /** ESPN event id for the game, when available (NFL). */
  eventId?: string
  /** nba_games UUID for the game (NBA), used to open its DB-backed boxscore. */
  gameId?: string
  /** Big-5 soccer match key ("{league}/{season}/{matchNo}"), used to open its match stats. */
  matchKey?: string
}

interface PerformanceCardProps {
  /** Human label for the stat, e.g. "Receptions". */
  statLabel: string
  /** Games to plot, oldest first. */
  games: PerformanceGame[]
  /** Threshold the bars are compared against (the prop target, user-adjustable). */
  threshold: number
  onThresholdChange: (value: number) => void
  /** Sub-heading, e.g. "Last 15 Games". */
  sampleLabel: string
  /** Rendered instead of the chart when there are no games. */
  emptyState?: React.ReactNode
  /**
   * Fired when a bar is clicked, with the clicked game. When omitted, bars are
   * not interactive (default cursor, no handler) — the page passes this only
   * for sports whose boxscore can be resolved (NBA, NFL, Soccer).
   */
  onGameClick?: (game: PerformanceGame) => void
  /** Controls rendered under the chart (sample window, filters). */
  footer?: React.ReactNode
}

/**
 * Hit-rate colour bands: under 50% red, 50% to 89% orange, 90% and up green.
 */
export function hitRateTone(pct: number): "red" | "orange" | "green" {
  if (pct >= 90) return "green"
  if (pct >= 50) return "orange"
  return "red"
}

const TONE_CLASSES: Record<"red" | "orange" | "green", { box: string; text: string }> = {
  red: { box: "border-red-500/35 bg-red-500/[0.10]", text: "text-red-400" },
  orange: { box: "border-orange-500/35 bg-orange-500/[0.10]", text: "text-orange-400" },
  green: { box: "border-emerald-500/35 bg-emerald-500/[0.10]", text: "text-emerald-400" },
}

// Chart geometry. The drag handle maps pointer Y to a value with these, so they
// must match the ComposedChart margins / XAxis height below.
const CHART_HEIGHT = 300
const MARGIN = { top: 22, right: 44, left: 4, bottom: 26 }
const X_AXIS_HEIGHT = 38
const Y_AXIS_WIDTH = 28
const PLOT_TOP = MARGIN.top
const PLOT_BOTTOM = CHART_HEIGHT - MARGIN.bottom - X_AXIS_HEIGHT

/** A round axis maximum and its ticks, so value <-> pixel mapping is exact. */
function niceScale(maxValue: number): { max: number; ticks: number[] } {
  const raw = Math.max(1, maxValue * 1.12)
  const roughStep = raw / 4
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const step = [1, 2, 2.5, 3, 5, 10].map((m) => m * mag).find((s) => s >= roughStep) ?? 10 * mag
  const wholeStep = Math.max(1, Math.round(step))
  const max = Math.ceil(raw / wholeStep) * wholeStep
  const ticks: number[] = []
  for (let t = 0; t <= max; t += wholeStep) ticks.push(t)
  return { max, ticks }
}

/** Lines sit on the half, never below 0.5. */
function snapLine(value: number, max: number): number {
  return Math.min(max, Math.max(0.5, Math.round(value * 2) / 2))
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
  compact,
}: {
  x?: string | number
  y?: string | number
  payload?: { value?: string | number; index?: number }
  dateByOpponentIndex: string[]
  /** Many bars: smaller opponent label, date only on every other tick. */
  compact?: boolean
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
        fontSize={compact ? 8 : 10}
        fontWeight={600}
      >
        {payload?.value ?? ""}
      </text>
      {(!compact || index % 2 === 0) && (
        <text x={0} y={0} dy={compact ? 24 : 26} textAnchor="middle" fill="var(--color-text-muted)" fontSize={compact ? 8 : 9} opacity={0.6}>
          {dateLabel}
        </text>
      )}
    </g>
  )
}

function MetricTile({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone?: "red" | "orange" | "green"
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-w-[74px] px-3 py-2 rounded-lg border",
        tone ? TONE_CLASSES[tone].box : "border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60"
      )}
    >
      <span
        className={cn(
          "text-[14px] font-black leading-none tabular-nums whitespace-nowrap",
          tone ? TONE_CLASSES[tone].text : "text-white"
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
  onGameClick,
  footer,
}: PerformanceCardProps) {
  const chartData = useMemo(
    () =>
      games.map((game) => ({
        opponent: game.opponent,
        dateLabel: formatGameTime(game.date) ?? "",
        value: game.value,
        minutes: game.minutes ?? 0,
        date: game.date,
        eventId: game.eventId,
        gameId: game.gameId,
        matchKey: game.matchKey,
      })),
    [games]
  )

  const dateLabels = useMemo(() => chartData.map((d) => d.dateLabel), [chartData])

  // Axis scale from the data only (not the threshold), so dragging the line
  // never rescales the chart under the pointer.
  const scale = useMemo(
    () => niceScale(Math.max(0, ...chartData.map((d) => d.value))),
    [chartData]
  )
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const lineY = PLOT_TOP + (1 - Math.min(threshold, scale.max) / scale.max) * (PLOT_BOTTOM - PLOT_TOP)

  const valueFromPointer = (clientY: number): number | null => {
    const rect = chartRef.current?.getBoundingClientRect()
    if (!rect) return null
    const y = clientY - rect.top
    const ratio = 1 - (y - PLOT_TOP) / (PLOT_BOTTOM - PLOT_TOP)
    return snapLine(ratio * scale.max, scale.max)
  }
  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = valueFromPointer(e.clientY)
    if (v != null && v !== threshold) onThresholdChange(v)
  }

  const overCount = games.filter((g) => g.value >= threshold).length
  const total = games.length
  const overPct = total > 0 ? Math.round((overCount / total) * 100) : 0
  const average = total > 0
    ? Math.round((games.reduce((sum, g) => sum + g.value, 0) / total) * 10) / 10
    : null

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
          {/* Target doubles as the threshold control. */}
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/60">
            <div className="flex flex-col items-center">
              <span className="text-[14px] font-black leading-none text-white tabular-nums">
                {threshold}
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Target
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
            tone={total > 0 ? hitRateTone(overPct) : undefined}
          />
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
          <div ref={chartRef} className="perf-chart relative w-full" style={{ height: CHART_HEIGHT }}>
            {/* Drag handle for the target line. Pointer drag or arrow keys, in 0.5 steps. */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Target line"
              aria-valuemin={0.5}
              aria-valuemax={scale.max}
              aria-valuenow={threshold}
              title="Drag to move the line"
              className="group absolute z-10 cursor-ns-resize touch-none outline-none"
              style={{ top: lineY - 9, left: MARGIN.left + Y_AXIS_WIDTH, right: 0, height: 18 }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                setDragging(true)
                handlePointer(e)
              }}
              onPointerMove={(e) => { if (dragging) handlePointer(e) }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId)
                setDragging(false)
              }}
              onPointerCancel={() => setDragging(false)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowRight") {
                  e.preventDefault()
                  onThresholdChange(snapLine(threshold + 0.5, scale.max))
                } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
                  e.preventDefault()
                  onThresholdChange(snapLine(threshold - 0.5, scale.max))
                }
              }}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums transition-colors",
                  dragging
                    ? "bg-[var(--color-lime)] text-black"
                    : "bg-[var(--color-surface-elevated)] text-white border border-white/15 group-hover:border-[var(--color-lime)]/60 group-focus-visible:border-[var(--color-lime)]"
                )}
              >
                <GripHorizontal className="w-3 h-3 opacity-70" />
                {threshold}
              </span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={MARGIN}>
                <XAxis
                  dataKey="opponent"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  height={X_AXIS_HEIGHT}
                  tick={(tickProps) => (
                    <DualTick {...tickProps} dateByOpponentIndex={dateLabels} compact={chartData.length > 18} />
                  )}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, scale.max]}
                  ticks={scale.ticks}
                  width={Y_AXIS_WIDTH}
                  allowDecimals={false}
                />
                {/* The value pill lives on the drag handle above, so no label here. */}
                <ReferenceLine
                  y={Math.min(threshold, scale.max)}
                  stroke={dragging ? "var(--color-lime)" : "rgba(255,255,255,0.35)"}
                  strokeWidth={dragging ? 1.5 : 1}
                  strokeDasharray="4 4"
                />
                <Tooltip
                  // ComposedChart draws the hover cursor as a vertical line; hide it.
                  cursor={false}
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
                  cursor={onGameClick ? "pointer" : "default"}
                  onClick={
                    onGameClick
                      ? (data: unknown) => {
                          // Recharts passes the clicked bar's datum (our chartData
                          // entry, sometimes nested under `payload`). Map it back
                          // to a PerformanceGame for the click handler.
                          const d = data as {
                            payload?: (typeof chartData)[number]
                          } & Partial<(typeof chartData)[number]>
                          const point = d.payload ?? d
                          if (point?.date === undefined && point?.opponent === undefined) return
                          onGameClick({
                            value: Number(point.value ?? 0),
                            date: String(point.date ?? ""),
                            opponent: String(point.opponent ?? ""),
                            minutes: point.minutes,
                            eventId: point.eventId,
                            gameId: point.gameId,
                            matchKey: point.matchKey,
                          })
                        }
                      : undefined
                  }
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

      {footer && (
        <div className="border-t border-[var(--color-border)] px-4 py-3">{footer}</div>
      )}
    </section>
  )
}
