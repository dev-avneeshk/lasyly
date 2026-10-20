"use client"

import { ChevronDown, LayoutGrid, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type PropSortKey = "value" | "chance" | "hitRate" | "multiplier" | "projection" | "name"
export type PropViewMode = "table" | "grid"
export type PositionFilter = "all" | "G" | "F" | "C"
export type SideFilter = "all" | "over" | "under"

export const SORT_OPTIONS: { key: PropSortKey; label: string }[] = [
  { key: "value", label: "Best Value" },
  { key: "chance", label: "Chance to Hit" },
  { key: "hitRate", label: "Hit Rate (L10)" },
  { key: "multiplier", label: "Multiplier" },
  { key: "projection", label: "Projection vs Line" },
  { key: "name", label: "Player (A–Z)" },
]

interface PropsToolbarProps {
  teams: string[]
  team: string
  onTeamChange: (team: string) => void
  /** Omit to hide the position select (sports without positions). */
  position?: PositionFilter
  onPositionChange?: (position: PositionFilter) => void
  side: SideFilter
  onSideChange: (side: SideFilter) => void
  sortBy: PropSortKey
  onSortChange: (key: PropSortKey) => void
  viewMode: PropViewMode
  onViewModeChange: (mode: PropViewMode) => void
  /** Right-hand slot, e.g. the advanced Filters button. */
  children?: React.ReactNode
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  prefix,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  prefix?: string
}) {
  const active = options.find((o) => o.value === value)
  return (
    <label className="relative flex h-9 min-w-[150px] items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/70 pl-3 pr-8 text-[12px] hover:border-white/20 focus-within:border-[var(--color-lime)]/60 transition-colors cursor-pointer">
      <span className="sr-only">{label}</span>
      <span aria-hidden className="truncate">
        {prefix && <span className="text-[var(--color-text-muted)]">{prefix} </span>}
        <span className="font-semibold text-[var(--color-text-primary)]">{active?.label}</span>
      </span>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[var(--color-surface-elevated)] text-white">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function PropsToolbar({
  teams,
  team,
  onTeamChange,
  position,
  onPositionChange,
  side,
  onSideChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  children,
}: PropsToolbarProps) {
  return (
    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          label="Team"
          value={team}
          onChange={onTeamChange}
          options={[{ value: "all", label: "All Teams" }, ...teams.map((t) => ({ value: t, label: t }))]}
        />
        {position !== undefined && onPositionChange && (
          <Select<PositionFilter>
            label="Position"
            value={position}
            onChange={onPositionChange}
            options={[
              { value: "all", label: "All Positions" },
              { value: "G", label: "Guards" },
              { value: "F", label: "Forwards" },
              { value: "C", label: "Centers" },
            ]}
          />
        )}
        <Select<SideFilter>
          label="Side"
          value={side}
          onChange={onSideChange}
          options={[
            { value: "all", label: "Overs & Unders" },
            { value: "over", label: "Overs only" },
            { value: "under", label: "Unders only" },
          ]}
        />
        <Select<PropSortKey>
          label="Sort by"
          prefix="Sort by:"
          value={sortBy}
          onChange={onSortChange}
          options={SORT_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
        />
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-1"
          role="group"
          aria-label="Layout"
        >
          {([
            { mode: "table", label: "Table View", Icon: Table2 },
            { mode: "grid", label: "Card View", Icon: LayoutGrid },
          ] as const).map(({ mode, label, Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              aria-pressed={viewMode === mode}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold transition-colors",
                viewMode === mode
                  ? "border border-[var(--color-lime)]/60 bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        {children}
      </div>
    </div>
  )
}
