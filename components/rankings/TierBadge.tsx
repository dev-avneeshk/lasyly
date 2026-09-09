"use client"

import { cn } from "@/lib/utils"
import type { RankingTier } from "@/lib/rankings/types"

interface TierBadgeProps {
  tier: RankingTier | string
  compact?: boolean
  className?: string
}

const TIER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  "Ω — Apex":      { bg: "bg-gradient-to-r from-yellow-400/20 to-amber-400/20", text: "text-yellow-400",  label: "APEX" },
  "X — Mythic":    { bg: "bg-gradient-to-r from-pink-400/20 to-fuchsia-400/20",  text: "text-pink-400",   label: "MYTHIC" },
  "S — Elite":     { bg: "bg-gradient-to-r from-purple-400/20 to-violet-400/20", text: "text-purple-400", label: "ELITE" },
  "A — Dominant":  { bg: "bg-gradient-to-r from-blue-400/20 to-sky-400/20",     text: "text-blue-400",   label: "DOMINANT" },
  "B — Impact":    { bg: "bg-gradient-to-r from-emerald-400/20 to-green-400/20",text: "text-emerald-400",label: "IMPACT" },
  "C — Rotation":  { bg: "bg-[var(--color-lime)]/15",                           text: "text-[var(--color-lime)]", label: "ROTATION" },
  "D — Limited":   { bg: "bg-slate-400/10",                                     text: "text-slate-400",  label: "LIMITED" },
  "E — Fringe":    { bg: "bg-gray-600/10",                                      text: "text-gray-500",   label: "FRINGE" },
}

export function TierBadge({ tier, compact = false, className }: TierBadgeProps) {
  const styles = TIER_STYLES[tier] ?? TIER_STYLES["Fringe"]

  return (
    <span
      className={cn(
        "font-bold uppercase tracking-wider rounded-md",
        compact ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-1",
        styles.bg,
        styles.text,
        className
      )}
    >
      {styles.label}
    </span>
  )
}
