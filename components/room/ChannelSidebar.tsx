"use client"

import { memo } from "react"
import { Hash, Lock, Globe, Shield, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Subchannel } from "@/lib/types/channel"

type ChannelSidebarProps = {
  subchannels: Subchannel[]
  activeSubchannelId: string | null
  isAdmin: boolean
  /** True when the admin may still add a sub-channel (under the free limit). */
  canAddMore: boolean
  onSelect: (subchannelId: string) => void
  onAddSubchannel: () => void
  onManageSubchannel: (sub: Subchannel) => void
}

/** Access icon: admins-only (shield), private (lock), or public (globe). */
function AccessIcon({ sub }: { sub: Subchannel }) {
  if (sub.post_policy === "admins") return <Shield className="w-3 h-3 text-[#FBBF24]/70 shrink-0" aria-label="Admins only post" />
  if (sub.visibility === "private") return <Lock className="w-3 h-3 text-white/30 shrink-0" aria-label="Private" />
  return <Globe className="w-3 h-3 text-white/20 shrink-0" aria-label="Public" />
}

function Row({
  sub, active, isAdmin, onSelect, onManage,
}: {
  sub: Subchannel
  active: boolean
  isAdmin: boolean
  onSelect: () => void
  onManage: () => void
}) {
  return (
    <button
      onClick={onSelect}
      onContextMenu={(e) => { if (isAdmin) { e.preventDefault(); onManage() } }}
      className={cn(
        "group w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-left transition-all text-[13px]",
        active ? "bg-[rgba(184,255,79,0.12)] text-white/90" : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
      )}
    >
      <Hash className="w-3.5 h-3.5 shrink-0 opacity-60" />
      <span className="flex-1 truncate font-medium">{sub.name}</span>
      <AccessIcon sub={sub} />
    </button>
  )
}

/**
 * Flat sub-channel navigation (Discord-server style, one level):
 * Room → sub-channels. The default sub-channel is the join landing and shows
 * first. Admins can add up to 2 extra (free tier) and right-click to manage.
 */
function ChannelSidebarBase({
  subchannels, activeSubchannelId, isAdmin, canAddMore, onSelect, onAddSubchannel, onManageSubchannel,
}: ChannelSidebarProps) {
  return (
    <div className="flex-1 px-2 pb-4 overflow-y-auto scrollbar-hide">
      <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/25 select-none">
        Channels
      </div>
      <div className="flex flex-col gap-0.5">
        {subchannels.map((sub) => (
          <Row
            key={sub.id}
            sub={sub}
            active={sub.id === activeSubchannelId}
            isAdmin={isAdmin}
            onSelect={() => onSelect(sub.id)}
            onManage={() => onManageSubchannel(sub)}
          />
        ))}
      </div>

      {isAdmin && canAddMore && (
        <button
          onClick={onAddSubchannel}
          className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] font-medium text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
        >
          <Plus className="w-4 h-4" /> Add sub-channel
        </button>
      )}
      {isAdmin && !canAddMore && (
        <button
          onClick={onAddSubchannel}
          className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] font-medium text-[#B8FF4F]/60 hover:text-[#B8FF4F] hover:bg-[#B8FF4F]/5 transition-all"
        >
          <Plus className="w-4 h-4" /> Add sub-channel (Pro)
        </button>
      )}
    </div>
  )
}

export const ChannelSidebar = memo(ChannelSidebarBase)
