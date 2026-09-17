"use client"

import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StatTab {
  key: string
  label: string
}

export interface SeasonOption {
  value: string
  label: string
}

interface PropControlsProps {
  stats: StatTab[]
  activeStat: string
  onStatChange: (key: string) => void
  /** Sample windows, e.g. `["L5","L10","L15","L30"]`. */
  windows: string[]
  activeWindow: string
  onWindowChange: (window: string) => void
  /** Omit to hide the season selector entirely. */
  seasons?: SeasonOption[]
  activeSeason?: string
  onSeasonChange?: (value: string) => void
}

/**
 * The control bar above the performance chart: stat tabs on the left, sample
 * window and season on the right.
 */
export function PropControls({
  stats,
  activeStat,
  onStatChange,
  windows,
  activeWindow,
  onWindowChange,
  seasons,
  activeSeason,
  onSeasonChange,
}: PropControlsProps) {
  const showSeasons = !!seasons && seasons.length > 0 && !!onSeasonChange

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {/* Stat tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 overflow-x-auto scrollbar-hide"
        role="tablist"
        aria-label="Stat category"
      >
        {stats.map((stat) => {
          const isActive = stat.key === activeStat
          return (
            <button
              key={stat.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onStatChange(stat.key)}
              className={cn(
                "relative shrink-0 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors",
                isActive
                  ? "bg-[var(--color-surface-elevated)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.03]"
              )}
            >
              {stat.label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 bottom-1 h-[2px] rounded-full bg-[var(--color-lime)]"
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Sample window */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70"
          role="group"
          aria-label="Sample window"
        >
          {windows.map((window) => {
            const isActive = window === activeWindow
            return (
              <button
                key={window}
                type="button"
                onClick={() => onWindowChange(window)}
                aria-pressed={isActive}
                className={cn(
                  "relative px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors",
                  isActive
                    ? "text-[var(--color-lime)] bg-[var(--color-lime)]/[0.08]"
                    : "text-[var(--color-text-muted)] hover:text-white"
                )}
              >
                {window}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 bottom-1 h-[2px] rounded-full bg-[var(--color-lime)]"
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Season */}
        {showSeasons && (
          <div className="relative">
            <select
              value={activeSeason}
              onChange={(e) => onSeasonChange?.(e.target.value)}
              aria-label="Season"
              className="appearance-none h-[42px] pl-3.5 pr-9 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 text-[12px] font-bold text-white outline-none hover:border-white/20 focus:border-[var(--color-lime)]/60 transition-colors cursor-pointer"
            >
              {seasons!.map((season) => (
                <option key={season.value} value={season.value} className="bg-[var(--color-surface-elevated)]">
                  {season.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none"
            />
          </div>
        )}
      </div>
    </div>
  )
}
