"use client"

import { useEffect, useState, memo } from "react"
import { Trophy } from "lucide-react"

type TopBet = {
  id: string
  odds: number | null
  stake: number | null
  status: string
  combined_hit_rate: number | null
  custom_note: string | null
  author: string | null
  pinned: boolean
}

/**
 * Right-panel "Top Bet" — shows the admin-pinned bet for the room, or, when
 * nothing is pinned, the best winning shared betslip. Replaces the old
 * placeholder "Live Match" widget.
 */
function TopBetPanelBase({ roomId }: { roomId: string; isAdmin: boolean }) {
  const [bet, setBet] = useState<TopBet | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let ignore = false
    fetch(`/api/rooms/${roomId}/top-bet`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!ignore) { setBet(d?.bet ?? null); setLoaded(true) } })
      .catch(() => { if (!ignore) setLoaded(true) })
    return () => { ignore = true }
  }, [roomId])

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/25 mb-3 flex items-center gap-1.5">
        <Trophy className="w-3 h-3 text-[#B8FF4F]/60" />
        {bet?.pinned ? "Pinned Bet" : "Top Bet"}
      </p>

      {!loaded ? (
        <div className="h-[92px] rounded-xl bg-white/[0.03] animate-pulse" />
      ) : !bet ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-5 text-center">
          <p className="text-[12px] text-white/35">No bet pinned yet</p>
          <p className="text-[11px] text-white/20 mt-0.5">Share a betslip to feature it here</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.07] bg-[#161616] overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.05]">
            <span className="text-[12px] font-medium text-white/60 truncate">{bet.author ?? "A member"}</span>
            <span
              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{
                background:
                  bet.status === "won" ? "#34D39920" : bet.status === "lost" ? "#F8717120" : "#FBBF2420",
                color: bet.status === "won" ? "#34D399" : bet.status === "lost" ? "#F87171" : "#FBBF24",
              }}
            >
              {bet.status}
            </span>
          </div>
          <div className="px-3.5 py-3 flex items-end gap-4">
            <div>
              <p className="text-[10px] text-white/30">Odds</p>
              <p className="text-[18px] font-bold text-white/90 leading-tight">{bet.odds != null ? `${bet.odds}x` : "—"}</p>
            </div>
            {bet.combined_hit_rate != null && (
              <div>
                <p className="text-[10px] text-white/30">Hit rate</p>
                <p className="text-[18px] font-bold text-[#B8FF4F] leading-tight">{Math.round(bet.combined_hit_rate)}%</p>
              </div>
            )}
          </div>
          {bet.custom_note && (
            <p className="px-3.5 pb-3 text-[12px] text-white/45 leading-snug">{bet.custom_note}</p>
          )}
        </div>
      )}
    </div>
  )
}

export const TopBetPanel = memo(TopBetPanelBase)
