/**
 * Small display helpers shared by the props table, value cards and toolbar.
 */

import type { EnhancedPropCardData } from "@/lib/analytics/types"

/** Short stat label used next to a line, e.g. "Under 4.5 AST". */
export const STAT_ABBR: Record<string, string> = {
  pts: "PTS",
  trb: "REB",
  reb: "REB",
  ast: "AST",
  tp: "3PM",
  stl: "STL",
  blk: "BLK",
  tov: "TOV",
  fg: "FGM",
  fga: "FGA",
  ft: "FTM",
  fta: "FTA",
  pra: "PRA",
}

export function statAbbr(stat: string): string {
  return STAT_ABBR[stat] ?? stat.toUpperCase()
}

/** "Dylan Harper" -> "D. Harper". */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`
}

export type PositionGroup = "G" | "F" | "C"

/** Guard / Forward / Center buckets from positions like "PG", "SF-PF", "C". */
export function positionGroups(position?: string | null): Set<PositionGroup> {
  const out = new Set<PositionGroup>()
  for (const raw of (position ?? "").toUpperCase().split(/[^A-Z]+/)) {
    if (!raw) continue
    if (raw.includes("C")) out.add("C")
    if (raw.includes("F")) out.add("F")
    if (raw.includes("G")) out.add("G")
  }
  return out
}

export function positionOf(prop: EnhancedPropCardData): string | null {
  return (prop as unknown as { position?: string | null }).position ?? null
}

export function headshotOf(prop: EnhancedPropCardData): string | null {
  return (prop as unknown as { headshotUrl?: string | null }).headshotUrl ?? null
}

export function projectionOf(prop: EnhancedPropCardData): number | null {
  const p = (prop as unknown as { projection?: { projection?: number | null } | null }).projection?.projection
  return typeof p === "number" && Number.isFinite(p) ? p : null
}

/** Side to display: the scored side, else the engine's direction. */
export function sideOf(prop: EnhancedPropCardData): "over" | "under" {
  return prop.propValue?.side ?? prop.direction ?? "over"
}

/** L10 record on the line for the displayed side. */
export function sideRecord(prop: EnhancedPropCardData): { hits: number; games: number; pct: number } {
  if (prop.propValue && prop.propValue.games > 0) {
    const { hits, games } = prop.propValue
    return { hits, games, pct: Math.round((hits / games) * 100) }
  }
  const total = prop.hitRate?.total ?? 0
  const over = prop.hitRate?.over ?? 0
  const hits = sideOf(prop) === "over" ? over : total - over
  return { hits, games: total, pct: total > 0 ? Math.round((hits / total) * 100) : 0 }
}

/** Expected value as a signed percent, e.g. "+18.2%". */
export function formatValue(value: number | null | undefined): string {
  if (value == null) return "—"
  const pct = Math.round(value * 1000) / 10
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
}

/** Hit-rate colour bands: under 50% red, 50-89% orange, 90%+ green. */
export function hitRateToneClass(pct: number): { text: string; bar: string } {
  if (pct >= 90) return { text: "text-emerald-400", bar: "bg-emerald-400" }
  if (pct >= 50) return { text: "text-orange-400", bar: "bg-orange-400" }
  return { text: "text-red-400", bar: "bg-red-400" }
}
