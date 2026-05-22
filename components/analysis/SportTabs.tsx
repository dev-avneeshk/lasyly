"use client"

import { cn } from "@/lib/utils"

interface SportTabsProps {
  activeSport: "NBA" | "Tennis" | "Soccer" | "NFL" | "NHL"
  onSportChange: (sport: "NBA" | "Tennis" | "Soccer" | "NFL" | "NHL") => void
}

const SPORTS = ["NBA", "Soccer", "NFL", "NHL", "Tennis"] as const

export function SportTabs({ activeSport, onSportChange }: SportTabsProps) {
  return (
    <div className="flex items-center gap-6 border-b border-[var(--color-border)] overflow-x-auto scrollbar-hide">
      {SPORTS.map((sport) => (
        <button
          key={sport}
          onClick={() => onSportChange(sport)}
          className={cn(
            "pb-3 text-sm font-semibold tracking-wide uppercase transition-colors whitespace-nowrap",
            activeSport === sport
              ? "text-[var(--color-lime)] border-b-2 border-[var(--color-lime)]"
              : "text-[var(--color-text-muted)] hover:text-white"
          )}
        >
          {sport}
        </button>
      ))}
    </div>
  )
}
