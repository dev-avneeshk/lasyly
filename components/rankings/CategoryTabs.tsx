"use client"

import { useRef } from "react"
import { cn } from "@/lib/utils"
import type { RankingType } from "@/lib/rankings/types"

const CATEGORIES: Array<{ type: RankingType | "teams"; label: string; description: string }> = [
  { type: "overall",     label: "Overall",     description: "Best players across all dimensions" },
  { type: "offense",     label: "Offense",     description: "OBPM, efficiency, volume, usage" },
  { type: "defense",     label: "Defense",     description: "DBPM, position-normalized defensive impact" },
  { type: "scoring",     label: "Scoring",     description: "Points, efficiency, consistency" },
  { type: "playmaking",  label: "Playmaking",  description: "Assists, assist %, vision" },
  { type: "rebounding",  label: "Rebounding",  description: "Position-normalized rebounding" },
  { type: "shooting",    label: "Shooting",    description: "TS%, 3P% volume-weighted, shot profile" },
  { type: "two_way",     label: "Two-Way",     description: "Elite on both ends" },
  { type: "teams",       label: "🏀 Teams",    description: "Team power rankings" },
]

interface CategoryTabsProps {
  active: RankingType | "teams"
  onChange: (type: RankingType | "teams") => void
}

export function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={scrollRef}
      className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
      role="tablist"
    >
      {CATEGORIES.map(({ type, label, description }) => {
        const isActive = active === type
        return (
          <button
            key={type}
            role="tab"
            aria-selected={isActive}
            aria-label={description}
            title={description}
            onClick={() => onChange(type as RankingType | "teams")}
            id={`rankings-tab-${type}`}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap border",
              isActive
                ? "bg-[var(--color-lime)] text-black border-[var(--color-lime)] shadow-[0_0_16px_rgba(212,255,0,0.3)]"
                : "bg-white/5 text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text-primary)] hover:bg-white/8 hover:border-white/15"
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
