"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { BudgetSnapshot } from "@/lib/nfl/budget"
import type { NflPlayer, RosterSlot, RosterState, TeamId } from "@/lib/nfl/types"
import { OFFENSE_SLOTS, DEFENSE_SLOTS } from "@/lib/nfl/types"
import { headshotUrl } from "@/lib/nfl/data"
import { cn } from "@/lib/utils"

const SLOT_LABEL: Record<RosterSlot, string> = {
  QB: "QB", RB: "RB", WR1: "WR", WR2: "WR", TE: "TE",
  EDGE: "EDGE", LB: "LB", CB: "CB", S: "S",
}

function MiniHeadshot({ player }: { player: NflPlayer }) {
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

function SlotRow({ slot, owned }: { slot: RosterSlot; owned: RosterState["slots"][RosterSlot] }) {
  const isDefense = DEFENSE_SLOTS.includes(slot)
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs",
        owned ? "border-transparent bg-white/[0.04]" : "border-dashed border-[var(--color-border)] text-[var(--color-text-muted)]"
      )}
    >
      <span className={cn("w-10 shrink-0 font-bold", isDefense ? "text-[var(--color-primary)]" : "text-[var(--color-lime)]")}>
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
}

export function NflBudgetPanel({
  team,
  label,
  budget,
  roster,
  currentBid,
  isHighBidder,
  isAI,
  personaLabel,
}: {
  team: TeamId
  label: string
  budget: BudgetSnapshot
  roster: RosterState
  currentBid?: number
  isHighBidder?: boolean
  isAI?: boolean
  personaLabel?: string
}) {
  const outOfFunds = budget.slotsRemaining > 0 && budget.maxAffordable < 1
  const isFull = budget.slotsRemaining === 0

  return (
    <div
      data-team={team}
      className={cn(
        "flex w-full flex-col gap-3 rounded-2xl border bg-[var(--color-surface)]/70 p-4 backdrop-blur-xl transition-colors",
        isHighBidder ? "border-[var(--color-lime)]/70 shadow-[0_0_30px_-12px_rgba(212,255,0,0.5)]" : "border-[var(--color-border)]"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-black uppercase tracking-wide text-[var(--color-text-primary)]">{label}</span>
            {isAI && <span className="rounded bg-[var(--color-primary)]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[var(--color-primary)]">CPU</span>}
          </div>
          {isAI && personaLabel && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{personaLabel}</span>
          )}
        </div>
        {/* Status badge */}
        {isHighBidder ? (
          <span className="rounded-full bg-[var(--color-lime)] px-2 py-0.5 text-[9px] font-black uppercase text-black">Bidding</span>
        ) : isFull ? (
          <span className="rounded-full bg-[var(--color-secondary)]/20 px-2 py-0.5 text-[9px] font-black uppercase text-[var(--color-secondary)]">Roster Set</span>
        ) : outOfFunds ? (
          <span className="rounded-full bg-[var(--color-danger)]/20 px-2 py-0.5 text-[9px] font-black uppercase text-[var(--color-danger)]">Out of Funds</span>
        ) : null}
      </div>

      {/* Budget counters */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Counter label="Budget" value={budget.total} />
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

      {/* Roster slots grouped by side of the ball */}
      <div className="space-y-2">
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[var(--color-lime)]/70">Offense</p>
          <div className="space-y-1">
            {OFFENSE_SLOTS.map((slot) => (
              <SlotRow key={slot} slot={slot} owned={roster.slots[slot]} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[var(--color-primary)]/70">Defense</p>
          <div className="space-y-1">
            {DEFENSE_SLOTS.map((slot) => (
              <SlotRow key={slot} slot={slot} owned={roster.slots[slot]} />
            ))}
          </div>
        </div>
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
