"use client"

import { cn } from "@/lib/utils"
import { StatFilter } from "@/lib/props/types"

interface StatFiltersProps {
  filters: StatFilter[]
  activeStat: string
  onStatChange: (stat: string) => void
}

export function StatFilters({ filters, activeStat, onStatChange }: StatFiltersProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onStatChange(filter.key)}
          className={cn(
            "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
            activeStat === filter.key
              ? "bg-[var(--color-lime)] text-black"
              : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-white"
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  )
}
