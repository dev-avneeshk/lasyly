"use client"

import { cn } from "@/lib/utils"
import type { RankingTier } from "@/lib/rankings/types"

interface TierBadgeProps {
  /**
   * Canonical tier label (see `RankingTier`). Accepts any string — and
   * null/undefined — because tiers arrive from Supabase rows and serialized
   * server props where the union isn't enforced at runtime.
   */
  tier: RankingTier | string | null | undefined
  compact?: boolean
  className?: string
}

type TierStyle = { bg: string; text: string; label: string }

const TIER_STYLES: Record<string, TierStyle> = {
  "Ω — Apex":      { bg: "bg-gradient-to-r from-yellow-400/20 to-amber-400/20", text: "text-yellow-400",  label: "APEX" },
  "X — Mythic":    { bg: "bg-gradient-to-r from-pink-400/20 to-fuchsia-400/20",  text: "text-pink-400",   label: "MYTHIC" },
  "S — Elite":     { bg: "bg-gradient-to-r from-purple-400/20 to-violet-400/20", text: "text-purple-400", label: "ELITE" },
  "A — Dominant":  { bg: "bg-gradient-to-r from-blue-400/20 to-sky-400/20",     text: "text-blue-400",   label: "DOMINANT" },
  "B — Impact":    { bg: "bg-gradient-to-r from-emerald-400/20 to-green-400/20",text: "text-emerald-400",label: "IMPACT" },
  "C — Rotation":  { bg: "bg-[var(--color-lime)]/15",                           text: "text-[var(--color-lime)]", label: "ROTATION" },
  "D — Limited":   { bg: "bg-slate-400/10",                                     text: "text-slate-400",  label: "LIMITED" },
  "E — Fringe":    { bg: "bg-gray-600/10",                                      text: "text-gray-500",   label: "FRINGE" },
}

/**
 * Used whenever the incoming tier can't be resolved. Referenced by value
 * rather than by key so it can't silently become `undefined` again — the
 * previous `TIER_STYLES["Fringe"]` lookup missed (the real key is
 * "E — Fringe") and every unrecognised tier threw on `styles.bg`.
 */
const FALLBACK_TIER_STYLE: TierStyle = TIER_STYLES["E — Fringe"]

/**
 * Collapses the variations that actually reach this component — a plain
 * hyphen or en dash instead of the canonical em dash, stray whitespace, and
 * inconsistent casing — onto one comparable form.
 */
function normalizeTierKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u2012-\u2015]/g, "-") // figure/en/em/horizontal dash → hyphen
    .replace(/\s+/g, " ")
}

/**
 * Alias index built from `TIER_STYLES`: each tier is reachable by its full
 * label, its grade alone ("E"), or its name alone ("Fringe").
 */
const TIER_LOOKUP: Record<string, TierStyle> = Object.entries(TIER_STYLES).reduce<
  Record<string, TierStyle>
>((index, [key, style]) => {
  const [grade, name] = key.split("—").map((part) => part.trim())
  for (const alias of [key, grade, name]) {
    if (alias) index[normalizeTierKey(alias)] = style
  }
  return index
}, {})

export function TierBadge({ tier, compact = false, className }: TierBadgeProps) {
  const styles = (tier && TIER_LOOKUP[normalizeTierKey(tier)]) || FALLBACK_TIER_STYLE

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
