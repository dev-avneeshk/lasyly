"use client"

import { GraphDataPoint } from "@/lib/analytics/engine-v2"

interface MiniGraphProps {
  graphData: GraphDataPoint[]
  propLine: number
  height?: number
}

/**
 * Mini bar chart showing a player's last 3-6 games relative to the prop line.
 * Shows stat value above each bar and opponent abbreviation below.
 * Bars are colored lime when the value meets/exceeds the prop line, and
 * white at 20% opacity when below. A horizontal reference line marks the prop line.
 */
export function MiniGraph({ graphData, propLine, height = 64 }: MiniGraphProps) {
  if (graphData.length < 3) return null

  // Show only the most recent 5 games
  const displayData = graphData.slice(-5)

  const maxValue = Math.max(...displayData.map((d) => d.value))
  const yMax = Math.max(propLine * 1.5, maxValue * 1.1)
  const propLineY = yMax > 0 ? (propLine / yMax) * 100 : 0

  return (
    <div className="w-full">
      {/* Chart area */}
      <div className="relative" style={{ height }}>
        {/* Horizontal prop line reference */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-[var(--color-text-muted)]/40 z-10"
          style={{ bottom: `${propLineY}%` }}
        >
          <span className="absolute right-0 -top-3 text-[9px] text-[var(--color-text-muted)] font-medium leading-none">
            {propLine}
          </span>
        </div>

        {/* Bars with stat values above */}
        <div className="relative flex items-end justify-between h-full gap-1.5 px-0.5">
          {displayData.map((point, index) => {
            const barHeight = yMax > 0 ? (point.value / yMax) * 100 : 0

            return (
              <div
                key={`${point.date}-${index}`}
                className="flex-1 min-w-0 flex flex-col items-center justify-end h-full"
              >
                {/* Stat value above bar */}
                <span
                  className="text-[10px] font-semibold leading-none mb-1"
                  style={{
                    color: point.overLine
                      ? "var(--color-lime)"
                      : "rgba(255, 255, 255, 0.5)",
                  }}
                >
                  {point.value}
                </span>

                {/* Bar */}
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: point.overLine
                      ? "var(--color-lime)"
                      : "rgba(255, 255, 255, 0.2)",
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Opponent labels below */}
      <div className="flex justify-between gap-1.5 px-0.5 mt-1.5">
        {displayData.map((point, index) => (
          <span
            key={`opp-${point.date}-${index}`}
            className="flex-1 min-w-0 text-center text-[9px] font-medium text-[var(--color-text-muted)] leading-none truncate"
          >
            {point.opponent}
          </span>
        ))}
      </div>
    </div>
  )
}
