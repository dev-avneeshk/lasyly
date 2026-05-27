"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatOdds, computePayout } from "@/lib/parlays/computations"
import type { ParlayBetslipCardProps, ParlayLegRow } from "@/lib/types/parlay"

// --- Status badge configuration ---

const STATUS_CONFIG = {
  won: {
    label: "Win",
    className: "bg-lime-500/20 text-lime-400 border-lime-500/30",
  },
  lost: {
    label: "Loss",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
  pending: {
    label: "Live",
    className: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
} as const

// --- Date formatting ---

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  const h = hours % 12 || 12
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()} ${h}:${minutes} ${ampm}`
}

// --- Leg status icon (hit/miss) ---

function LegStatusIcon({ status }: { status: "hit" | "miss" | "pending" }) {
  if (status === "hit") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-500">
        <CheckCircle2 className="h-4 w-4 text-black" />
      </div>
    )
  }
  if (status === "miss") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-600">
        <XCircle className="h-4 w-4 text-zinc-300" />
      </div>
    )
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40">
      <Clock className="h-3.5 w-3.5 text-amber-400" />
    </div>
  )
}

// --- Progress bar for a leg ---

function LegProgressBar({ leg, parlayStatus }: { leg: ParlayLegRow; parlayStatus: string }) {
  // Since we don't have live stat data, we show the line as a reference
  // For resolved parlays, we can infer hit/miss from parlay status
  // For now, show the prop line as a visual indicator
  const isOver = leg.direction === "over"
  const hitRate = leg.l10_hit_rate ?? 50

  // Determine if this leg "hit" based on parlay status and hit rate
  // In a real implementation, you'd have actual game results
  const legStatus: "hit" | "miss" | "pending" =
    parlayStatus === "pending" ? "pending" :
    parlayStatus === "won" ? "hit" :
    // For lost parlays, use hit rate as a heuristic (>60% likely hit, <40% likely missed)
    hitRate >= 60 ? "hit" : "miss"

  const barColor = legStatus === "hit" ? "bg-lime-500" : legStatus === "miss" ? "bg-zinc-500" : "bg-amber-500"
  const barWidth = Math.min(Math.max(hitRate, 10), 100)

  return (
    <div className="flex flex-col gap-3 py-4 border-b border-zinc-800/50 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <p className="text-sm font-bold text-white">
            {isOver ? "Over" : "Under"} {leg.prop_line} {leg.stat_category}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">{leg.player_name}</p>
        </div>
        <LegStatusIcon status={legStatus} />
      </div>
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <span className={cn(
          "text-xs font-bold px-2 py-0.5 rounded",
          legStatus === "hit" ? "bg-lime-500/20 text-lime-400" :
          legStatus === "miss" ? "bg-zinc-700 text-zinc-300" :
          "bg-amber-500/20 text-amber-400"
        )}>
          {leg.l10_hit_rate != null ? `${leg.l10_hit_rate}%` : "—"}
        </span>
      </div>
    </div>
  )
}

// --- Compact Variant (collapsed view) ---

function CompactVariant({
  parlay,
  onToggleExpand,
}: Pick<ParlayBetslipCardProps, "parlay" | "onToggleExpand">) {
  const config = STATUS_CONFIG[parlay.status]

  return (
    <button
      type="button"
      onClick={onToggleExpand}
      className="flex flex-col w-full rounded-xl border border-zinc-800 bg-[#0f1923] p-4 text-left transition-colors hover:border-zinc-700"
    >
      {/* Header row */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 border border-zinc-700">
            <span className="text-[9px] font-black text-zinc-300">SGM</span>
          </div>
          <span className="text-sm font-bold text-white">
            {parlay.legs.length} Leg Parlay
          </span>
        </div>
        <span className={cn("rounded-md border px-2.5 py-1 text-[11px] font-bold", config.className)}>
          {config.label}
        </span>
      </div>

      {/* Status icons row */}
      <div className="flex items-center gap-1.5 mt-3">
        {parlay.legs.map((leg) => {
          const legStatus: "hit" | "miss" | "pending" =
            parlay.status === "pending" ? "pending" :
            parlay.status === "won" ? "hit" :
            (leg.l10_hit_rate ?? 50) >= 60 ? "hit" : "miss"
          return (
            <div key={leg.id} className="flex items-center">
              {legStatus === "hit" ? (
                <CheckCircle2 className="h-5 w-5 text-lime-500" />
              ) : legStatus === "miss" ? (
                <XCircle className="h-5 w-5 text-zinc-500" />
              ) : (
                <Clock className="h-5 w-5 text-amber-400" />
              )}
            </div>
          )
        })}
        <div className="ml-auto flex items-center gap-1 text-xs text-zinc-400">
          <span>Show Legs</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Date */}
      <p className="mt-2 text-[11px] text-zinc-500">{formatDate(parlay.created_at)}</p>
    </button>
  )
}

// --- Expanded Variant (Stake-style with legs visible) ---

function ExpandedVariant({
  parlay,
  onStatusChange,
  onToggleExpand,
  showActions,
}: Pick<
  ParlayBetslipCardProps,
  "parlay" | "onStatusChange" | "onToggleExpand" | "showActions"
>) {
  const config = STATUS_CONFIG[parlay.status]
  const payout =
    parlay.stake != null && parlay.odds != null
      ? computePayout(parlay.stake, parlay.odds)
      : null

  return (
    <div className="flex flex-col rounded-xl border border-zinc-800 bg-[#0f1923] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 border border-zinc-700">
            <span className="text-[9px] font-black text-zinc-300">SGM</span>
          </div>
          <span className="text-sm font-bold text-white">
            {parlay.legs.length} Leg Parlay
          </span>
        </div>
        <span className={cn("rounded-md border px-2.5 py-1 text-[11px] font-bold", config.className)}>
          {config.label}
        </span>
      </div>

      {/* Date */}
      <p className="px-4 text-[11px] text-zinc-500">{formatDate(parlay.created_at)}</p>

      {/* Status icons row + Hide Legs toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-1.5">
          {parlay.legs.map((leg) => {
            const legStatus: "hit" | "miss" | "pending" =
              parlay.status === "pending" ? "pending" :
              parlay.status === "won" ? "hit" :
              (leg.l10_hit_rate ?? 50) >= 60 ? "hit" : "miss"
            return (
              <div key={leg.id}>
                {legStatus === "hit" ? (
                  <CheckCircle2 className="h-5 w-5 text-lime-500" />
                ) : legStatus === "miss" ? (
                  <XCircle className="h-5 w-5 text-zinc-500" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-400" />
                )}
              </div>
            )
          })}
        </div>
        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Hide Legs
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Legs with progress bars */}
      <div className="flex flex-col px-4">
        <AnimatePresence initial={false}>
          {parlay.legs.map((leg) => (
            <motion.div
              key={leg.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <LegProgressBar leg={leg} parlayStatus={parlay.status} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Odds & Payout section */}
      {(parlay.odds != null || parlay.stake != null) && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
          {parlay.odds != null && (
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase font-medium">Odds</span>
              <span className="text-sm font-bold text-white">{formatOdds(parlay.odds)}</span>
            </div>
          )}
          {payout != null && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-zinc-500 uppercase font-medium">Payout</span>
              <span className="text-sm font-bold text-lime-400">${payout.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Custom note */}
      {parlay.custom_note && (
        <div className="mx-4 mb-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50 px-3 py-2.5">
          <p className="text-xs italic text-zinc-300 leading-relaxed">
            &ldquo;{parlay.custom_note}&rdquo;
          </p>
        </div>
      )}

      {/* Action buttons for pending parlays */}
      {showActions && parlay.status === "pending" && onStatusChange && (
        <div className="flex items-center gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={() => onStatusChange("won")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-lime-500/15 px-3 py-2.5 text-sm font-bold text-lime-400 border border-lime-500/30 hover:bg-lime-500/25 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            Won
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("lost")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-2.5 text-sm font-bold text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors"
          >
            <XCircle className="h-4 w-4" />
            Lost
          </button>
        </div>
      )}

      {/* Footer — Lasyly branding */}
      <div className="flex items-center justify-center py-3 border-t border-zinc-800">
        <span className="text-sm font-black tracking-tight text-white/80">Lasyly</span>
      </div>
    </div>
  )
}

// --- Feed Variant ---

function FeedVariant({
  parlay,
}: Pick<ParlayBetslipCardProps, "parlay">) {
  const user = parlay.user
  const config = STATUS_CONFIG[parlay.status]
  const [showLegs, setShowLegs] = useState(false)

  return (
    <div className="flex flex-col rounded-xl border border-zinc-800 bg-[#0f1923] overflow-hidden">
      {/* User header */}
      {user && (
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden bg-zinc-700">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-400">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="truncate text-sm font-bold text-white">
              {user.display_name}
            </span>
            <p className="text-[11px] text-zinc-500">@{user.username}</p>
          </div>
        </div>
      )}

      {/* Parlay header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 border border-zinc-700">
            <span className="text-[8px] font-black text-zinc-300">SGM</span>
          </div>
          <span className="text-sm font-bold text-white">
            {parlay.legs.length} Leg Parlay
          </span>
        </div>
        <span className={cn("rounded-md border px-2.5 py-1 text-[11px] font-bold", config.className)}>
          {config.label}
        </span>
      </div>

      {/* Status icons + toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-1.5">
          {parlay.legs.map((leg) => {
            const legStatus: "hit" | "miss" | "pending" =
              parlay.status === "pending" ? "pending" :
              parlay.status === "won" ? "hit" :
              (leg.l10_hit_rate ?? 50) >= 60 ? "hit" : "miss"
            return (
              <div key={leg.id}>
                {legStatus === "hit" ? (
                  <CheckCircle2 className="h-5 w-5 text-lime-500" />
                ) : legStatus === "miss" ? (
                  <XCircle className="h-5 w-5 text-zinc-500" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-400" />
                )}
              </div>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowLegs(!showLegs)}
          className="flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          {showLegs ? "Hide Legs" : "Show Legs"}
          {showLegs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Collapsible legs */}
      <AnimatePresence initial={false}>
        {showLegs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col px-4">
              {parlay.legs.map((leg) => (
                <LegProgressBar key={leg.id} leg={leg} parlayStatus={parlay.status} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom note */}
      {parlay.custom_note && (
        <div className="mx-4 my-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50 px-3 py-2.5">
          <p className="text-xs italic text-zinc-300 leading-relaxed">
            &ldquo;{parlay.custom_note}&rdquo;
          </p>
        </div>
      )}

      {/* Footer — Lasyly branding */}
      <div className="flex items-center justify-center py-3 border-t border-zinc-800">
        <span className="text-sm font-black tracking-tight text-white/80">Lasyly</span>
      </div>
    </div>
  )
}

// --- Main Component ---

export default function ParlayBetslipCard({
  parlay,
  variant,
  onStatusChange,
  onToggleExpand,
  showActions = false,
  currentUserId,
}: ParlayBetslipCardProps) {
  const isOwner = currentUserId === parlay.user_id
  const canShowActions = showActions && isOwner

  if (variant === "compact") {
    return <CompactVariant parlay={parlay} onToggleExpand={onToggleExpand} />
  }

  if (variant === "feed") {
    return <FeedVariant parlay={parlay} />
  }

  // Expanded variant with animation wrapper
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <ExpandedVariant
        parlay={parlay}
        onStatusChange={canShowActions ? onStatusChange : undefined}
        onToggleExpand={onToggleExpand}
        showActions={canShowActions}
      />
    </motion.div>
  )
}
