"use client"

import { CollapsibleSection } from "./CollapsibleSection"

// ─── Types ──────────────────────────────────────────────────────────────────

interface SourceTableSectionProps {
  /** Which stat groups are available for the current player */
  availableStats?: {
    hasShootingDistribution: boolean
    hasAdvancedStats: boolean
    hasDefenseStats: boolean
  }
}

// ─── Source Table Mappings ───────────────────────────────────────────────────

interface SourceTableGroup {
  id: string
  label: string
  stats: string[]
  /** Function to determine if this group should be visible */
  isVisible: (available?: SourceTableSectionProps["availableStats"]) => boolean
}

const SOURCE_TABLE_GROUPS: SourceTableGroup[] = [
  {
    id: "per-game",
    label: "Per Game",
    stats: ["FGA", "FTA", "FTM", "FT%", "3PA", "3PM", "3P%", "AST", "STL", "BLK", "TRB", "PTS"],
    isVisible: () => true, // Per-game stats are always available
  },
  {
    id: "shooting",
    label: "Shooting",
    stats: ["% of FGA by distance", "% of FG assisted"],
    isVisible: (available) => available?.hasShootingDistribution ?? true,
  },
  {
    id: "advanced",
    label: "Advanced",
    stats: ["TRB%", "ORB%", "DRB%", "AST%", "PGA"],
    isVisible: (available) => available?.hasAdvancedStats ?? true,
  },
  {
    id: "opponent",
    label: "Opponent Stats",
    stats: ["Team defensive stats by position"],
    isVisible: (available) => available?.hasDefenseStats ?? true,
  },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function SourceTableSection({ availableStats }: SourceTableSectionProps) {
  const visibleGroups = SOURCE_TABLE_GROUPS.filter((group) =>
    group.isVisible(availableStats)
  )

  if (visibleGroups.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl bg-white/5 overflow-hidden">
      {visibleGroups.map((group) => (
        <CollapsibleSection
          key={group.id}
          title={group.label}
          defaultExpanded={false}
        >
          <p className="text-xs text-[var(--color-text-muted)] font-mono leading-relaxed">
            {group.stats.join(", ")}
          </p>
        </CollapsibleSection>
      ))}
    </div>
  )
}
