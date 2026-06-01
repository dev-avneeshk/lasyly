"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Shield, Crown, UserMinus, Ban, Pin, Trash2, RotateCcw, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"

type Member = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  role: string
}

type BannedUser = {
  id: string
  user_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  reason: string | null
  banned_at: string
}

type PinnedMessage = {
  id: string
  message_id: string
  pinned_at: string
  content: string
  author: { username: string | null; display_name: string | null } | null
  created_at: string | null
}

type AdminPanelProps = {
  roomId: string
  currentUserId: string
  userRole: "owner" | "moderator" | "member"
  onClose: () => void
  onMembersChanged: () => void
}

type Tab = "members" | "bans" | "pins"

export default function AdminPanel({ roomId, currentUserId, userRole, onClose, onMembersChanged }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>("members")
  const [members, setMembers] = useState<Member[]>([])
  const [bans, setBans] = useState<BannedUser[]>([])
  const [pins, setPins] = useState<PinnedMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/members`)
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members ?? [])
    }
  }, [roomId])

  const fetchBans = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/bans`)
    if (res.ok) {
      const data = await res.json()
      setBans(data.bans ?? [])
    }
  }, [roomId])

  const fetchPins = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/pin`)
    if (res.ok) {
      const data = await res.json()
      setPins(data.pins ?? [])
    }
  }, [roomId])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchMembers(), fetchBans(), fetchPins()]).finally(() => setLoading(false))
  }, [fetchMembers, fetchBans, fetchPins])

  const handleRoleChange = async (userId: string, newRole: "moderator" | "member") => {
    setActionLoading(userId)
    const res = await fetch(`/api/rooms/${roomId}/members/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    })
    if (res.ok) {
      await fetchMembers()
      onMembersChanged()
    }
    setActionLoading(null)
  }

  const handleKick = async (userId: string) => {
    if (!confirm("Are you sure you want to kick this user?")) return
    setActionLoading(userId)
    const res = await fetch(`/api/rooms/${roomId}/members/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    })
    if (res.ok) {
      await fetchMembers()
      onMembersChanged()
    }
    setActionLoading(null)
  }

  const handleBan = async (userId: string) => {
    const reason = prompt("Ban reason (optional):")
    setActionLoading(userId)
    const res = await fetch(`/api/rooms/${roomId}/members/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, reason: reason || undefined }),
    })
    if (res.ok) {
      await Promise.all([fetchMembers(), fetchBans()])
      onMembersChanged()
    }
    setActionLoading(null)
  }

  const handleMute = async (userId: string) => {
    const durationStr = prompt("Mute duration in minutes (5, 15, 60, 1440=1day):", "15")
    if (!durationStr) return
    const duration = parseInt(durationStr, 10)
    if (isNaN(duration) || duration < 1) return
    setActionLoading(userId)
    const res = await fetch(`/api/rooms/${roomId}/members/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, duration_minutes: Math.min(duration, 10080) }),
    })
    if (res.ok) {
      await fetchMembers()
    }
    setActionLoading(null)
  }

  const handleUnban = async (userId: string) => {
    setActionLoading(userId)
    const res = await fetch(`/api/rooms/${roomId}/members/ban`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    })
    if (res.ok) {
      await fetchBans()
    }
    setActionLoading(null)
  }

  const handleUnpin = async (messageId: string) => {
    setActionLoading(messageId)
    const res = await fetch(`/api/rooms/${roomId}/pin`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId }),
    })
    if (res.ok) {
      await fetchPins()
    }
    setActionLoading(null)
  }

  const isOwner = userRole === "owner"

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "members", label: "Members", icon: <Shield className="w-3.5 h-3.5" /> },
    { id: "bans", label: "Bans", icon: <Ban className="w-3.5 h-3.5" /> },
    { id: "pins", label: "Pins", icon: <Pin className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-[#1A1A1A] rounded-2xl border border-white/[0.08] w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#B8FF4F]" />
            <h2 className="text-[15px] font-semibold text-white/90">Room Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex gap-1 border-b border-white/[0.06]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[12px] font-medium transition-colors -mb-px border-b-2",
                tab === t.id
                  ? "text-[#B8FF4F] border-[#B8FF4F] bg-[#B8FF4F]/5"
                  : "text-white/40 border-transparent hover:text-white/60"
              )}
            >
              {t.icon}
              {t.label}
              {t.id === "bans" && bans.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-[#F87171]/20 text-[#F87171] text-[10px]">{bans.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#B8FF4F]/30 border-t-[#B8FF4F] rounded-full animate-spin" />
            </div>
          ) : tab === "members" ? (
            <MembersTab
              members={members}
              currentUserId={currentUserId}
              isOwner={isOwner}
              userRole={userRole}
              actionLoading={actionLoading}
              onRoleChange={handleRoleChange}
              onKick={handleKick}
              onBan={handleBan}
              onMute={handleMute}
            />
          ) : tab === "bans" ? (
            <BansTab
              bans={bans}
              actionLoading={actionLoading}
              onUnban={handleUnban}
            />
          ) : (
            <PinsTab
              pins={pins}
              actionLoading={actionLoading}
              onUnpin={handleUnpin}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Members Tab ────────────────────────────────────────────────────────────

function MembersTab({
  members,
  currentUserId,
  isOwner,
  userRole,
  actionLoading,
  onRoleChange,
  onKick,
  onBan,
  onMute,
}: {
  members: Member[]
  currentUserId: string
  isOwner: boolean
  userRole: string
  actionLoading: string | null
  onRoleChange: (userId: string, role: "moderator" | "member") => void
  onKick: (userId: string) => void
  onBan: (userId: string) => void
  onMute: (userId: string) => void
}) {
  const roleColors: Record<string, string> = {
    owner: "#FBBF24",
    moderator: "#B8FF4F",
    member: "",
  }

  return (
    <div className="space-y-1">
      {members.length === 0 && (
        <p className="text-[13px] text-white/30 text-center py-6">No members found.</p>
      )}
      {members.map((member) => {
        const name = member.display_name || member.username || "User"
        const isSelf = member.id === currentUserId
        const canManage = !isSelf && (
          (isOwner && member.role !== "owner") ||
          (userRole === "moderator" && member.role === "member")
        )

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group"
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-[11px] font-semibold text-white/60 shrink-0 overflow-hidden">
              {member.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                name.slice(0, 2).toUpperCase()
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-white/80 truncate">{name}</span>
                {member.role === "owner" && <Crown className="w-3 h-3 text-[#FBBF24] shrink-0" />}
                {member.role === "moderator" && <Shield className="w-3 h-3 text-[#B8FF4F] shrink-0" />}
              </div>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: roleColors[member.role] || "rgba(255,255,255,0.25)" }}
              >
                {member.role}
              </span>
            </div>

            {/* Actions */}
            {canManage && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isOwner && member.role === "member" && (
                  <button
                    onClick={() => onRoleChange(member.id, "moderator")}
                    disabled={actionLoading === member.id}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#B8FF4F]/10 text-[#B8FF4F] transition-colors"
                    title="Promote to Moderator"
                  >
                    <Shield className="w-3.5 h-3.5" />
                  </button>
                )}
                {isOwner && member.role === "moderator" && (
                  <button
                    onClick={() => onRoleChange(member.id, "member")}
                    disabled={actionLoading === member.id}
                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.06] text-white/40 transition-colors"
                    title="Demote to Member"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onKick(member.id)}
                  disabled={actionLoading === member.id}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#F87171]/10 text-[#F87171] transition-colors"
                  title="Kick"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onMute(member.id)}
                  disabled={actionLoading === member.id}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#FBBF24]/10 text-[#FBBF24] transition-colors"
                  title="Mute"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onBan(member.id)}
                  disabled={actionLoading === member.id}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#F87171]/10 text-[#F87171] transition-colors"
                  title="Ban"
                >
                  <Ban className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isSelf && (
              <span className="text-[10px] text-white/20 font-medium">You</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Bans Tab ───────────────────────────────────────────────────────────────

function BansTab({
  bans,
  actionLoading,
  onUnban,
}: {
  bans: BannedUser[]
  actionLoading: string | null
  onUnban: (userId: string) => void
}) {
  if (bans.length === 0) {
    return (
      <div className="text-center py-8">
        <Ban className="w-8 h-8 text-white/15 mx-auto mb-2" />
        <p className="text-[13px] text-white/30">No banned users.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {bans.map((ban) => {
        const name = ban.display_name || ban.username || "User"
        return (
          <div key={ban.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group">
            <div className="w-9 h-9 rounded-xl bg-[#F87171]/10 flex items-center justify-center text-[11px] font-semibold text-[#F87171] shrink-0">
              {name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-medium text-white/80 truncate block">{name}</span>
              {ban.reason && (
                <span className="text-[11px] text-white/30 truncate block">Reason: {ban.reason}</span>
              )}
              <span className="text-[10px] text-white/20">
                {new Date(ban.banned_at).toLocaleDateString()}
              </span>
            </div>
            <button
              onClick={() => onUnban(ban.user_id)}
              disabled={actionLoading === ban.user_id}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.06] text-white/50 hover:bg-[#34D399]/10 hover:text-[#34D399] transition-colors opacity-0 group-hover:opacity-100"
            >
              Unban
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Pins Tab ───────────────────────────────────────────────────────────────

function PinsTab({
  pins,
  actionLoading,
  onUnpin,
}: {
  pins: PinnedMessage[]
  actionLoading: string | null
  onUnpin: (messageId: string) => void
}) {
  if (pins.length === 0) {
    return (
      <div className="text-center py-8">
        <Pin className="w-8 h-8 text-white/15 mx-auto mb-2" />
        <p className="text-[13px] text-white/30">No pinned messages.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {pins.map((pin) => {
        const authorName = pin.author?.display_name || pin.author?.username || "Unknown"
        return (
          <div key={pin.id} className="px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.04] group">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-medium text-[#B8FF4F]">{authorName}</span>
                  {pin.created_at && (
                    <span className="text-[10px] text-white/20">
                      {new Date(pin.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-white/70 line-clamp-2">{pin.content}</p>
              </div>
              <button
                onClick={() => onUnpin(pin.message_id)}
                disabled={actionLoading === pin.message_id}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#F87171]/10 text-white/20 hover:text-[#F87171] transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                title="Unpin"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
