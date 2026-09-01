"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import ScoresPanel from "@/components/room/ScoresPanel"
import AdminPanel from "@/components/room/AdminPanel"
import { MessageRow, getUserColor, getInitials, type ChatMessage } from "@/components/room/MessageRow"
import { ChatInput } from "@/components/room/ChatInput"
import { ChannelSidebar } from "@/components/room/ChannelSidebar"
import ChannelManager from "@/components/room/ChannelManager"
import { UpgradeModal } from "@/components/room/UpgradeModal"
import type { Channel, Subchannel } from "@/lib/types/channel"

/**
 * Max messages kept in memory. The initial fetch returns up to 50; realtime
 * appends grow the array over a long session. Capping prevents unbounded
 * memory growth and keeps the (non-virtualized) DOM list bounded.
 */
const MAX_MESSAGES = 200

// ─── Types ──────────────────────────────────────────────────────────────────

type RoomData = {
  id: string
  name: string
  description: string | null
  type: string
  sport_tag: string | null
  banner_url: string | null
  creator_id: string
  is_live: boolean
  member_count: number
  created_at: string
}

type MemberProfile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  role: string
}

type ChatProfile = {
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

type CurrentUser = {
  id: string
  profile: ChatProfile | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SPORT_EMOJI: Record<string, string> = {
  Football: "⚽", Basketball: "🏀", Tennis: "🎾", Mixed: "🔥", Other: "🎯",
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RoomPage() {
  const params = useParams<{ roomId: string }>()
  const router = useRouter()
  const roomId = params.roomId
  const supabase = useMemo(() => createClient(), [])

  const [room, setRoom] = useState<RoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [memberCount, setMemberCount] = useState(0)
  const [joining, setJoining] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberProfile[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeSubchannelId, setActiveSubchannelId] = useState<string | null>(null)
  const [showLiveScores, setShowLiveScores] = useState(false)
  const [managerMode, setManagerMode] = useState<
    | { kind: "new-channel" }
    | { kind: "new-subchannel"; channelId: string }
    | { kind: "manage-subchannel"; sub: Subchannel }
    | null
  >(null)
  const [upgradeLimit, setUpgradeLimit] = useState<"channels" | "subchannels" | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [sending, setSending] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [userRole, setUserRole] = useState<"owner" | "moderator" | "member">("member")
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: string; isOwnMessage: boolean } | null>(null)
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set())

  const feedRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)
  // Cache of user_id -> profile so incoming realtime rows (which carry no join)
  // can render an avatar/name without an extra fetch per message.
  const profileCacheRef = useRef<Map<string, ChatProfile>>(new Map())

  // Load (or refresh) the room's channels. On first load, auto-selects the
  // first sub-channel so the feed has something to show. Declared before the
  // load effect that calls it to avoid a temporal-dead-zone reference.
  const loadChannels = useCallback(async (selectFirst = false) => {
    const res = await fetch(`/api/rooms/${roomId}/channels`)
    if (!res.ok) return
    const data = await res.json()
    const list: Channel[] = data.channels ?? []
    setChannels(list)
    if (selectFirst) {
      const firstSub = list.flatMap((c) => c.subchannels)[0]
      if (firstSub) setActiveSubchannelId((prev) => prev ?? firstSub.id)
    }
  }, [roomId])

  // ─── Load Room ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await fetch(`/api/rooms/${roomId}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Failed to load room."); setLoading(false); return }
      setRoom(data)
      setMemberCount(data.member_count ?? 0)
      setIsMember(data.is_member ?? false)
      const u = await supabase.auth.getUser()
      const uid = u.data.user?.id ?? null
      setUserId(uid)
      setIsOwner(uid === data.creator_id)

      // Fetch user role in this room
      if (uid) {
        const memberRes = await fetch(`/api/rooms/${roomId}/members`)
        if (memberRes.ok) {
          const memberData = await memberRes.json()
          const me = (memberData.members ?? []).find((m: { id: string }) => m.id === uid)
          if (me) setUserRole(me.role)
          setMembers(memberData.members ?? [])
        }
        // Fetch pinned messages
        const pinRes = await fetch(`/api/rooms/${roomId}/pin`)
        if (pinRes.ok) {
          const pinData = await pinRes.json()
          setPinnedMessages(new Set((pinData.pins ?? []).map((p: { message_id: string }) => p.message_id)))
        }
      }

      // Load channels and pick the first sub-channel as active.
      await loadChannels(true)

      setLoading(false)
    }
    load()
  }, [supabase, roomId, loadChannels])

  // Members are loaded in the main load effect above

  // ─── Load Messages + Realtime ───────────────────────────────────────────────

  // Resolve current user's profile once.
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("username, display_name, avatar_url").eq("id", user.id).single()
        setCurrentUser({ id: user.id, profile })
      }
    }
    getUser()
  }, [supabase])

  // Fetch messages + subscribe to realtime for the ACTIVE sub-channel.
  useEffect(() => {
    // No sub-channel selected yet (channels still loading) — nothing to fetch.
    if (!activeSubchannelId) return

    // Clear the feed on channel switch so streams don't bleed together.
    setMessages([])

    const fetchMessages = async () => {
      const res = await fetch(`/api/rooms/${roomId}/messages?subchannelId=${activeSubchannelId}`)
      const data = await res.json()
      if (res.ok && data.messages) setMessages(data.messages.slice(-MAX_MESSAGES))
    }
    fetchMessages()

    // Realtime via broadcast, scoped per sub-channel so each stream is
    // independent. Receivers dedupe by id and cap the array.
    const channel = supabase
      .channel(`room-sub-${activeSubchannelId}`)
      .on("broadcast", { event: "new_message" }, (payload) => {
        const msg = payload.payload as ChatMessage
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          const withProfile: ChatMessage = {
            ...msg,
            profile: msg.profile ?? profileCacheRef.current.get(msg.user_id) ?? null,
          }
          const next = [...prev, withProfile]
          return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next
        })
      })
      .subscribe()
    channelRef.current = channel

    return () => { supabase.removeChannel(channel); channelRef.current = null }
  }, [supabase, roomId, activeSubchannelId])

  // Keep the profile cache fed from members + any messages that already carry
  // a profile, so realtime INSERTs can be rendered with a name/avatar.
  useEffect(() => {
    const cache = profileCacheRef.current
    for (const m of members) {
      cache.set(m.id, { username: m.username, display_name: m.display_name, avatar_url: m.avatar_url })
    }
  }, [members])

  useEffect(() => {
    const cache = profileCacheRef.current
    for (const msg of messages) {
      if (msg.profile && !cache.has(msg.user_id)) cache.set(msg.user_id, msg.profile)
    }
  }, [messages])

  // Auto-scroll only when the user is already near the bottom, so we don't
  // yank them down while they're reading history. Instant (no smooth) to avoid
  // layout thrash on every append.
  useEffect(() => {
    const el = feedRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [messages])

  // ─── Send Message ───────────────────────────────────────────────────────────

  const handleSend = useCallback(async (content: string) => {
    if (!content || !currentUser || sending) return
    setSending(true)

    const tempId = `temp-${Date.now()}`
    const optimistic: ChatMessage = {
      id: tempId, content, is_system: false,
      created_at: new Date().toISOString(), user_id: currentUser.id, profile: currentUser.profile,
    }
    setMessages(prev => {
      const next = [...prev, optimistic]
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next
    })

    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, subchannelId: activeSubchannelId ?? undefined }),
      })
      if (res.ok) {
        const saved = await res.json()
        // Reconcile the optimistic row to the real id.
        setMessages(prev =>
          prev.map(m => (m.id === tempId ? { ...optimistic, id: saved.id, created_at: saved.created_at } : m))
        )
        // Relay to other clients in the active sub-channel.
        channelRef.current?.send({
          type: "broadcast",
          event: "new_message",
          payload: {
            id: saved.id, content, is_system: false,
            created_at: saved.created_at, user_id: currentUser.id, profile: currentUser.profile,
          },
        })
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId))
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }, [currentUser, sending, roomId, activeSubchannelId])

  const handleJoinLeave = async () => {
    if (!userId) return
    setJoining(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, { method: "POST" })
      const data = await res.json()
      if (res.ok) { setIsMember(data.joined); setMemberCount(data.memberCount) }
    } catch {} finally { setJoining(false) }
  }

  const isAdmin = userRole === "owner" || userRole === "moderator"

  // The active sub-channel object + whether the current user may post in it.
  const activeSub = useMemo(
    () => channels.flatMap((c) => c.subchannels).find((s) => s.id === activeSubchannelId) ?? null,
    [channels, activeSubchannelId]
  )
  const canPost = Boolean(
    currentUser &&
    activeSub &&
    (activeSub.post_policy === "admins" ? isAdmin : isMember)
  )

  // Precompute per-message "grouped" flag once per messages change (not per
  // render). A message is grouped under the previous one when it's the same
  // author within 7 minutes — this drives the compact (headerless) row style.
  const renderedMessages = useMemo(() => {
    return messages.map((message, i) => {
      const prev = messages[i - 1]
      const grouped = Boolean(
        prev &&
        !prev.is_system &&
        !message.is_system &&
        prev.user_id === message.user_id &&
        new Date(message.created_at).getTime() - new Date(prev.created_at).getTime() < 7 * 60 * 1000
      )
      return { message, grouped }
    })
  }, [messages])

  const handleContextMenu = useCallback((e: React.MouseEvent, messageId: string, messageUserId: string) => {
    if (!isAdmin && messageUserId !== userId) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, messageId, isOwnMessage: messageUserId === userId })
  }, [isAdmin, userId])

  const handlePinMessage = async (messageId: string) => {
    setContextMenu(null)
    const res = await fetch(`/api/rooms/${roomId}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId }),
    })
    if (res.ok) {
      setPinnedMessages(prev => new Set([...prev, messageId]))
    }
  }

  const handleUnpinMessage = async (messageId: string) => {
    setContextMenu(null)
    const res = await fetch(`/api/rooms/${roomId}/pin`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId }),
    })
    if (res.ok) {
      setPinnedMessages(prev => { const next = new Set(prev); next.delete(messageId); return next })
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    setContextMenu(null)
    const res = await fetch(`/api/rooms/${roomId}/messages/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId }),
    })
    if (res.ok) {
      setMessages(prev => prev.filter(m => m.id !== messageId))
      setPinnedMessages(prev => { const next = new Set(prev); next.delete(messageId); return next })
    }
  }

  const refreshMembers = async () => {
    const res = await fetch(`/api/rooms/${roomId}/members`)
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members ?? [])
    }
  }

  // ─── Loading / Error ────────────────────────────────────────────────────────

  if (loading) return <div className="h-[calc(100dvh-64px)] bg-[#0A0A0A] flex items-center justify-center"><div className="w-5 h-5 border-2 border-[#B8FF4F]/30 border-t-[#B8FF4F] rounded-full animate-spin" /></div>
  if (error || !room) return (
    <div className="h-[calc(100dvh-64px)] bg-[#0A0A0A] flex flex-col items-center justify-center gap-4">
      <p className="text-sm text-white/50">{error || "Room not found."}</p>
      <button onClick={() => router.push("/rooms")} className="px-4 py-2 rounded-lg bg-[#B8FF4F] text-black text-sm font-semibold">Back to Rooms</button>
    </div>
  )

  const sportEmoji = SPORT_EMOJI[room.sport_tag ?? "Other"] ?? "🎯"

  const selectSub = (id: string) => { setShowLiveScores(false); setActiveSubchannelId(id) }

  return (
    <div className="flex h-[calc(100dvh-64px)] overflow-hidden bg-[#0A0A0A]">
      {/* ─── Server Panel (Channel Sidebar) ─── */}
      <div className="hidden md:flex w-[240px] shrink-0 flex-col bg-[#111111] border-r border-white/[0.06] overflow-y-auto scrollbar-hide">
        {/* Server Header */}
        <div className="px-5 pt-6 pb-4 flex items-center gap-3">
          <h2 className="text-[15px] font-semibold text-white/90 truncate flex-1" style={{ letterSpacing: "-0.02em" }}>{room.name}</h2>
          {room.is_live && (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#F87171] uppercase tracking-wider">
              <span className="w-[6px] h-[6px] rounded-full bg-[#F87171] animate-pulse" />Live
            </span>
          )}
        </div>

        {/* Channels */}
        <ChannelSidebar
          channels={channels}
          activeSubchannelId={showLiveScores ? null : activeSubchannelId}
          isAdmin={isAdmin}
          onSelect={selectSub}
          onAddChannel={() => setManagerMode({ kind: "new-channel" })}
          onAddSubchannel={(channelId) => setManagerMode({ kind: "new-subchannel", channelId })}
          onManageSubchannel={(sub) => setManagerMode({ kind: "manage-subchannel", sub })}
        />

        {/* Live Scores (special view) */}
        <div className="px-2 pb-2">
          <button
            onClick={() => setShowLiveScores(true)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left transition-all text-[13px]",
              showLiveScores ? "bg-[rgba(184,255,79,0.12)] text-white/90" : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
            )}
          >
            <span className="text-[15px] w-5 text-center">📺</span>
            <span className="flex-1 font-medium truncate">live-scores</span>
          </button>
        </div>

        {/* Bottom user area */}
        <div className="px-3 py-3 border-t border-white/[0.06] flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#B8FF4F] flex items-center justify-center text-[11px] font-bold text-black">
            {currentUser?.profile?.display_name ? getInitials(currentUser.profile.display_name) : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-white/80 truncate">{currentUser?.profile?.display_name || currentUser?.profile?.username || "Guest"}</p>
            <p className="text-[10px] text-white/30">{room.sport_tag ?? "General"} · {memberCount} members</p>
          </div>
        </div>
      </div>

      {/* ─── Main Chat Area ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A]">
        {/* Chat Header */}
        <div className="h-[56px] shrink-0 flex items-center px-5 border-b border-white/[0.06] gap-4">
          <button onClick={() => setDrawerOpen(true)} className="md:hidden text-white/60 text-lg">☰</button>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-white/90" style={{ letterSpacing: "-0.02em" }}>
            <span className="text-[15px]">{showLiveScores ? "📺" : activeSub?.icon ?? "#"}</span>
            {showLiveScores ? "live-scores" : activeSub?.name ?? "general"}
          </div>

          <div className="flex-1" />

          {/* Join/Leave */}
          {userId && (
            <button
              onClick={handleJoinLeave}
              disabled={joining}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all",
                isMember
                  ? "text-white/40 border border-white/[0.06] hover:text-[#F87171] hover:border-[#F87171]/30"
                  : "bg-[#B8FF4F] text-black"
              )}
            >
              {joining ? "..." : isMember ? "Leave" : "Join"}
            </button>
          )}
          <button className="w-8 h-8 rounded-lg text-white/25 hover:text-white/50 hover:bg-white/[0.04] flex items-center justify-center text-sm transition-colors">🔍</button>
          <button className="w-8 h-8 rounded-lg text-white/25 hover:text-white/50 hover:bg-white/[0.04] flex items-center justify-center text-sm transition-colors">👥</button>
          {isAdmin && (
            <button
              onClick={() => setAdminOpen(true)}
              className="w-8 h-8 rounded-lg text-white/25 hover:text-[#B8FF4F] hover:bg-[#B8FF4F]/5 flex items-center justify-center text-sm transition-colors"
              title="Room Settings"
            >
              ⚙️
            </button>
          )}
        </div>

        {/* Content: Chat or Scores */}
        {showLiveScores ? (
          <div className="flex-1 overflow-y-auto">
            <ScoresPanel roomId={roomId} isOwner={isOwner} />
          </div>
        ) : (
          <>
            {/* Message Feed */}
            <div ref={feedRef} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-1 scrollbar-hide">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-[60px] h-[60px] rounded-2xl bg-[#1A1A1A] border border-white/[0.06] flex items-center justify-center mb-3 text-2xl">{sportEmoji}</div>
                  <p className="text-[14px] font-semibold text-white/80">Welcome to #{activeSub?.name ?? "general"}</p>
                  <p className="text-[12px] text-white/30 mt-1 max-w-[280px]">This is the start of the channel. Share picks, discuss games, and react to tips.</p>
                </div>
              )}

              {renderedMessages.map(({ message, grouped }) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  grouped={grouped}
                  pinned={pinnedMessages.has(message.id)}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>

            {/* Message Input (isolated component — keystrokes don't re-render the feed) */}
            {canPost ? (
              <ChatInput
                disabled={!currentUser}
                placeholder={`Message #${activeSub?.name ?? "general"}`}
                onSend={handleSend}
              />
            ) : (
              <div className="shrink-0 px-5 pb-5 pt-2">
                <div className="flex items-center justify-center gap-2 bg-[#1A1A1A] border border-white/[0.06] rounded-2xl px-5 py-3 text-[13px] text-white/30">
                  {!currentUser
                    ? "Sign in to chat"
                    : activeSub?.post_policy === "admins"
                      ? "Only admins can post in this channel"
                      : "Join this room to chat"}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Right Panel ─── */}
      <div className="hidden lg:flex w-[280px] shrink-0 flex-col bg-[#111111] border-l border-white/[0.06] overflow-y-auto scrollbar-hide">
        {/* Live Match Widget */}
        <div className="p-5 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-white/25 mb-3">Live Match</p>
          <div className="bg-[#1A1A1A] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-white/70 flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-lg bg-[#222] flex items-center justify-center text-[12px]">{sportEmoji}</span>
                {room.sport_tag ?? "Match"}
              </span>
              <span className="text-[10px] font-semibold text-[#F87171] flex items-center gap-1">
                <span className="w-[5px] h-[5px] rounded-full bg-[#F87171] animate-pulse" />LIVE
              </span>
            </div>
            <div className="text-center py-2">
              <p className="text-[11px] text-white/30 mb-1">No live match data</p>
              <p className="text-[10px] text-white/20">Check the Scores channel</p>
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="p-5 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-white/25 mb-3">Online — {members.length}</p>
          <div className="flex flex-col gap-0.5">
            {members.slice(0, 20).map(member => {
              const name = member.display_name || member.username || "User"
              const color = getUserColor(member.id)
              return (
                <div key={member.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer">
                  <div className="relative">
                    <div className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center text-[10px] font-semibold overflow-hidden" style={{ background: `${color}15`, color }}>
                      {member.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : getInitials(name)}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-[9px] h-[9px] rounded-full bg-[#34D399] border-2 border-[#111111]" />
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-[12px] text-white/40 font-medium truncate">{name}</span>
                    {member.role === "owner" && <span className="text-[9px] shrink-0" title="Owner">👑</span>}
                    {member.role === "moderator" && <span className="text-[9px] shrink-0" title="Moderator">🛡️</span>}
                  </div>
                </div>
              )
            })}
            {members.length === 0 && <p className="text-[11px] text-white/20 px-2">Loading...</p>}
          </div>
        </div>
      </div>

      {/* ─── Mobile Drawer ─── */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setDrawerOpen(false)} />
          <div className="fixed top-0 left-0 bottom-0 w-[280px] bg-[#111111] z-50 md:hidden overflow-y-auto flex flex-col">
            <div className="px-5 pt-6 pb-4 flex items-center gap-3 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold text-white/90 flex-1">{room.name}</h2>
              <button onClick={() => setDrawerOpen(false)} className="text-white/30 text-lg">✕</button>
            </div>
            <ChannelSidebar
              channels={channels}
              activeSubchannelId={showLiveScores ? null : activeSubchannelId}
              isAdmin={isAdmin}
              onSelect={(id) => { selectSub(id); setDrawerOpen(false) }}
              onAddChannel={() => { setDrawerOpen(false); setManagerMode({ kind: "new-channel" }) }}
              onAddSubchannel={(channelId) => { setDrawerOpen(false); setManagerMode({ kind: "new-subchannel", channelId }) }}
              onManageSubchannel={(sub) => { setDrawerOpen(false); setManagerMode({ kind: "manage-subchannel", sub }) }}
            />
            <div className="px-2 pb-4">
              <button
                onClick={() => { setShowLiveScores(true); setDrawerOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left text-[13px] text-white/40"
              >
                <span className="text-[15px]">📺</span><span className="font-medium">live-scores</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Message Context Menu ─── */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }} />
          <div
            className="fixed z-50 bg-[#1A1A1A] border border-white/[0.08] rounded-xl shadow-2xl py-1.5 min-w-[160px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {isAdmin && !pinnedMessages.has(contextMenu.messageId) && (
              <button
                onClick={() => handlePinMessage(contextMenu.messageId)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-white/70 hover:bg-white/[0.06] transition-colors text-left"
              >
                <span className="text-[14px]">📌</span> Pin Message
              </button>
            )}
            {isAdmin && pinnedMessages.has(contextMenu.messageId) && (
              <button
                onClick={() => handleUnpinMessage(contextMenu.messageId)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-white/70 hover:bg-white/[0.06] transition-colors text-left"
              >
                <span className="text-[14px]">📌</span> Unpin Message
              </button>
            )}
            {(isAdmin || contextMenu.isOwnMessage) && (
              <button
                onClick={() => handleDeleteMessage(contextMenu.messageId)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#F87171] hover:bg-[#F87171]/10 transition-colors text-left"
              >
                <span className="text-[14px]">🗑️</span> Delete Message
              </button>
            )}
          </div>
        </>
      )}

      {/* ─── Admin Panel ─── */}
      {adminOpen && userId && (
        <AdminPanel
          roomId={roomId}
          currentUserId={userId}
          userRole={userRole}
          onClose={() => setAdminOpen(false)}
          onMembersChanged={refreshMembers}
        />
      )}

      {/* ─── Channel Manager (create/manage channels & sub-channels) ─── */}
      {managerMode && (
        <ChannelManager
          roomId={roomId}
          mode={managerMode}
          onClose={() => setManagerMode(null)}
          onChanged={() => loadChannels()}
          onLimitReached={(limit) => setUpgradeLimit(limit)}
        />
      )}

      {/* ─── Upgrade Modal (free-tier limits) ─── */}
      <UpgradeModal open={upgradeLimit !== null} limit={upgradeLimit} onClose={() => setUpgradeLimit(null)} />
    </div>
  )
}
