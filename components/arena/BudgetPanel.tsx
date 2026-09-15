"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { BudgetSnapshot } from "@/lib/arena/budget"
import type { RosterState, RosterSlot, SeasonPlayer, TeamId } from "@/lib/arena/types"
import { ROSTER_SLOTS } from "@/lib/arena/types"
import { headshotUrl } from "@/lib/arena/data"
import { cn } from "@/lib/utils"

const SLOT_LABEL: Record<RosterSlot, string> = { PG: "PG", SG: "SG", SF: "SF", PF: "PF", C: "C", BENCH: "6TH" }

function MiniHeadshot({ player }: { player: SeasonPlayer }) {
  const url = headshotUrl(player)
  const [failed, setFailed] = useState(false)
  const initials = player.name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase()

  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-md bg-white/10 ring-1 ring-white/10">
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover object-top" />
      ) : <span className="text-[7px] font-bold text-[#b5bfd3]">{initials}</span>}
    </span>
  )
}

export function BudgetPanel({ team, label, budget, roster, currentBid, isHighBidder, isAI }: {
  team: TeamId
  label: string
  budget: BudgetSnapshot
  roster: RosterState
  currentBid?: number
  isHighBidder?: boolean
  isAI?: boolean
}) {
  const isYou = label === "You"

  return (
    <aside data-team={team} className="flex w-full flex-col gap-3">
      <section className={cn(
        "rounded-[1.1rem] border bg-[#11141e]/90 p-3.5 shadow-[0_18px_34px_rgba(0,0,0,0.16)]",
        isHighBidder ? "border-[#b8ed0c]/75" : "border-white/[0.08]"
      )}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.04em] text-[#f1f4fb]">{isYou ? "Your wallet" : label}</h2>
            {isAI && <span className="rounded bg-[#5442c7]/40 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#c3bdff]">AI</span>}
          </div>
          {isHighBidder ? <span className="rounded bg-[#d4ff00] px-1.5 py-0.5 text-[8px] font-black uppercase text-[#151a0a]">Leading</span> : isYou ? <span className="text-[9px] font-semibold text-[#8b7fff]">View budget →</span> : null}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Counter label="Total" value={budget.total} />
          <Counter label="Spent" value={budget.spent} tone="muted" />
          <Counter label="Remaining" value={budget.remaining} tone="lime" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[9px] text-[#9ba6ba]">
          <span>Roster {budget.slotsFilled}/{budget.slotsFilled + budget.slotsRemaining}</span>
          <span>Max bid ${budget.maxAffordable}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.span className="block h-full rounded-full bg-[#d4ff00]" initial={{ scaleX: 0 }} animate={{ scaleX: budget.remaining / budget.total }} transition={{ duration: 0.35 }} style={{ transformOrigin: "left" }} />
        </div>
        {currentBid != null && isHighBidder && (
          <div className="mt-3 rounded-lg bg-[#253014] px-3 py-2 text-center">
            <span className="block text-[8px] font-semibold uppercase tracking-[0.15em] text-[#b9c3a7]">Current bid</span>
            <span className="mt-0.5 block text-lg font-black leading-none tabular-nums text-white">${currentBid}</span>
          </div>
        )}
      </section>

      <section className="rounded-[1.1rem] border border-white/[0.08] bg-[#11141e]/90 p-3.5 shadow-[0_18px_34px_rgba(0,0,0,0.16)]">
        <h2 className="text-[11px] font-black uppercase tracking-[0.04em] text-[#f1f4fb]">{isYou ? "Your roster" : `${label} roster`}</h2>
        <div className="mt-3 space-y-1.5">
          {ROSTER_SLOTS.map((slot) => {
            const owned = roster.slots[slot]
            return (
              <div key={slot} className={cn(
                "flex min-h-7 items-center gap-2 rounded-lg border px-2 text-[10px]",
                owned ? "border-white/[0.06] bg-white/[0.045]" : "border-white/[0.07] bg-[#0d1018]/65"
              )}>
                <span className={cn("w-5 shrink-0 font-black", slot === "BENCH" ? "text-[#26d8c4]" : "text-[#d4ff00]")}>{SLOT_LABEL[slot]}</span>
                {owned ? <span className="flex min-w-0 flex-1 items-center gap-1.5"><MiniHeadshot player={owned.player} /><span className="truncate text-[#e7ebf5]">{owned.player.name}</span></span> : <span className="flex-1 italic text-[#7c8495]">Empty</span>}
                {owned && <span className="tabular-nums text-[#9ca6b8]">${owned.price}</span>}
                {!owned && <span aria-hidden className="text-sm leading-none text-[#97a2b6]">+</span>}
              </div>
            )
          })}
        </div>
      </section>
    </aside>
  )
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: "muted" | "lime" }) {
  const color = tone === "lime" ? "#d4ff00" : tone === "muted" ? "#a5aebe" : "#f3f5fb"
  return (
    <div className={cn("rounded-lg px-1 py-2 text-center", tone === "lime" ? "bg-[#203016]" : "bg-[#191d29]")}>
      <span className="block text-[7px] font-semibold uppercase tracking-[0.14em] text-[#a1aaba]">{label}</span>
      <motion.span key={value} initial={{ scale: 1.18 }} animate={{ scale: 1 }} className="mt-1 block text-[0.95rem] font-black leading-none tabular-nums" style={{ color }}>${value}</motion.span>
    </div>
  )
}
