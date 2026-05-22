"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { HitRateWindow, WindowName, getColorBand } from "@/lib/analytics/hit-rates"

interface HitRateBarsProps {
  windows: HitRateWindow[]
  onWindowHover?: (window: HitRateWindow) => void
}

/** Fixed display order for hit rate windows */
const WINDOW_ORDER: WindowName[] = ["L5", "L10", "L15", "L20", "Season", "vsOpp"]

/** Maps color band to Tailwind background classes using project CSS variables */
const COLOR_CLASSES: Record<"red" | "yellow" | "green", string> = {
  red: "bg-[var(--color-danger)]",
  yellow: "bg-[var(--color-warning)]",
  green: "bg-[var(--color-lime)]",
}

/** Maps color band to text color classes */
const TEXT_COLOR_CLASSES: Record<"red" | "yellow" | "green", string> = {
  red: "text-[var(--color-danger)]",
  yellow: "text-[var(--color-warning)]",
  green: "text-[var(--color-lime)]",
}

export function HitRateBars({ windows, onWindowHover }: HitRateBarsProps) {
  const [activeTooltip, setActiveTooltip] = useState<WindowName | null>(null)

  // Guard against undefined/null windows
  if (!windows || windows.length === 0) {
    return null
  }

  // Build a lookup map for quick access by window name
  const windowMap = new Map<WindowName, HitRateWindow>()
  for (const w of windows) {
    windowMap.set(w.window, w)
  }

  return (
    <div className="flex items-end gap-1.5">
      {WINDOW_ORDER.map((name) => {
        const win = windowMap.get(name)
        const available = win?.available ?? false
        const hitRate = win?.hitRate ?? 0
        const colorBand = available ? getColorBand(hitRate) : null

        return (
          <div
            key={name}
            className="relative flex flex-col items-center gap-1 flex-1 min-w-0"
            onMouseEnter={() => {
              setActiveTooltip(name)
              if (win && onWindowHover) onWindowHover(win)
            }}
            onMouseLeave={() => setActiveTooltip(null)}
            onTouchStart={() => {
              setActiveTooltip((prev) => (prev === name ? null : name))
              if (win && onWindowHover) onWindowHover(win)
            }}
          >
            {/* Tooltip */}
            {activeTooltip === name && available && win && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap px-2 py-1 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[10px] text-[var(--color-text-primary)] shadow-lg">
                {win.over}/{win.total} over
              </div>
            )}

            {/* Bar */}
            <div className="w-full h-8 rounded-sm bg-white/5 relative overflow-hidden">
              {available && colorBand ? (
                <div
                  className={cn(
                    "absolute bottom-0 left-0 w-full rounded-sm transition-all",
                    COLOR_CLASSES[colorBand]
                  )}
                  style={{ height: `${hitRate}%` }}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-[9px] text-[var(--color-text-muted)] font-medium">
                    N/A
                  </span>
                </div>
              )}
            </div>

            {/* Label */}
            <span
              className={cn(
                "text-[9px] font-medium leading-none",
                available && colorBand
                  ? TEXT_COLOR_CLASSES[colorBand]
                  : "text-[var(--color-text-muted)]"
              )}
            >
              {available ? `${hitRate}%` : "—"}
            </span>

            {/* Window name */}
            <span className="text-[8px] text-[var(--color-text-muted)] leading-none">
              {name === "vsOpp" ? "Opp" : name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
