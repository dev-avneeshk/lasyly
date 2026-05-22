"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { LineMovementData } from "@/lib/analytics/types"

interface LineMovementIndicatorProps {
  data: LineMovementData | null
  onExpand?: () => void
}

/**
 * Displays a directional arrow with absolute change value.
 * Tapping expands an SVG line chart showing 7-day history (max 100 points).
 * Renders nothing when data is null.
 *
 * Requirements: 8.3, 8.4, 8.6
 */
export function LineMovementIndicator({ data, onExpand }: LineMovementIndicatorProps) {
  const [expanded, setExpanded] = useState(false)

  // Omit entirely when no data (Requirement 8.6)
  if (!data) {
    return null
  }

  const { direction, change, hasSignificantMove, history } = data

  const handleToggle = () => {
    setExpanded((prev) => !prev)
    if (!expanded && onExpand) {
      onExpand()
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {/* Indicator button */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
          hasSignificantMove
            ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
            : "bg-white/5 text-[var(--color-text-secondary)]"
        )}
        aria-label={`Line moved ${direction} by ${change}`}
        aria-expanded={expanded}
      >
        {/* Directional arrow */}
        <DirectionArrow direction={direction} significant={hasSignificantMove} />

        {/* Absolute change value rounded to 1 decimal */}
        <span>{change.toFixed(1)}</span>
      </button>

      {/* Expandable line chart */}
      {expanded && history.length > 0 && (
        <div className="mt-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-2">
          <LineChart history={history} hasSignificantMove={hasSignificantMove} />
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function DirectionArrow({
  direction,
  significant,
}: {
  direction: "up" | "down"
  significant: boolean
}) {
  const color = significant
    ? "var(--color-danger)"
    : direction === "up"
      ? "var(--color-lime)"
      : "var(--color-warning)"

  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {direction === "up" ? (
        <path d="M6 2L10 7H2L6 2Z" fill={color} />
      ) : (
        <path d="M6 10L2 5H10L6 10Z" fill={color} />
      )}
    </svg>
  )
}

/**
 * Simple SVG polyline chart for line history.
 * Renders up to 100 data points over 7 days.
 * Highlights significant moves with a different stroke color.
 */
function LineChart({
  history,
  hasSignificantMove,
}: {
  history: { timestamp: string; value: number }[]
  hasSignificantMove: boolean
}) {
  if (history.length < 2) {
    return (
      <p className="text-[10px] text-[var(--color-text-muted)] text-center py-2">
        Not enough data for chart
      </p>
    )
  }

  const chartWidth = 240
  const chartHeight = 60
  const paddingX = 4
  const paddingY = 4

  const values = history.map((h) => h.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  const range = maxVal - minVal || 1 // avoid division by zero

  // Map data points to SVG coordinates
  const points = history.map((point, i) => {
    const x = paddingX + (i / (history.length - 1)) * (chartWidth - 2 * paddingX)
    const y =
      paddingY +
      (1 - (point.value - minVal) / range) * (chartHeight - 2 * paddingY)
    return `${x},${y}`
  })

  const polylinePoints = points.join(" ")

  const strokeColor = hasSignificantMove
    ? "var(--color-danger)"
    : "var(--color-lime)"

  return (
    <div className="flex flex-col gap-1">
      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        className="w-full"
        role="img"
        aria-label="Line movement chart over the past 7 days"
      >
        {/* Grid line at midpoint */}
        <line
          x1={paddingX}
          y1={chartHeight / 2}
          x2={chartWidth - paddingX}
          y2={chartHeight / 2}
          stroke="var(--color-border)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />

        {/* Line chart */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start and end dots */}
        {points.length > 0 && (
          <>
            <circle
              cx={parseFloat(points[0].split(",")[0])}
              cy={parseFloat(points[0].split(",")[1])}
              r="2"
              fill="var(--color-text-muted)"
            />
            <circle
              cx={parseFloat(points[points.length - 1].split(",")[0])}
              cy={parseFloat(points[points.length - 1].split(",")[1])}
              r="2.5"
              fill={strokeColor}
            />
          </>
        )}
      </svg>

      {/* Y-axis labels */}
      <div className="flex justify-between text-[9px] text-[var(--color-text-muted)]">
        <span>{minVal.toFixed(1)}</span>
        <span className="text-[var(--color-text-secondary)]">7d</span>
        <span>{maxVal.toFixed(1)}</span>
      </div>
    </div>
  )
}
