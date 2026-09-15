"use client"

import { useState } from "react"
import { AlertTriangle, Gavel } from "lucide-react"
import type { ArenaState } from "@/lib/arena/auction"
import type { TeamId } from "@/lib/arena/types"
import { bidIncrementForBudget } from "@/lib/arena/types"
import { maxAffordable } from "@/lib/arena/budget"
import { canAddPlayer, openStarterSlots, eligiblePositions } from "@/lib/arena/roster"
import { getSeasonPlayers } from "@/lib/arena/data"
import { cn } from "@/lib/utils"

export function BidControls({ state, humanSeat, minRaise, onBid, onMax, onPass }: {
  state: ArenaState
  humanSeat: TeamId
  minRaise: number | null
  onBid: (amount: number) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>
  onMax: () => void
  onPass: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const lot = state.lot
  if (!lot) return null

  const roster = state.rosters[humanSeat]
  const max = maxAffordable(state.config.budgetPerPlayer, roster)
  const current = lot.currentBid
  const isLeading = lot.highBidder === humanSeat
  const canRoster = canAddPlayer(roster, lot.player)
  const openStarters = openStarterSlots(roster)
  const blockedReason = !canRoster
    ? openStarters.length > 0
      ? `Your bench unlocks after the starting five. You still need ${openStarters.join(", ")}.`
      : "No roster slot is open for this player."
    : null

  const pool = getSeasonPlayers(state.season)
  const upcoming = state.queue.filter((id) => id !== lot.player.id).map((id) => pool.find((player) => player.id === id)).filter((player): player is NonNullable<typeof player> => Boolean(player))
  const lastAtPositions = openStarters.filter((position) => eligiblePositions(lot.player).includes(position) && !upcoming.some((player) => eligiblePositions(player).includes(position)))
  const scarcityWarning = canRoster && lastAtPositions.length > 0 ? `Last ${lastAtPositions.join(" / ")} available on the board.` : null
  const next = minRaise ?? null
  const canBid = next !== null && next <= max
  const increment = bidIncrementForBudget(state.config.budgetPerPlayer)
  const suggestedBids = next === null ? [] : Array.from(new Set([next, next + increment, next + increment * 2, next + increment * 3, max].filter((amount) => amount >= next && amount <= max))).slice(0, 5)

  const doBid = async (amount: number) => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await onBid(amount)
      if (!result.ok) setError(result.error ?? "That bid is no longer available.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!canRoster) {
    return (
      <section className="rounded-[1.1rem] border border-white/[0.08] bg-[#11141e]/95 p-4 text-center shadow-[0_18px_34px_rgba(0,0,0,0.16)]">
        <p className="text-sm leading-5 text-[#abb4c5]">{blockedReason}</p>
        <button type="button" onClick={onPass} className="mt-3 h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] text-sm font-bold text-[#f1f4fb] transition hover:bg-white/[0.1] active:scale-[0.98]">Pass</button>
      </section>
    )
  }

  return (
    <section className="rounded-[1.1rem] border border-white/[0.08] bg-[#11141e]/95 p-3.5 shadow-[0_18px_34px_rgba(0,0,0,0.2)]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="block text-[9px] font-medium text-[#a5afc0]">Current bid</span>
          <strong className="mt-0.5 block text-3xl font-black leading-none tabular-nums text-[#d4ff00]">${current}</strong>
        </div>
        <span className="pb-1 text-right text-[9px] text-[#a5afc0]">Max you can bid: <strong className="text-[#f0f3fa]">${max}</strong></span>
      </div>

      {scarcityWarning && <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#3a2912]/65 px-2.5 py-2 text-[10px] leading-4 text-[#f3c66e]"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{scarcityWarning}</p>}

      {isLeading ? (
        <div className="mt-3 rounded-xl border border-[#bbec0b]/20 bg-[#253014] px-3 py-3 text-center text-sm font-bold text-[#d4ff00]">You lead at ${current}. Waiting for opponent.</div>
      ) : (
        <div className="mt-3 grid grid-cols-[1.8fr_1fr] gap-2">
          <button type="button" onClick={() => next !== null && doBid(next)} disabled={!canBid} className={cn("flex h-11 items-center justify-center gap-2 rounded-xl bg-[#635bff] text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] transition hover:bg-[#736cff] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45", !canBid && "bg-[#30334a]")}>
            <Gavel className="h-4 w-4" strokeWidth={2.25} />
            {canBid ? `Bid $${next}` : "Cannot outbid"}
          </button>
          <button type="button" onClick={onPass} className="h-11 rounded-xl border border-white/[0.1] bg-[#1a1e2a] text-sm font-bold text-[#f2f4fa] transition hover:bg-[#242a38] active:scale-[0.98]">Pass</button>
        </div>
      )}

      {!isLeading && suggestedBids.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestedBids.map((amount) => <button type="button" key={amount} onClick={() => amount === max ? onMax() : doBid(amount)} className="min-w-11 rounded-lg border border-white/[0.1] bg-[#181c27] px-2 py-1 text-[9px] font-semibold tabular-nums text-[#d7ddea] transition hover:border-[#8c82ff] hover:text-white active:scale-[0.98]">${amount}</button>)}
          <button type="button" onClick={onMax} className="ml-auto px-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-[#a6aebe] transition hover:text-[#d4ff00]">Jump to amount</button>
        </div>
      )}
      {error && <p className="mt-2 text-center text-xs text-[var(--color-danger)]">{error}</p>}
    </section>
  )
}
