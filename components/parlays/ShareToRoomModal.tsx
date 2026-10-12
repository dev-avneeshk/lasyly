"use client"

import { useEffect, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Share2, Lock } from "lucide-react"
import { useOpenerFocus } from "@/components/ui/useOpenerFocus"
import { useToast } from "@/components/ui/Toast"
import { sharePredictionToRoom } from "@/lib/chat/sharePrediction"

type JoinedRoom = {
  id: string
  name: string
  type: string
  sport_tag: string | null
  member_count: number
}

type ShareToRoomModalProps = {
  open: boolean
  parlayId: string
  onClose: () => void
  onShared?: () => void
}

// Mirrors the sport glyphs used on the Rooms grid so the picker reads the same.
const SPORT_EMOJI: Record<string, string> = {
  Football: "⚽",
  Basketball: "🏀",
  Tennis: "🎾",
  Mixed: "🔥",
}

/**
 * Room picker launched from My Predictions. Lists the rooms the user has joined
 * and shares the given prediction into the chosen one via the existing messages
 * route (the server verifies parlay ownership and room membership). Follows the
 * dark-room modal pattern: #141414 surface, white/[0.08] borders, lime accent,
 * lucide icons, Radix Dialog for focus trap + Escape + scroll lock.
 */
export function ShareToRoomModal({ open, parlayId, onClose, onShared }: ShareToRoomModalProps) {
  const focus = useOpenerFocus()
  const { toast } = useToast()
  const [rooms, setRooms] = useState<JoinedRoom[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sharingId, setSharingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let ignore = false
    setRooms(null)
    setError(null)
    setSharingId(null)
    ;(async () => {
      try {
        const res = await fetch("/api/rooms/joined")
        const data = await res.json().catch(() => ({}))
        if (ignore) return
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Couldn't load your rooms.")
          return
        }
        setRooms((data.rooms ?? []) as JoinedRoom[])
      } catch {
        if (!ignore) setError("Couldn't load your rooms. Check your connection.")
      }
    })()
    return () => {
      ignore = true
    }
  }, [open])

  const share = async (room: JoinedRoom) => {
    if (sharingId) return
    setSharingId(room.id)
    const { ok, error: shareError } = await sharePredictionToRoom(room.id, parlayId)
    setSharingId(null)
    if (ok) {
      toast(`Shared to ${room.name}.`, "success")
      onShared?.()
      onClose()
    } else {
      toast(shareError ?? "Couldn't share prediction.", "error")
    }
  }

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
              <Share2 className="w-4 h-4 text-[#B8FF4F]" />
              Share to a room
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
            ) : rooms === null ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                <span className="sr-only">Loading rooms</span>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse motion-reduce:animate-none" />
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <p className="px-2 py-8 text-center text-[13px] text-white/40">
                You haven&apos;t joined any rooms yet.
              </p>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => share(room)}
                  disabled={sharingId !== null}
                  className="w-full text-left rounded-xl border border-white/[0.08] bg-[#161616] px-3.5 py-3 flex items-center gap-3 transition-colors hover:border-[rgba(184,255,79,0.28)] hover:bg-white/[0.03] focus:outline-none focus-visible:border-[rgba(184,255,79,0.4)] disabled:opacity-50"
                >
                  <span className="w-9 h-9 shrink-0 rounded-lg bg-[#B8FF4F]/[0.08] flex items-center justify-center text-lg">
                    {SPORT_EMOJI[room.sport_tag ?? "Other"] ?? "🎯"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-white/90 truncate">{room.name}</span>
                      {room.type === "Private" && <Lock className="w-3 h-3 text-white/25 shrink-0" />}
                    </span>
                    <span className="block text-[11px] text-white/40 truncate">
                      {room.sport_tag ?? "General"} · {room.member_count} members
                    </span>
                  </span>
                  {sharingId === room.id && (
                    <span className="text-[11px] text-white/40 shrink-0">Sharing…</span>
                  )}
                </button>
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
