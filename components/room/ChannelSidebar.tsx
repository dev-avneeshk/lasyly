"use client"

import { memo, useState } from "react"
import { ChevronDown, ChevronRight, Hash, Lock, Globe, Shield, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Channel, Subchannel } from "@/lib/types/channel"

type ChannelSidebarProps = {
  channels: Channel[]
  activeSubchannelId: string | null
  isAdmin: boolean
  onSelect: (subchannelId: string) => void
  onAddChannel: () => void
  onAddSubchannel: (channelId: string) => void
  onManageSubchannel: (sub: Subchannel) => void
}

/** Small badge icon indicating a sub-channel's access. */
function AccessIcon({ sub }: { sub: Subchannel }) {
  if (sub.post_policy === "admins") {
    return <Shield className="w-3 h-3 text-[#FBBF24]/70 shrink-0" aria-label="Admins only post" />
  }
  if (sub.visibility === "private") {
    return <Lock className="w-3 h-3 text-white/30 shrink-0" aria-label="Private" />
  }
  return <Globe className="w-3 h-3 text-white/20 shrink-0" aria-label="Public" />
}

function SubchannelRow({
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
        "group w-full flex items-center gap-2 pl-6 pr-2 py-1.5 rounded-lg text-left transition-all text-[13px]",
        active
          ? "bg-[rgba(184,255,79,0.12)] text-white/90"
          : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
      )}
    >
      <Hash className="w-3.5 h-3.5 shrink-0 opacity-60" />
      <span className="flex-1 truncate font-medium">{sub.name}</span>
      <AccessIcon sub={sub} />
    </button>
  )
}

function ChannelGroup({
  channel, activeSubchannelId, isAdmin, onSelect, onAddSubchannel, onManageSubchannel,
}: {
  channel: Channel
  activeSubchannelId: string | null
  isAdmin: boolean
  onSelect: (id: string) => void
  onAddSubchannel: (channelId: string) => void
  onManageSubchannel: (sub: Subchannel) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1 px-1 mb-1 group">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/25 hover:text-white/40 transition-colors select-none py-1"
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {channel.icon && <span className="text-[11px]">{channel.icon}</span>}
          <span className="truncate">{channel.name}</span>
        </button>
        {isAdmin && (
          <button
            onClick={() => onAddSubchannel(channel.id)}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded text-white/30 hover:text-white/70 hover:bg-white/[0.06] flex items-center justify-center transition-all"
            title="Add sub-channel"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-0.5">
          {channel.subchannels.map((sub) => (
            <SubchannelRow
              key={sub.id}
              sub={sub}
              active={sub.id === activeSubchannelId}
              isAdmin={isAdmin}
              onSelect={() => onSelect(sub.id)}
              onManage={() => onManageSubchannel(sub)}
            />
          ))}
          {channel.subchannels.length === 0 && (
            <p className="pl-6 py-1 text-[11px] text-white/20">No sub-channels yet</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Two-level channel navigation (Discord/Telegram style):
 * Channels (collapsible groups) → Sub-channels (the actual chat streams).
 * Admins get inline "+" affordances and right-click-to-manage on sub-channels.
 */
function ChannelSidebarBase({
  channels, activeSubchannelId, isAdmin, onSelect, onAddChannel, onAddSubchannel, onManageSubchannel,
}: ChannelSidebarProps) {
  return (
    <div className="flex-1 px-2 pb-4 overflow-y-auto scrollbar-hide">
      {channels.map((ch) => (
        <ChannelGroup
          key={ch.id}
          channel={ch}
          activeSubchannelId={activeSubchannelId}
          isAdmin={isAdmin}
          onSelect={onSelect}
          onAddSubchannel={onAddSubchannel}
          onManageSubchannel={onManageSubchannel}
        />
      ))}

      {isAdmin && (
        <button
          onClick={onAddChannel}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[12px] font-medium text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
        >
          <Plus className="w-4 h-4" /> New channel
        </button>
      )}

      {channels.length === 0 && !isAdmin && (
        <p className="px-2 py-3 text-[12px] text-white/20">No channels yet.</p>
      )}
    </div>
  )
}

export const ChannelSidebar = memo(ChannelSidebarBase)
