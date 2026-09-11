"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
// (single-tap bid UX — no custom amount input)
import { Button } from "@/components/ui/button"
import type { ArenaState } from "@/lib/arena/auction"
import type { TeamId } from "@/lib/arena/types"
import { maxAffordable } from "@/lib/arena/budget"
import { canAddPlayer, openStarterSlots, eligiblePositions } from "@/lib/arena/roster"
import { getSeasonPlayers } from "@/lib/arena/data"
import { cn } from "@/lib/utils"

export function BidControls({
  state,
  humanSeat,
  minRaise,
  onBid,
  onMax,
  onPass,
}: {
  state: ArenaState
  humanSeat: TeamId
  minRaise: number | null
  onBid: (amount: number) => { ok: boolean; error?: string }
  onMax: () => void
  onPass: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  const lot = state.lot
  if (!lot) return null

  const roster = state.rosters[humanSeat]
  const total = state.config.budgetPerPlayer
  const max = maxAffordable(total, roster)
  const current = lot.currentBid
  const isLeading = lot.highBidder === humanSeat
  const canRoster = canAddPlayer(roster, lot.player)

  // Why can't this player be rostered? Under auction rules the bench stays
  // locked until all five starting spots are filled, so spell that out rather
  // than showing a bare "no slot" dead end.
  const openStarters = openStarterSlots(roster)
  const blockedReason = !canRoster
    ? openStarters.length > 0
      ? `Your bench stays locked until your starting five is set — you still need ${openStarters.join(", ")}.`
      : "No open slot for this player."
    : null

  // Scarcity warning driven by what's genuinely left on the board: if this is
  // the last player who can fill one of your open positions, say so loudly.
  const pool = getSeasonPlayers(state.season)
  const upcoming = state.queue
    .filter((id) => id !== lot.player.id)
    .map((id) => pool.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
  const lastAtPositions = openStarters.filter(
    (pos) =>
      eligiblePositions(lot.player).includes(pos) &&
      !upcoming.some((p) => eligiblePositions(p).includes(pos))
  )
  const scarcityWarning =
    canRoster && lastAtPositions.length > 0
      ? `Last ${lastAtPositions.join(" / ")} left on the board — if you pass, you won't get another.`
      : null

  const doBid = (amount: number) => {
    setError(null)
    const res = onBid(amount)
    if (!res.ok) setError(res.error ?? "Illegal bid.")
  }

  const next = minRaise ?? null
  const canBid = next !== null && next <= max

  if (!canRoster) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4 text-center text-sm text-[var(--color-text-muted)]">
        {blockedReason}
        <Button variant="outline" className="mt-3 w-full" onClick={onPass}>Skip</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>Current bid: <span className="font-semibold text-[var(--color-lime)]">${current}</span></span>
        <span>Max you can bid: <span className="font-semibold text-[var(--color-text-primary)]">${max}</span></span>
      </div>

      {scarcityWarning && (
        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning)]/10 px-3 py-2 text-[11px] text-[var(--color-warning)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{scarcityWarning}</span>
        </div>
      )}

      {isLeading ? (
        <div className="rounded-xl bg-[var(--color-lime)]/10 px-3 py-3 text-center text-sm font-bold text-[var(--color-lime)]">
          You lead at ${current} — waiting on opponent…
        </div>
      ) : (
        <div className="grid grid-cols-[2fr_1fr] gap-2">
          {/* Primary: one-tap bid at the next increment. */}
          <Button
            onClick={() => next != null && doBid(next)}
            disabled={!canBid}
            className={cn("h-14 rounded-xl text-base font-black", !canBid && "opacity-40")}
          >
            {canBid ? <>Bid ${next}</> : "Can't outbid"}
          </Button>
          <Button variant="danger" onClick={onPass} className="h-14 rounded-xl font-black">
            Pass
          </Button>
        </div>
      )}

      {/* Secondary: go all-in up to max (kept for strategy, not the main path). */}
      {!isLeading && max > (next ?? current) && (
        <button
          onClick={onMax}
          className="text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] hover:text-[var(--color-lime)]"
        >
          Jump to max (${max})
        </button>
      )}

      {error && <p className="text-center text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
