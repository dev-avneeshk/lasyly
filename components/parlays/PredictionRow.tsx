"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatOdds } from "@/lib/parlays/computations"
import type { ParlayWithLegs, ParlayLegRow } from "@/lib/types/parlay"

// ─── Sport badge styling ─────────────────────────────────────────────────────
// Each sport gets its own accent so rows are scannable at a glance, mirroring
// the league-tile look in the reference design.

const SPORT_STYLE: Record<string, { label: string; className: string }> = {
  NBA: { label: "NBA", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  NFL: { label: "NFL", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  Soccer: { label: "SOC", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  NHL: { label: "NHL", className: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  Tennis: { label: "TEN", className: "bg-lime-500/15 text-lime-400 border-lime-500/30" },
}

function sportStyle(sport: string) {
  return (
    SPORT_STYLE[sport] ?? {
      label: sport.slice(0, 3).toUpperCase(),
      className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    }
  )
}

// ─── Status badge configuration ──────────────────────────────────────────────

const STATUS_CONFIG = {
  won: {
    label: "WIN",
    className: "bg-lime-500/15 text-lime-400 border-lime-500/40",
  },
  lost: {
    label: "LOSS",
    className: "bg-red-500/15 text-red-400 border-red-500/40",
  },
  pending: {
    label: "PENDING",
    className: "bg-white/5 text-zinc-300 border-white/15",
  },
} as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  const h = hours % 12 || 12
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()} · ${h}:${minutes} ${ampm}`
}

function legLabel(leg: ParlayLegRow): string {
  const dir = leg.direction === "over" ? "Over" : "Under"
  return `${dir} ${leg.prop_line} ${leg.stat_category}`
}

/**
 * Net profit/loss in units for a single parlay, using the same convention as
 * computeParlayStats: won → stake × (odds − 1), lost → −stake. Returns null
 * when stake/odds are missing or the parlay is still pending.
 */
function unitResult(parlay: ParlayWithLegs): number | null {
  if (parlay.stake == null || parlay.odds == null) return null
  if (parlay.status === "won") return parlay.stake * (parlay.odds - 1)
  if (parlay.status === "lost") return -parlay.stake
  return null
}

function formatUnits(n: number): string {
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(2)}u`
}

// ─── Leg list (expanded picks) ───────────────────────────────────────────────

function LegRow({ leg }: { leg: ParlayLegRow }) {
  const status: "hit" | "miss" | "pending" =
    leg.result === "won" || leg.result === "push"
      ? "hit"
      : leg.result === "lost"
        ? "miss"
        : "pending"

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--color-border)] last:border-b-0">
      <div className="flex items-center gap-3 min-w-0">
        {status === "hit" ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-400" />
        ) : status === "miss" ? (
          <XCircle className="h-4 w-4 shrink-0 text-red-400" />
        ) : (
          <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
        )}
        <div className="flex flex-col min-w-0">
          <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {legLabel(leg)}
          </span>
          <span className="truncate text-xs text-[var(--color-text-muted)]">
            {leg.player_name} · {leg.sport}
          </span>
        </div>
      </div>
      {leg.l10_hit_rate != null && (
        <span className="shrink-0 text-xs font-semibold text-[var(--color-text-muted)]">
          L10 {leg.l10_hit_rate}%
        </span>
      )}
    </div>
  )
}

// ─── Prediction row ──────────────────────────────────────────────────────────

export interface PredictionRowProps {
  parlay: ParlayWithLegs
}

export default function PredictionRow({ parlay }: PredictionRowProps) {
  const [showPicks, setShowPicks] = useState(false)

  const primaryLeg = parlay.legs[0]
  const sport = primaryLeg?.sport ?? "—"
  const badge = sportStyle(sport)
  const status = STATUS_CONFIG[parlay.status]
  const isMulti = parlay.legs.length > 1

  const units = unitResult(parlay)
  const plClass =
    parlay.status === "won"
      ? "text-lime-400"
      : parlay.status === "lost"
        ? "text-red-400"
        : "text-[var(--color-text-muted)]"

  // Headline pick text: for single picks show the pick itself, otherwise a
  // parlay summary with the first pick as context.
  const title = isMulti
    ? `${parlay.legs.length}-Pick Parlay`
    : primaryLeg
      ? legLabel(primaryLeg)
      : "Prediction"
  const subtitle = isMulti
    ? parlay.legs.map((l) => l.player_name).join(" · ")
    : primaryLeg?.player_name ?? ""

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-white/15">
      {/* Main row */}
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
        {/* Sport badge */}
        <div className="flex shrink-0 items-center gap-3">
          <div
            className={cn(
              "flex h-11 w-11 flex-col items-center justify-center rounded-xl border text-[11px] font-black",
              badge.className,
            )}
          >
            {badge.label}
          </div>
          <span className="rounded-md border border-[var(--color-border)] bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] md:hidden">
            {isMulti ? `${parlay.legs.length}-Pick` : "Single"}
          </span>
        </div>

        {/* Pick + matchup */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md border border-[var(--color-border)] bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] md:inline-block">
              {isMulti ? `${parlay.legs.length}-Pick` : "Single"}
            </span>
            <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">
              {title}
            </span>
          </div>
          {subtitle && (
            <span className="truncate text-xs text-[var(--color-text-muted)]">{subtitle}</span>
          )}
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            <Clock className="h-3 w-3" />
            {formatDate(parlay.created_at)}
          </div>
        </div>

        {/* Odds */}
        <div className="flex shrink-0 items-center justify-between gap-6 md:justify-start">
          <div className="flex w-16 flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Odds
            </span>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              {parlay.odds != null ? formatOdds(parlay.odds) : "—"}
            </span>
          </div>

          {/* Stake */}
          <div className="flex w-16 flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Stake
            </span>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              {parlay.stake != null ? `${parlay.stake.toFixed(1)}u` : "—"}
            </span>
          </div>
        </div>

        {/* Status + P/L + chevron */}
        <div className="flex shrink-0 items-center justify-between gap-4 md:justify-end">
          <span
            className={cn(
              "rounded-lg border px-3 py-1.5 text-[11px] font-black tracking-wide",
              status.className,
            )}
          >
            {status.label}
          </span>

          <div className="flex w-20 flex-col items-end">
            <span className={cn("text-sm font-bold tabular-nums", plClass)}>
              {units != null ? formatUnits(units) : "–"}
            </span>
          </div>

          <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
        </div>
      </div>

      {/* Show picks toggle */}
      <div className="flex items-center justify-end border-t border-[var(--color-border)] px-4 py-2">
        <button
          type="button"
          onClick={() => setShowPicks((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
        >
          Show Picks
          {showPicks ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Expanded picks */}
      <AnimatePresence initial={false}>
        {showPicks && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col border-t border-[var(--color-border)] px-4 py-1">
              {parlay.legs.map((leg) => (
                <LegRow key={leg.id} leg={leg} />
              ))}
              {parlay.custom_note && (
                <div className="my-3 flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 py-2.5">
                  <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-lime)]" />
                  <p className="text-xs italic leading-relaxed text-[var(--color-text-muted)]">
                    {parlay.custom_note}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
