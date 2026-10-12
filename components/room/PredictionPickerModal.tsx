"use client"

import { useEffect, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, TrendingUp, Clock, CheckCircle2, XCircle } from "lucide-react"
import { useOpenerFocus } from "@/components/ui/useOpenerFocus"
import type { ParlayWithLegs, ParlayLegRow } from "@/lib/types/parlay"

type PredictionPickerModalProps = {
  open: boolean
  onClose: () => void
  /** Called with the chosen parlay id when the user taps a prediction. */
  onSelect: (parlayId: string) => void
}

function legLabel(leg: ParlayLegRow): string {
  const dir = leg.direction === "over" ? "Over" : "Under"
  return `${dir} ${leg.prop_line} ${leg.stat_category}`
}

function title(parlay: ParlayWithLegs): string {
  if (parlay.legs.length > 1) return `${parlay.legs.length}-Pick Parlay`
  const first = parlay.legs[0]
  return first ? legLabel(first) : "Prediction"
}

function subtitle(parlay: ParlayWithLegs): string {
  if (parlay.legs.length > 1) return parlay.legs.map((l) => l.player_name).join(" · ")
  return parlay.legs[0]?.player_name ?? ""
}

function StatusIcon({ status }: { status: ParlayWithLegs["status"] }) {
  if (status === "won") return <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
  if (status === "lost") return <XCircle className="w-4 h-4 text-[#F87171]" />
  return <Clock className="w-4 h-4 text-[#FBBF24]" />
}

/**
 * Lists the signed-in user's predictions (parlays) so one can be shared into a
 * room's chat. Follows the dark-room modal pattern: #141414 surface,
 * white/[0.08] borders, lime accent, lucide icons, Radix Dialog for focus
 * trap + Escape + scroll lock, and tap-to-select rows.
 */
export function PredictionPickerModal({ open, onClose, onSelect }: PredictionPickerModalProps) {
  const focus = useOpenerFocus()
  const [parlays, setParlays] = useState<ParlayWithLegs[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let ignore = false
    setParlays(null)
    setError(null)
    ;(async () => {
      try {
        const res = await fetch("/api/parlays?limit=50")
        const data = await res.json().catch(() => ({}))
        if (ignore) return
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Couldn't load your predictions.")
          return
        }
        setParlays((data.parlays ?? []) as ParlayWithLegs[])
      } catch {
        if (!ignore) setError("Couldn't load your predictions. Check your connection.")
      }
    })()
    return () => {
      ignore = true
    }
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-[100]" />
        <Dialog.Content
          {...focus}
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[101] w-[calc(100vw-24px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/[0.08] bg-[#141414] shadow-2xl flex flex-col max-h-[85vh]"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
            <Dialog.Title className="flex items-center gap-2 text-[15px] font-semibold text-white/90">
              <TrendingUp className="w-4 h-4 text-[#B8FF4F]" />
              Share a prediction
            </Dialog.Title>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto px-3 py-3 flex flex-col gap-2">
            {error ? (
              <p className="px-2 py-6 text-center text-[13px] text-[#F87171]">{error}</p>
            ) : parlays === null ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                <span className="sr-only">Loading predictions</span>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse motion-reduce:animate-none" />
                ))}
              </div>
            ) : parlays.length === 0 ? (
              <p className="px-2 py-8 text-center text-[13px] text-white/40">
                No predictions yet — build one from the analysis page.
              </p>
            ) : (
              parlays.map((parlay) => (
                <button
                  key={parlay.id}
                  type="button"
                  onClick={() => onSelect(parlay.id)}
                  className="w-full text-left rounded-xl border border-white/[0.08] bg-[#161616] px-3.5 py-3 transition-colors hover:border-[rgba(184,255,79,0.28)] hover:bg-white/[0.03] focus:outline-none focus-visible:border-[rgba(184,255,79,0.4)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-white/90 truncate">{title(parlay)}</span>
                    <StatusIcon status={parlay.status} />
                  </div>
                  {subtitle(parlay) && (
                    <p className="mt-0.5 text-[11px] text-white/40 truncate">{subtitle(parlay)}</p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-[11px]">
                    {parlay.combined_hit_rate != null && (
                      <span className="text-white/40">
                        Hit rate{" "}
                        <span className="font-semibold text-[#B8FF4F]">{Math.round(parlay.combined_hit_rate)}%</span>
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
