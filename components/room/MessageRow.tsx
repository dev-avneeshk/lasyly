"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"

// ─── Types ──────────────────────────────────────────────────────────────────

export type ChatProfile = {
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export type BetslipCard = {
  id: string
  odds: number | null
  stake: number | null
  status: string
  custom_note: string | null
  combined_hit_rate: number | null
}

export type ChatMessage = {
  id: string
  content: string
  is_system: boolean
  created_at: string
  user_id: string
  profile: ChatProfile | null
  kind?: "text" | "betslip"
  betslip?: BetslipCard | null
}

type MessageRowProps = {
  message: ChatMessage
  /** True when this message continues a run from the same author (no header). */
  grouped: boolean
  pinned: boolean
  onContextMenu: (e: React.MouseEvent, messageId: string, messageUserId: string) => void
}

/** Compact bet card rendered inline in the chat for shared betslips. */
function BetslipCardView({ bet }: { bet: BetslipCard }) {
  const statusColor =
    bet.status === "won" ? "#34D399" : bet.status === "lost" ? "#F87171" : "#FBBF24"
  return (
    <div className="mt-1 max-w-[320px] rounded-xl border border-white/[0.08] bg-[#141414] overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06]">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Betslip</span>
        <span
          className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
          style={{ background: `${statusColor}20`, color: statusColor }}
        >
          {bet.status}
        </span>
      </div>
      <div className="px-3.5 py-3 flex items-center gap-4">
        <div>
          <p className="text-[10px] text-white/30">Odds</p>
          <p className="text-[15px] font-bold text-white/90">{bet.odds != null ? `${bet.odds}x` : "—"}</p>
        </div>
        {bet.combined_hit_rate != null && (
          <div>
            <p className="text-[10px] text-white/30">Hit rate</p>
            <p className="text-[15px] font-bold text-[#B8FF4F]">{Math.round(bet.combined_hit_rate)}%</p>
          </div>
        )}
        {bet.stake != null && (
          <div>
            <p className="text-[10px] text-white/30">Stake</p>
            <p className="text-[15px] font-bold text-white/90">${bet.stake}</p>
          </div>
        )}
      </div>
      {bet.custom_note && (
        <p className="px-3.5 pb-3 text-[12px] text-white/50 italic">&ldquo;{bet.custom_note}&rdquo;</p>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const USER_COLORS = [
  "#B8FF4F", "#60A5FA", "#F87171", "#FBBF24",
  "#34D399", "#A78BFA", "#F472B6", "#FB923C",
]

function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return isToday ? `Today ${time}` : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * A single chat message row, memoized so the message list doesn't re-render
 * when unrelated state (e.g. the input box) changes. Only re-renders when its
 * own props change (content, grouped, pinned).
 */
function MessageRowBase({ message, grouped, pinned, onContextMenu }: MessageRowProps) {
  if (message.is_system) {
    return (
      <div className="flex items-center gap-2 py-1 px-2">
        <span className="text-[12px] text-white/30">{message.content}</span>
      </div>
    )
  }

  const name = message.profile?.display_name || message.profile?.username || "User"
  const color = getUserColor(message.user_id)

  if (grouped) {
    return (
      <div
        className={cn(
          "flex gap-4 px-4 hover:bg-white/[0.02] rounded-xl group relative",
          pinned && "border-l-2 border-[#FBBF24]/40"
        )}
        onContextMenu={(e) => onContextMenu(e, message.id, message.user_id)}
      >
        <div className="w-10 shrink-0 flex items-center justify-center">
          <span className="text-[10px] text-white/20 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          {message.content && (
            <p className="text-[14px] text-white/80 leading-[1.7] break-words whitespace-pre-wrap">{message.content}</p>
          )}
          {message.kind === "betslip" && message.betslip && <BetslipCardView bet={message.betslip} />}
        </div>
        {pinned && <span className="absolute top-1 right-2 text-[10px] text-[#FBBF24]/50">📌</span>}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex gap-4 px-4 py-3 hover:bg-white/[0.02] rounded-xl mt-2 first:mt-0 relative",
        pinned && "border-l-2 border-[#FBBF24]/40"
      )}
      onContextMenu={(e) => onContextMenu(e, message.id, message.user_id)}
    >
      <div
        className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-[13px] font-semibold"
        style={{ background: `${color}20`, color }}
      >
        {message.profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={message.profile.avatar_url} alt="" loading="lazy" className="w-full h-full rounded-xl object-cover" />
        ) : (
          getInitials(name)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
          <span className="text-[14px] font-semibold" style={{ color }}>{name}</span>
          <span className="text-[11px] text-white/20">{formatTime(message.created_at)}</span>
          {pinned && <span className="text-[10px] text-[#FBBF24]/60">📌 pinned</span>}
        </div>
        {message.content && (
          <p className="text-[14px] text-white/80 leading-[1.7] break-words whitespace-pre-wrap">{message.content}</p>
        )}
        {message.kind === "betslip" && message.betslip && <BetslipCardView bet={message.betslip} />}
      </div>
    </div>
  )
}

/**
 * Custom comparison: skip re-render unless something this row actually shows
 * has changed. The `onContextMenu` handler is stabilized with useCallback by
 * the parent, so we don't compare it.
 */
export const MessageRow = memo(MessageRowBase, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.created_at === next.message.created_at &&
    prev.message.kind === next.message.kind &&
    prev.message.betslip?.status === next.message.betslip?.status &&
    prev.grouped === next.grouped &&
    prev.pinned === next.pinned
  )
})

export { getUserColor, formatTime, getInitials }
