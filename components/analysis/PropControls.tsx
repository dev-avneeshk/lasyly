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

interface StatTabsProps {
  stats: StatTab[]
  activeStat: string
  onStatChange: (key: string) => void
}

/** Stat category tabs, shown above the performance chart. */
export function StatTabs({ stats, activeStat, onStatChange }: StatTabsProps) {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 overflow-x-auto scrollbar-hide self-start max-w-full"
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
  )
}

interface SampleFiltersProps {
  /** Sample windows, e.g. `["L5","L10","L15","L30"]`. */
  windows: string[]
  activeWindow: string
  onWindowChange: (window: string) => void
  /** Omit to hide the season selector entirely. */
  seasons?: SeasonOption[]
  activeSeason?: string
  onSeasonChange?: (value: string) => void
  /** Toggle that limits the sample to games vs the upcoming opponent. Omit to hide. */
  opponentFilter?: {
    label: string
    active: boolean
    onToggle: () => void
  }
  /** Minimum-minutes selector. Omit to hide. */
  minutesFilter?: {
    options: SeasonOption[]
    value: string
    onChange: (value: string) => void
  }
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  highlighted,
}: {
  label: string
  value: string
  options: SeasonOption[]
  onChange: (value: string) => void
  highlighted?: boolean
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(
          "appearance-none h-[38px] pl-3.5 pr-9 rounded-xl border bg-[var(--color-surface-elevated)]/40 text-[12px] font-bold outline-none hover:border-white/20 focus:border-[var(--color-lime)]/60 transition-colors cursor-pointer",
          highlighted
            ? "border-[var(--color-lime)]/40 text-[var(--color-lime)]"
            : "border-[var(--color-border)] text-white"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[var(--color-surface-elevated)] text-white">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none"
      />
    </div>
  )
}

/**
 * Sample controls (window, opponent, season type). Rendered in the chart
 * card's footer, directly under the bars they filter.
 */
export function SampleFilters({
  windows,
  activeWindow,
  onWindowChange,
  seasons,
  activeSeason,
  onSeasonChange,
  opponentFilter,
  minutesFilter,
}: SampleFiltersProps) {
  const showSeasons = !!seasons && seasons.length > 0 && !!onSeasonChange

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Sample window */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40"
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

      {/* vs upcoming opponent */}
      {opponentFilter && (
        <button
          type="button"
          onClick={opponentFilter.onToggle}
          aria-pressed={opponentFilter.active}
          className={cn(
            "h-[38px] px-3.5 rounded-xl border text-[12px] font-bold transition-colors",
            opponentFilter.active
              ? "border-[var(--color-lime)]/40 bg-[var(--color-lime)]/[0.08] text-[var(--color-lime)]"
              : "border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 text-[var(--color-text-muted)] hover:text-white hover:border-white/20"
          )}
        >
          {opponentFilter.label}
        </button>
      )}

      {/* Season / season type */}
      {showSeasons && (
        <FilterSelect
          label="Season"
          value={activeSeason ?? ""}
          options={seasons!}
          onChange={(v) => onSeasonChange?.(v)}
          highlighted={activeSeason !== undefined && activeSeason !== seasons![0]?.value}
        />
      )}

      {/* Minimum minutes */}
      {minutesFilter && (
        <FilterSelect
          label="Minutes"
          value={minutesFilter.value}
          options={minutesFilter.options}
          onChange={minutesFilter.onChange}
          highlighted={minutesFilter.value !== minutesFilter.options[0]?.value}
        />
      )}
    </div>
  )
}
