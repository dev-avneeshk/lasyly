"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Shield, Crown, UserMinus, Ban, Pin, Trash2, RotateCcw, VolumeX, UserPlus, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { ConfirmDialog, type ConfirmField } from "@/components/ui/ConfirmDialog"
import { useToast } from "@/components/ui/Toast"

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

type JoinRequestRow = {
  id: string
  subchannelName: string | null
  requestedAt: string
  profile: { username: string | null; display_name: string | null; avatar_url: string | null } | null
}

type Tab = "members" | "requests" | "bans" | "pins"

/** Which moderation action is awaiting in-app confirmation. */
type PendingAction =
  | { type: "kick"; userId: string; name: string }
  | { type: "ban"; userId: string; name: string }
  | { type: "mute"; userId: string; name: string }
  | null

const MUTE_OPTIONS = [
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "60", label: "1 hour" },
  { value: "1440", label: "1 day" },
]

export default function AdminPanel({ roomId, currentUserId, userRole, onClose, onMembersChanged }: AdminPanelProps) {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>("members")
  const [members, setMembers] = useState<Member[]>([])
  const [bans, setBans] = useState<BannedUser[]>([])
  const [pins, setPins] = useState<PinnedMessage[]>([])
  const [requests, setRequests] = useState<JoinRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

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

  const fetchRequests = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/requests`)
    if (res.ok) {
      const data = await res.json()
      setRequests(data.requests ?? [])
    }
  }, [roomId])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchMembers(), fetchBans(), fetchPins(), fetchRequests()]).finally(() => setLoading(false))
  }, [fetchMembers, fetchBans, fetchPins, fetchRequests])

  const handleDecideRequest = async (requestId: string, approve: boolean) => {
    setActionLoading(requestId)
    const res = await fetch(`/api/rooms/${roomId}/requests/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    })
    if (res.ok) {
      await fetchRequests()
      if (approve) { await fetchMembers(); onMembersChanged() }
      toast(approve ? "Request approved" : "Request denied", approve ? "success" : "info")
    } else {
      toast("Couldn't update the request", "error")
    }
    setActionLoading(null)
  }

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
      toast(newRole === "moderator" ? "Promoted to moderator" : "Demoted to member", "success")
    } else {
      toast("Couldn't change the role", "error")
    }
    setActionLoading(null)
  }

  // ─── In-app confirmed actions ──────────────────────────────────────────────

  const runKick = async (userId: string) => {
    const res = await fetch(`/api/rooms/${roomId}/members/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    })
    if (res.ok) {
      await fetchMembers()
      onMembersChanged()
      toast("Member kicked", "success")
    } else {
      toast("Couldn't kick this member", "error")
    }
  }

  const runBan = async (userId: string, reason?: string) => {
    const res = await fetch(`/api/rooms/${roomId}/members/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, reason: reason || undefined }),
    })
    if (res.ok) {
      await Promise.all([fetchMembers(), fetchBans()])
      onMembersChanged()
      toast("Member banned", "success")
    } else {
      toast("Couldn't ban this member", "error")
    }
  }

  const runMute = async (userId: string, minutesStr?: string) => {
    const duration = parseInt(minutesStr ?? "15", 10)
    if (isNaN(duration) || duration < 1) return
    const res = await fetch(`/api/rooms/${roomId}/members/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, duration_minutes: Math.min(duration, 10080) }),
    })
    if (res.ok) {
      await fetchMembers()
      toast("Member muted", "success")
    } else {
      toast("Couldn't mute this member", "error")
    }
  }

  /** Executes the pending action after the user confirms in the dialog. */
  const confirmPending = async (value?: string) => {
    if (!pending) return
    setConfirmBusy(true)
    setActionLoading(pending.userId)
    try {
      if (pending.type === "kick") await runKick(pending.userId)
      else if (pending.type === "ban") await runBan(pending.userId, value)
      else if (pending.type === "mute") await runMute(pending.userId, value)
    } finally {
      setConfirmBusy(false)
      setActionLoading(null)
      setPending(null)
    }
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
      toast("Ban lifted", "success")
    } else {
      toast("Couldn't lift the ban", "error")
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
      toast("Message unpinned", "success")
    } else {
      toast("Couldn't unpin the message", "error")
    }
    setActionLoading(null)
  }

  const isOwner = userRole === "owner"

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "members", label: "Members", icon: <Shield className="w-3.5 h-3.5" /> },
    { id: "requests", label: "Requests", icon: <UserPlus className="w-3.5 h-3.5" /> },
    { id: "bans", label: "Bans", icon: <Ban className="w-3.5 h-3.5" /> },
    { id: "pins", label: "Pins", icon: <Pin className="w-3.5 h-3.5" /> },
  ]

  // Dialog config derived from the pending action.
  const dialogConfig: {
    title: string
    description: React.ReactNode
    confirmLabel: string
    destructive: boolean
    field?: ConfirmField
  } | null = pending
    ? pending.type === "kick"
      ? {
          title: `Kick ${pending.name}?`,
          description: "They'll be removed from the room but can rejoin later.",
          confirmLabel: "Kick",
          destructive: true,
        }
      : pending.type === "ban"
        ? {
            title: `Ban ${pending.name}?`,
            description: "They'll be removed and blocked from rejoining. Add an optional reason.",
            confirmLabel: "Ban",
            destructive: true,
            field: { kind: "text", placeholder: "Reason (optional)", optional: true, maxLength: 200 },
          }
        : {
            title: `Mute ${pending.name}`,
            description: "Pick how long they'll be unable to send messages.",
            confirmLabel: "Mute",
            destructive: false,
            field: { kind: "options", options: MUTE_OPTIONS, defaultValue: "15" },
          }
    : null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#151515] rounded-2xl border border-white/[0.08] w-full max-w-lg max-h-[82vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-[#B8FF4F]/12 flex items-center justify-center">
              <Shield className="w-4 h-4 text-[#B8FF4F]" />
            </span>
            <h2 className="text-[15px] font-semibold text-white/90">Room Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/[0.06] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-3 pt-2 flex gap-1 border-b border-white/[0.06]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg text-[12px] font-medium transition-colors",
                tab === t.id ? "text-[#B8FF4F]" : "text-white/40 hover:text-white/70"
              )}
            >
              {t.icon}
              {t.label}
              {t.id === "bans" && bans.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#F87171]/20 text-[#F87171] text-[10px] font-semibold">{bans.length}</span>
              )}
              {t.id === "requests" && requests.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#B8FF4F]/20 text-[#B8FF4F] text-[10px] font-semibold">{requests.length}</span>
              )}
              {tab === t.id && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#B8FF4F]" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3.5">
          {loading ? (
            <div className="flex justify-center py-10">
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
              onKick={(id, name) => setPending({ type: "kick", userId: id, name })}
              onBan={(id, name) => setPending({ type: "ban", userId: id, name })}
              onMute={(id, name) => setPending({ type: "mute", userId: id, name })}
            />
          ) : tab === "requests" ? (
            <RequestsTab
              requests={requests}
              actionLoading={actionLoading}
              onDecide={handleDecideRequest}
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

      {/* In-app confirmation — replaces window.confirm / window.prompt */}
      {dialogConfig && (
        <ConfirmDialog
          open
          title={dialogConfig.title}
          description={dialogConfig.description}
          confirmLabel={dialogConfig.confirmLabel}
          destructive={dialogConfig.destructive}
          field={dialogConfig.field}
          loading={confirmBusy}
          onConfirm={confirmPending}
          onCancel={() => !confirmBusy && setPending(null)}
        />
      )}
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
  onKick: (userId: string, name: string) => void
  onBan: (userId: string, name: string) => void
  onMute: (userId: string, name: string) => void
}) {
  const roleColors: Record<string, string> = {
    owner: "#FBBF24",
    moderator: "#B8FF4F",
    member: "",
  }

  if (members.length === 0) {
    return <p className="text-[13px] text-white/30 text-center py-8">No members found.</p>
  }

  return (
    <div className="space-y-1">
      {members.map((member) => {
        const name = member.display_name || member.username || "User"
        const isSelf = member.id === currentUserId
        const canManage = !isSelf && (
          (isOwner && member.role !== "owner") ||
          (userRole === "moderator" && member.role === "member")
        )
        const busy = actionLoading === member.id

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-transparent hover:border-white/[0.05] transition-colors group"
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
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium text-white/85 truncate">{name}</span>
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
            {canManage ? (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                {isOwner && member.role === "member" && (
                  <IconAction
                    onClick={() => onRoleChange(member.id, "moderator")}
                    disabled={busy}
                    title="Promote to moderator"
                    color="#B8FF4F"
                  >
                    <Shield className="w-3.5 h-3.5" />
                  </IconAction>
                )}
                {isOwner && member.role === "moderator" && (
                  <IconAction
                    onClick={() => onRoleChange(member.id, "member")}
                    disabled={busy}
                    title="Demote to member"
                    color="rgba(255,255,255,0.5)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </IconAction>
                )}
                <IconAction onClick={() => onMute(member.id, name)} disabled={busy} title="Mute" color="#FBBF24">
                  <VolumeX className="w-3.5 h-3.5" />
                </IconAction>
                <IconAction onClick={() => onKick(member.id, name)} disabled={busy} title="Kick" color="#F87171">
                  <UserMinus className="w-3.5 h-3.5" />
                </IconAction>
                <IconAction onClick={() => onBan(member.id, name)} disabled={busy} title="Ban" color="#F87171">
                  <Ban className="w-3.5 h-3.5" />
                </IconAction>
              </div>
            ) : isSelf ? (
              <span className="text-[10px] text-white/20 font-medium">You</span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** Small square icon button used for member row actions. */
function IconAction({
  onClick,
  disabled,
  title,
  color,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  color: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 hover:bg-white/[0.08]"
      style={{ color }}
    >
      {children}
    </button>
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
      <div className="text-center py-10">
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
          <div key={ban.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
            <div className="w-9 h-9 rounded-xl bg-[#F87171]/10 flex items-center justify-center text-[11px] font-semibold text-[#F87171] shrink-0 overflow-hidden">
              {ban.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ban.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : name.slice(0, 2).toUpperCase()}
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
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white/[0.06] text-white/50 hover:bg-[#34D399]/15 hover:text-[#34D399] transition-colors disabled:opacity-40"
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
      <div className="text-center py-10">
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
          <div key={pin.id} className="px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05] group">
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
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#F87171]/10 text-white/20 hover:text-[#F87171] transition-colors opacity-0 group-hover:opacity-100 shrink-0 disabled:opacity-40"
                title="Unpin"
                aria-label="Unpin"
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

// ─── Requests Tab ───────────────────────────────────────────────────────────

function RequestsTab({
  requests, actionLoading, onDecide,
}: {
  requests: JoinRequestRow[]
  actionLoading: string | null
  onDecide: (requestId: string, approve: boolean) => void
}) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-10">
        <UserPlus className="w-8 h-8 text-white/15 mx-auto mb-2" />
        <p className="text-[13px] text-white/30">No pending join requests.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {requests.map((r) => {
        const name = r.profile?.display_name || r.profile?.username || "User"
        const busy = actionLoading === r.id
        return (
          <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <div className="w-9 h-9 rounded-xl bg-[#B8FF4F]/15 flex items-center justify-center text-[11px] font-semibold text-[#B8FF4F] overflow-hidden shrink-0">
              {r.profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-white/85 truncate">{name}</p>
              {r.subchannelName && <p className="text-[11px] text-white/30 truncate">wants to join #{r.subchannelName}</p>}
            </div>
            <button
              onClick={() => onDecide(r.id, true)}
              disabled={busy}
              className="w-8 h-8 rounded-lg bg-[#34D399]/15 text-[#34D399] hover:bg-[#34D399]/25 flex items-center justify-center transition-colors disabled:opacity-40"
              title="Approve"
              aria-label="Approve"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDecide(r.id, false)}
              disabled={busy}
              className="w-8 h-8 rounded-lg bg-[#F87171]/15 text-[#F87171] hover:bg-[#F87171]/25 flex items-center justify-center transition-colors disabled:opacity-40"
              title="Deny"
              aria-label="Deny"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
