"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, X, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { AdvancedFilterState } from "@/lib/analytics/types"

interface AdvancedFiltersProps {
  filters: AdvancedFilterState
  sport: "NBA" | "Tennis" | "Soccer" | "NFL" | "NHL"
  teams: string[]
  activeCount: number
  onChange: (filters: AdvancedFilterState) => void
  onClear: () => void
}

export function AdvancedFilters({
  filters,
  sport,
  teams,
  activeCount,
  onChange,
  onClear,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)

  function updateFilter<K extends keyof AdvancedFilterState>(
    key: K,
    value: AdvancedFilterState[K]
  ) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="w-full">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-lime)]/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/50"
        aria-expanded={isOpen}
        aria-controls="advanced-filters-panel"
      >
        <SlidersHorizontal className="w-4 h-4 text-[var(--color-text-muted)]" />
        <span className="font-medium">Filters</span>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-lime)] text-[var(--color-bg)] text-xs font-bold">
            {activeCount}
          </span>
        )}
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)] ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] ml-auto" />
        )}
      </button>

      {/* Collapsible Panel */}
      {isOpen && (
        <div
          id="advanced-filters-panel"
          className="mt-2 p-4 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)] space-y-4"
        >
          {/* Header with Clear All */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Advanced Filters
            </h3>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                aria-label="Clear all filters"
              >
                <X className="w-3 h-3" />
                Clear All
              </button>
            )}
          </div>

          {/* Without Player (NBA only) */}
          {sport === "NBA" && (
            <div className="space-y-1.5">
              <label
                htmlFor="filter-without-player"
                className="text-xs font-medium text-[var(--color-text-muted)]"
              >
                Without Player
              </label>
              <input
                id="filter-without-player"
                type="text"
                value={filters.withoutPlayer}
                onChange={(e) => updateFilter("withoutPlayer", e.target.value)}
                placeholder="Teammate name..."
                maxLength={50}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-lime)]/50 focus:ring-1 focus:ring-[var(--color-lime)]/30"
              />
            </div>
          )}

          {/* Home/Away Toggle */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              Venue
            </span>
            <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]" role="radiogroup" aria-label="Venue filter">
              {(["all", "home", "away"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={filters.homeAway === option}
                  onClick={() => updateFilter("homeAway", option)}
                  className={cn(
                    "flex-1 px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    filters.homeAway === option
                      ? "bg-[var(--color-lime)] text-[var(--color-bg)]"
                      : "bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Opposing Team Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="filter-opposing-team"
              className="text-xs font-medium text-[var(--color-text-muted)]"
            >
              Opposing Team
            </label>
            <select
              id="filter-opposing-team"
              value={filters.opposingTeam ?? ""}
              onChange={(e) =>
                updateFilter("opposingTeam", e.target.value || null)
              }
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-lime)]/50 focus:ring-1 focus:ring-[var(--color-lime)]/30 appearance-none"
            >
              <option value="">All Teams</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          {/* Min Confidence Slider */}
          <div className="space-y-1.5">
            <label
              htmlFor="filter-min-confidence"
              className="text-xs font-medium text-[var(--color-text-muted)]"
            >
              Min Confidence: {filters.minConfidence}★
            </label>
            <input
              id="filter-min-confidence"
              type="range"
              min={1}
              max={5}
              step={1}
              value={filters.minConfidence}
              onChange={(e) =>
                updateFilter("minConfidence", Number(e.target.value))
              }
              className="w-full h-2 rounded-full appearance-none bg-[var(--color-border)] accent-[var(--color-lime)] cursor-pointer"
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={filters.minConfidence}
            />
            <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
              <span>1★</span>
              <span>2★</span>
              <span>3★</span>
              <span>4★</span>
              <span>5★</span>
            </div>
          </div>

          {/* Over/Under Toggle */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              Direction
            </span>
            <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]" role="radiogroup" aria-label="Direction filter">
              {(["all", "over", "under"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={filters.direction === option}
                  onClick={() => updateFilter("direction", option)}
                  className={cn(
                    "flex-1 px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    filters.direction === option
                      ? "bg-[var(--color-lime)] text-[var(--color-bg)]"
                      : "bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Hit Rate Range */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              Hit Rate Range: {filters.hitRateMin}% – {filters.hitRateMax}%
            </span>
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <label htmlFor="filter-hit-rate-min" className="sr-only">
                  Minimum hit rate
                </label>
                <input
                  id="filter-hit-rate-min"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={filters.hitRateMin}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    if (val <= filters.hitRateMax) {
                      updateFilter("hitRateMin", val)
                    }
                  }}
                  className="w-full h-2 rounded-full appearance-none bg-[var(--color-border)] accent-[var(--color-lime)] cursor-pointer"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={filters.hitRateMin}
                  aria-label="Minimum hit rate percentage"
                />
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">to</span>
              <div className="flex-1 space-y-1">
                <label htmlFor="filter-hit-rate-max" className="sr-only">
                  Maximum hit rate
                </label>
                <input
                  id="filter-hit-rate-max"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={filters.hitRateMax}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    if (val >= filters.hitRateMin) {
                      updateFilter("hitRateMax", val)
                    }
                  }}
                  className="w-full h-2 rounded-full appearance-none bg-[var(--color-border)] accent-[var(--color-lime)] cursor-pointer"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={filters.hitRateMax}
                  aria-label="Maximum hit rate percentage"
                />
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
