"use client"

import { cn } from "@/lib/utils"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CheatSheetStat {
  key: string
  label: string
  category: "primary" | "secondary" | "context"
  explanation: string // max 120 chars
  value: number | null // null = "No data"
}

export interface CheatSheetSectionProps {
  cheatSheet: {
    propType: string
    stats: CheatSheetStat[]
  } | null
}

// ─── Category Badge Config ──────────────────────────────────────────────────

const CATEGORY_STYLES: Record<
  CheatSheetStat["category"],
  { label: string; className: string }
> = {
  primary: {
    label: "Primary",
    className:
      "bg-[var(--color-lime)]/15 text-[var(--color-lime)] border-[var(--color-lime)]/30",
  },
  secondary: {
    label: "Secondary",
    className:
      "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  context: {
    label: "Context",
    className:
      "bg-gray-500/15 text-gray-400 border-gray-500/30",
  },
}

const CATEGORY_ORDER: CheatSheetStat["category"][] = [
  "primary",
  "secondary",
  "context",
]

// ─── Component ──────────────────────────────────────────────────────────────

export function CheatSheetSection({ cheatSheet }: CheatSheetSectionProps) {
  // Unsupported prop type — cheatSheet is null
  if (!cheatSheet) {
    return (
      <div className="rounded-xl bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-white mb-2">
          Prop Cheat Sheet
        </h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          Cheat sheet not available for this prop type.
        </p>
      </div>
    )
  }

  // Group stats by category in order: primary → secondary → context
  const groupedStats = CATEGORY_ORDER.map((category) => ({
    category,
    stats: cheatSheet.stats.filter((s) => s.category === category),
  })).filter((group) => group.stats.length > 0)

  return (
    <div className="rounded-xl bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">
        Prop Cheat Sheet
        <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
          {cheatSheet.propType}
        </span>
      </h3>

      <div className="space-y-4">
        {groupedStats.map(({ category, stats }) => (
          <div key={category}>
            {/* Category group header */}
            <div className="flex items-center gap-2 mb-2">
              <CategoryBadge category={category} />
              <div className="flex-1 h-px bg-[var(--color-border)]/30" />
            </div>

            {/* Stats in this category */}
            <div className="space-y-2">
              {stats.map((stat) => (
                <CheatSheetStatRow key={stat.key} stat={stat} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Category Badge ─────────────────────────────────────────────────────────

function CategoryBadge({
  category,
}: {
  category: CheatSheetStat["category"]
}) {
  const config = CATEGORY_STYLES[category]

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
        config.className
      )}
    >
      {config.label}
    </span>
  )
}

// ─── Stat Row ───────────────────────────────────────────────────────────────

function CheatSheetStatRow({ stat }: { stat: CheatSheetStat }) {
  return (
    <div className="flex items-start gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
      {/* Stat name and value */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white truncate">
            {stat.label}
          </span>
          <span
            className={cn(
              "text-xs font-mono shrink-0",
              stat.value !== null
                ? "text-[var(--color-text-secondary)]"
                : "text-[var(--color-text-muted)] italic"
            )}
          >
            {stat.value !== null ? formatValue(stat.value) : "No data"}
          </span>
        </div>
        {/* Explanation */}
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed line-clamp-2">
          {stat.explanation}
        </p>
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatValue(value: number): string {
  // Display percentages and per-game values with appropriate precision
  if (Number.isInteger(value)) {
    return value.toString()
  }
  // Use up to 2 decimal places, trimming trailing zeros
  return value.toFixed(2).replace(/\.?0+$/, "") || "0"
}
