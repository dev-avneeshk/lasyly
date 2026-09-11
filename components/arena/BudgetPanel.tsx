"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { BudgetSnapshot } from "@/lib/arena/budget"
import type { RosterState, RosterSlot, SeasonPlayer, TeamId } from "@/lib/arena/types"
import { ROSTER_SLOTS } from "@/lib/arena/types"
import { headshotUrl } from "@/lib/arena/data"
import { cn } from "@/lib/utils"

const SLOT_LABEL: Record<RosterSlot, string> = {
  PG: "PG", SG: "SG", SF: "SF", PF: "PF", C: "C", BENCH: "6TH",
}

function MiniHeadshot({ player }: { player: SeasonPlayer }) {
  const url = headshotUrl(player)
  const [failed, setFailed] = useState(false)
  const inits = player.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover object-top" />
      ) : (
        <span className="text-[8px] font-bold text-[var(--color-text-muted)]">{inits}</span>
      )}
    </span>
  )
}

export function BudgetPanel({
  team,
  label,
  budget,
  roster,
  currentBid,
  isHighBidder,
  isAI,
}: {
  team: TeamId
  label: string
  budget: BudgetSnapshot
  roster: RosterState
  currentBid?: number
  isHighBidder?: boolean
  isAI?: boolean
}) {
  return (
    <div
      data-team={team}
      className={cn(
        "flex w-full flex-col gap-3 rounded-2xl border bg-[var(--color-surface)]/70 p-4 backdrop-blur-xl transition-colors",
        isHighBidder ? "border-[var(--color-lime)]/70 shadow-[0_0_30px_-12px_rgba(212,255,0,0.5)]" : "border-[var(--color-border)]"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black uppercase tracking-wide text-[var(--color-text-primary)]">{label}</span>
          {isAI && <span className="rounded bg-[var(--color-primary)]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--color-primary)]">AI</span>}
        </div>
        {isHighBidder && (
          <span className="rounded-full bg-[var(--color-lime)] px-2 py-0.5 text-[9px] font-black uppercase text-black">Leading</span>
        )}
      </div>

      {/* Budget counters */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Counter label="Total" value={budget.total} />
        <Counter label="Spent" value={budget.spent} tone="muted" />
        <Counter label="Left" value={budget.remaining} tone="lime" />
      </div>

      <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
        <span>Roster {budget.slotsFilled}/{budget.slotsFilled + budget.slotsRemaining}</span>
        <span>Max bid ${budget.maxAffordable}</span>
      </div>

      {currentBid != null && (
        <div className={cn("rounded-lg px-3 py-2 text-center", isHighBidder ? "bg-[var(--color-lime)]/10" : "bg-white/5")}>
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Current Bid</span>
          <div className="text-xl font-black tabular-nums text-[var(--color-text-primary)]">
            {isHighBidder ? `$${currentBid}` : "—"}
          </div>
        </div>
      )}

      {/* Roster slots */}
      <div className="space-y-1">
        {ROSTER_SLOTS.map((slot) => {
          const owned = roster.slots[slot]
          return (
            <div
              key={slot}
              className={cn(
                "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs",
                owned ? "border-transparent bg-white/[0.04]" : "border-dashed border-[var(--color-border)] text-[var(--color-text-muted)]"
              )}
            >
              <span className={cn("w-8 shrink-0 font-bold", slot === "BENCH" ? "text-[var(--color-secondary)]" : "text-[var(--color-lime)]")}>
                {SLOT_LABEL[slot]}
              </span>
              {owned ? (
                <span className="flex flex-1 items-center gap-2 truncate">
                  <MiniHeadshot player={owned.player} />
                  <span className="truncate text-[var(--color-text-primary)]">{owned.player.name}</span>
                </span>
              ) : (
                <span className="flex-1 italic opacity-60">empty</span>
              )}
              {owned && <span className="tabular-nums text-[var(--color-text-muted)]">${owned.price}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: "muted" | "lime" }) {
  return (
    <div className="rounded-lg bg-black/20 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">{label}</div>
      <motion.div
        key={value}
        initial={{ scale: 1.25, color: "#D4FF00" }}
        animate={{ scale: 1, color: tone === "lime" ? "#D4FF00" : tone === "muted" ? "#9CA3AF" : "#F0F2FF" }}
        className="text-lg font-black tabular-nums"
      >
        ${value}
      </motion.div>
    </div>
  )
}
