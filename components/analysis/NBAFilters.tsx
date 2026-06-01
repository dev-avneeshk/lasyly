"use client"

import { useState } from "react"
import { SlidersHorizontal, Clock, Shield, UserMinus, X, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface NBAFilterValues {
  minMinutes: number        // 0 = no filter, otherwise 10-40
  vsOpponent: boolean       // only show games vs the upcoming opponent
  withoutPlayer: string     // teammate name to exclude games where they played
}

interface NBAFiltersProps {
  values: NBAFilterValues
  onChange: (values: NBAFilterValues) => void
  /** List of teammates for the autocomplete (optional) */
  teammates?: string[]
}

const MINUTES_OPTIONS = [
  { label: "Any", value: 0 },
  { label: "10+", value: 10 },
  { label: "15+", value: 15 },
  { label: "20+", value: 20 },
  { label: "25+", value: 25 },
  { label: "30+", value: 30 },
]

export function NBAFilters({ values, onChange, teammates }: NBAFiltersProps) {
  const [expanded, setExpanded] = useState(false)

  const activeCount = [
    values.minMinutes > 0,
    values.vsOpponent,
    values.withoutPlayer.trim() !== "",
  ].filter(Boolean).length

  const handleReset = () => {
    onChange({ minMinutes: 0, vsOpponent: false, withoutPlayer: "" })
  }

  return (
    <div className="w-full">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border",
          activeCount > 0
            ? "bg-[var(--color-lime)]/10 text-[var(--color-lime)] border-[var(--color-lime)]/30"
            : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-white hover:border-white/20"
        )}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--color-lime)] text-black text-[10px] font-bold">
            {activeCount}
          </span>
        )}
        <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
      </button>

      {/* Filter Panel */}
      {expanded && (
        <div className="mt-3 p-4 rounded-2xl bg-[var(--color-surface)]/80 border border-[var(--color-border)] backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-white uppercase tracking-wider">NBA Filters</span>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[10px] font-semibold text-[var(--color-text-muted)] hover:text-white transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Minutes Filter */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <Clock className="w-3.5 h-3.5" />
                Min Minutes
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MINUTES_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ ...values, minMinutes: opt.value })}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                      values.minMinutes === opt.value
                        ? "bg-[var(--color-lime)]/20 text-[var(--color-lime)] border border-[var(--color-lime)]/40"
                        : "bg-white/5 text-[var(--color-text-muted)] border border-transparent hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vs Opponent Filter */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <Shield className="w-3.5 h-3.5" />
                Vs Opponent
              </label>
              <button
                type="button"
                onClick={() => onChange({ ...values, vsOpponent: !values.vsOpponent })}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-[11px] font-semibold transition-all text-left border",
                  values.vsOpponent
                    ? "bg-[var(--color-lime)]/20 text-[var(--color-lime)] border-[var(--color-lime)]/40"
                    : "bg-white/5 text-[var(--color-text-muted)] border-transparent hover:bg-white/10 hover:text-white"
                )}
              >
                {values.vsOpponent ? "✓ Only vs upcoming opponent" : "All opponents"}
              </button>
              <p className="text-[10px] text-[var(--color-text-muted)]/60">
                Filter stats to only games against today&apos;s matchup opponent
              </p>
            </div>

            {/* Without Teammate Filter */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <UserMinus className="w-3.5 h-3.5" />
                Without Teammate
              </label>
              <input
                type="text"
                value={values.withoutPlayer}
                onChange={(e) => onChange({ ...values, withoutPlayer: e.target.value })}
                placeholder="e.g. Chet Holmgren"
                className="w-full px-3 py-2 rounded-lg text-[11px] font-medium bg-white/5 border border-[var(--color-border)] text-white placeholder:text-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-lime)]/50 focus:ring-1 focus:ring-[var(--color-lime)]/20 transition-all"
                list="teammate-suggestions"
              />
              {teammates && teammates.length > 0 && (
                <datalist id="teammate-suggestions">
                  {teammates.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              )}
              <p className="text-[10px] text-[var(--color-text-muted)]/60">
                Show stats from games where this teammate was out
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
