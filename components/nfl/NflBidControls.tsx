"use client"

import { useState } from "react"
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { NflAuctionState } from "@/lib/nfl/auction"
import type { TeamId } from "@/lib/nfl/types"
import { maxAffordable } from "@/lib/nfl/budget"
import { canAddPlayer, openSlots } from "@/lib/nfl/roster"
import { getSeasonPlayers } from "@/lib/nfl/data"
import { estimatedPrice } from "@/lib/nfl/grades"
import { cn } from "@/lib/utils"

export function NflBidControls({
  state,
  humanSeat,
  minRaise,
  onBid,
  onMax,
  onPass,
}: {
  state: NflAuctionState
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

  // Why can't this player be rostered? Their position group is already full.
  const blockedReason = !canRoster
    ? `Your ${lot.player.position} slot${lot.player.position === "WR" ? "s are" : " is"} already filled.`
    : null

  // Scarcity: is this the last player at the position(s) you still need?
  const pool = getSeasonPlayers(state.season)
  const upcoming = state.queue
    .filter((id) => id !== lot.player.id)
    .map((id) => pool.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
  const needsThisPosition = openSlots(roster).some((slot) => {
    // WR1/WR2 both map to WR; others 1:1. Match by the player's position.
    return slotPositionMatches(slot, lot.player.position)
  })
  const noneUpcoming = !upcoming.some((p) => p.position === lot.player.position)
  const scarcityWarning =
    canRoster && needsThisPosition && noneUpcoming
      ? `Last ${lot.player.position} left on the board — pass and you'll auto-fill this slot.`
      : null

  // Value read: current price vs the estimated market value.
  const estimate = estimatedPrice(lot.player, total, state.config.rosterSize)
  const valueDelta = estimate - current
  const valueTone = valueDelta >= 2 ? "good" : valueDelta <= -2 ? "bad" : "neutral"

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
        <Button variant="outline" className="mt-3 w-full" onClick={onPass}>Skip player</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>Current bid: <span className="font-semibold text-[var(--color-lime)]">${current}</span></span>
        <span>Max you can bid: <span className="font-semibold text-[var(--color-text-primary)]">${max}</span></span>
      </div>

      {/* Value insight — bargain / fair / overpay vs the market estimate */}
      <div
        className={cn(
          "flex items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold",
          valueTone === "good" ? "bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
            : valueTone === "bad" ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
            : "bg-white/5 text-[var(--color-text-muted)]"
        )}
      >
        <span className="flex items-center gap-1.5">
          {valueTone === "good" ? <TrendingUp className="h-3.5 w-3.5" /> : valueTone === "bad" ? <TrendingDown className="h-3.5 w-3.5" /> : null}
          {valueTone === "good" ? "Bargain territory" : valueTone === "bad" ? "Overpaying" : "Fair value"}
        </span>
        <span>Est. ${estimate}{valueDelta !== 0 && <span className="ml-1 opacity-80">({valueDelta > 0 ? "+" : ""}{valueDelta})</span>}</span>
      </div>

      {scarcityWarning && (
        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning)]/10 px-3 py-2 text-[11px] text-[var(--color-warning)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{scarcityWarning}</span>
        </div>
      )}

      {isLeading ? (
        <div className="rounded-xl bg-[var(--color-lime)]/10 px-3 py-3 text-center text-sm font-bold text-[var(--color-lime)]">
          You lead at ${current} — waiting on the CPU…
        </div>
      ) : (
        <div className="grid grid-cols-[2fr_1fr] gap-2">
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

/** WR1/WR2 both require a WR; every other slot equals its own position name. */
function slotPositionMatches(slot: string, position: string): boolean {
  if (slot === "WR1" || slot === "WR2") return position === "WR"
  return slot === position
}
