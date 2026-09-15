"use client"

import { cn } from "@/lib/utils"

// ─── Shared formatting ──────────────────────────────────────────────────────

/** Render a numeric value or an em-dash when null/undefined. */
export function fmt(value: number | null | undefined, digits = 1, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—"
  return `${value.toFixed(digits)}${suffix}`
}

/** Render a percentage where the value is ALREADY on a 0-100 scale (e.g. USG%, AST%). */
export function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—"
  return `${value.toFixed(digits)}%`
}

/**
 * Render a percentage where the value is stored as a DECIMAL fraction (0.478 →
 * "47.8%"). Used for FG%/3P%/FT%/eFG%/TS% and all shooting-zone make%, which
 * Basketball-Reference stores 0-1.
 */
export function fmtDecPct(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—"
  return `${(value * 100).toFixed(digits)}%`
}

// ─── Headline stat bar cell ───────────────────────────────────────────────

export function HeadlineStat({
  value,
  label,
  rank,
  sub,
  highlight,
}: {
  value: string
  label: string
  /** League rank shown beneath the label as "#N". */
  rank?: number | null
  /** Explicit sublabel text, overrides `rank` when provided. */
  sub?: string | null
  highlight?: boolean
}) {
  const subText = sub ?? (rank != null ? `#${rank} NBA` : null)
  return (
    <div
      className={cn(
        "relative flex-1 px-4 py-3.5 text-left border-r border-white/[0.06] last:border-r-0",
        highlight ? "min-w-[132px] bg-[var(--color-lime)]/[0.06]" : "min-w-[92px]"
      )}
    >
      {/* Accent marker for the flagship Overall Score module */}
      {highlight && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-lime)]" />}
      <div
        className={cn(
          "font-black tabular-nums leading-none",
          highlight ? "text-[26px] md:text-[30px] text-[var(--color-lime)]" : "text-xl md:text-2xl text-[var(--color-text-primary)]"
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          "text-[10px] font-bold uppercase tracking-wider mt-1.5",
          highlight ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)]"
        )}
      >
        {label}
      </div>
      {subText && (
        <div
          className={cn(
            "text-[10px] font-bold mt-0.5 tabular-nums tracking-wide",
            highlight ? "text-[var(--color-lime)]/80" : "text-[var(--color-text-primary)]/70"
          )}
        >
          {subText}
        </div>
      )}
    </div>
  )
}

// ─── Tab bar ─────────────────────────────────────────────────────────────

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide border-b border-white/[0.06]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "relative px-1 py-3 text-[12.5px] font-bold uppercase tracking-[0.08em] whitespace-nowrap transition-colors",
            active === t.id
              ? "text-white"
              : "text-[var(--color-text-muted)]/70 hover:text-[var(--color-text-primary)]"
          )}
        >
          {t.label}
          {active === t.id && (
            <span className="absolute -bottom-px left-0 right-0 h-[2.5px] rounded-full bg-[var(--color-lime)] shadow-[0_0_10px_rgba(212,255,0,0.5)]" />
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Card shell ─────────────────────────────────────────────────────────

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-2xl border border-white/[0.07] bg-[var(--color-surface)] overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          {title && <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

// ─── Sidebar info row (label / value) ─────────────────────────────────────

export function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value == null || value === "" ? "—" : value
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.05] last:border-b-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]/70">{label}</span>
      <span className="text-[12.5px] font-semibold text-white text-right">{display}</span>
    </div>
  )
}

// ─── Sidebar season-average bar row ───────────────────────────────────────

export function AverageBar({
  label,
  value,
  max,
}: {
  label: string
  value: number | null | undefined
  max: number
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-[var(--color-text-muted)]">{label}</span>
        <span className="text-[12px] font-bold tabular-nums text-[var(--color-text-primary)]">
          {value == null ? "—" : value.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-[var(--color-lime)] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Advanced-metric cell ─────────────────────────────────────────────────

export function MetricCell({
  value,
  label,
  rank,
}: {
  value: string
  label: string
  rank?: number | null
}) {
  return (
    <div className="px-3 py-3.5 text-center border-r border-b border-white/[0.05] last:border-r-0">
      <div className="text-lg font-black tabular-nums text-white leading-none">{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]/70 mt-1.5">{label}</div>
      {rank != null && <div className="text-[10px] font-bold text-[var(--color-lime)]/80 mt-0.5">#{rank}</div>}
    </div>
  )
}


