"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import ScoresPanel from "@/components/room/ScoresPanel"
import AdminPanel from "@/components/room/AdminPanel"

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

type ChatMessage = {
  id: string
  content: string
  is_system: boolean
  created_at: string
  user_id: string
  profile: ChatProfile | null
}

type CurrentUser = {
  id: string
  profile: ChatProfile | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CHANNELS = [
  { id: "general", name: "general-chat", icon: "💬", category: "General" },
  { id: "match-day", name: "match-day", icon: "🏟️", category: "General" },
  { id: "hot-tips", name: "hot-tips", icon: "🔥", category: "Tips & Analysis", locked: true },
  { id: "stats", name: "stats-analysis", icon: "📊", category: "Tips & Analysis" },
  { id: "predictions", name: "predictions", icon: "🎯", category: "Tips & Analysis" },
  { id: "bankroll", name: "bankroll-talk", icon: "💰", category: "Community" },
  { id: "leaderboard", name: "leaderboard", icon: "🏆", category: "Community" },
  { id: "live-scores", name: "live-scores", icon: "📺", category: "Live" },
]

const SPORT_EMOJI: Record<string, string> = {
  Football: "⚽", Basketball: "🏀", Tennis: "🎾", Mixed: "🔥", Other: "🎯",
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getUserColor(userId: string): string {
  const colors = ["#B8FF4F", "#60A5FA", "#F87171", "#FBBF24", "#34D399", "#A78BFA", "#F472B6", "#FB923C"]
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return isToday ? `Today ${time}` : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
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
  const [activeChannel, setActiveChannel] = useState("general")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [userRole, setUserRole] = useState<"owner" | "moderator" | "member">("member")
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: string; isOwnMessage: boolean } | null>(null)
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set())

  const feedRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)

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

      setLoading(false)
    }
    load()
  }, [supabase, roomId])

  // Members are loaded in the main load effect above

  // ─── Load Messages + Realtime ───────────────────────────────────────────────

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("username, display_name, avatar_url").eq("id", user.id).single()
        setCurrentUser({ id: user.id, profile })
      }
    }
    getUser()

    const fetchMessages = async () => {
      const res = await fetch(`/api/rooms/${roomId}/messages`)
      const data = await res.json()
      if (res.ok && data.messages) setMessages(data.messages)
    }
    fetchMessages()

    const channel = supabase.channel(`room-chat-${roomId}`)
      .on("broadcast", { event: "new_message" }, (payload) => {
        const msg = payload.payload as ChatMessage
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      }).subscribe()
    channelRef.current = channel

    return () => { supabase.removeChannel(channel); channelRef.current = null }
  }, [supabase, roomId])

  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" }) }, [messages])

  // ─── Send Message ───────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!input.trim() || !currentUser || sending) return
    const content = input.trim()
    setInput("")
    setSending(true)

    const optimistic: ChatMessage = { id: `temp-${Date.now()}`, content, is_system: false, created_at: new Date().toISOString(), user_id: currentUser.id, profile: currentUser.profile }
    setMessages(prev => [...prev, optimistic])

    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) })
      if (res.ok) {
        const saved = await res.json()
        setMessages(prev => prev.map(m => m.id === optimistic.id ? { ...optimistic, id: saved.id, created_at: saved.created_at } : m))
        channelRef.current?.send({ type: "broadcast", event: "new_message", payload: { id: saved.id, content, is_system: false, created_at: saved.created_at, user_id: currentUser.id, profile: currentUser.profile } })
      } else {
        setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      }
    } catch { setMessages(prev => prev.filter(m => m.id !== optimistic.id)) }
    finally { setSending(false) }
  }

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

  const handleContextMenu = (e: React.MouseEvent, messageId: string, messageUserId: string) => {
    if (!isAdmin && messageUserId !== userId) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, messageId, isOwnMessage: messageUserId === userId })
  }

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
  const categories = [...new Set(CHANNELS.map(c => c.category))]

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
        <div className="flex-1 px-2 pb-4">
          {categories.map(cat => (
            <div key={cat} className="mb-4">
              <div className="flex items-center gap-1 px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/25 select-none">
                <span className="text-[8px]">▼</span> {cat}
              </div>
              <div className="flex flex-col gap-0.5">
                {CHANNELS.filter(c => c.category === cat).map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left transition-all text-[13px]",
                      activeChannel === ch.id
                        ? "bg-[rgba(184,255,79,0.12)] text-white/90"
                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                    )}
                  >
                    <span className="text-[15px] w-5 text-center">{ch.icon}</span>
                    <span className="flex-1 font-medium truncate">{ch.name}</span>
                    {ch.locked && <span className="text-[10px] text-white/20">🔒</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
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
            <span className="text-[15px]">{CHANNELS.find(c => c.id === activeChannel)?.icon ?? "💬"}</span>
            {CHANNELS.find(c => c.id === activeChannel)?.name ?? "general-chat"}
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
        {activeChannel === "live-scores" ? (
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
                  <p className="text-[14px] font-semibold text-white/80">Welcome to #{CHANNELS.find(c => c.id === activeChannel)?.name}</p>
                  <p className="text-[12px] text-white/30 mt-1 max-w-[280px]">This is the start of the channel. Share picks, discuss games, and react to tips.</p>
                </div>
              )}

              {messages.map((msg, i) => {
                if (msg.is_system) return (
                  <div key={msg.id} className="flex items-center gap-2 py-1 px-2">
                    <span className="text-[12px] text-white/30">{msg.content}</span>
                  </div>
                )

                const name = msg.profile?.display_name || msg.profile?.username || "User"
                const color = getUserColor(msg.user_id)
                const prevMsg = messages[i - 1]
                const isGrouped = prevMsg && !prevMsg.is_system && prevMsg.user_id === msg.user_id &&
                  (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 7 * 60 * 1000
                const isPinned = pinnedMessages.has(msg.id)

                if (isGrouped) {
                  return (
                    <div
                      key={msg.id}
                      className={cn("flex gap-4 px-4 hover:bg-white/[0.02] rounded-xl group relative", isPinned && "border-l-2 border-[#FBBF24]/40")}
                      onContextMenu={(e) => handleContextMenu(e, msg.id, msg.user_id)}
                    >
                      <div className="w-10 shrink-0 flex items-center justify-center">
                        <span className="text-[10px] text-white/20 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-[14px] text-white/80 leading-[1.7] break-words whitespace-pre-wrap">{msg.content}</p>
                      {isPinned && <span className="absolute top-1 right-2 text-[10px] text-[#FBBF24]/50">📌</span>}
                    </div>
                  )
                }

                return (
                  <div
                    key={msg.id}
                    className={cn("flex gap-4 px-4 py-3 hover:bg-white/[0.02] rounded-xl mt-2 first:mt-0 relative", isPinned && "border-l-2 border-[#FBBF24]/40")}
                    onContextMenu={(e) => handleContextMenu(e, msg.id, msg.user_id)}
                  >
                    <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-[13px] font-semibold" style={{ background: `${color}20`, color }}>
                      {msg.profile?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={msg.profile.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                      ) : getInitials(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                        <span className="text-[14px] font-semibold" style={{ color }}>{name}</span>
                        <span className="text-[11px] text-white/20">{formatTime(msg.created_at)}</span>
                        {isPinned && <span className="text-[10px] text-[#FBBF24]/60">📌 pinned</span>}
                      </div>
                      <p className="text-[14px] text-white/80 leading-[1.7] break-words whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Message Input */}
            <div className="shrink-0 px-5 pb-5 pt-2">
              <div className="flex items-center gap-3 bg-[#1A1A1A] border border-white/[0.06] rounded-2xl px-5 py-1.5 focus-within:border-[rgba(184,255,79,0.2)] transition-colors">
                <button className="text-white/20 hover:text-white/40 text-lg transition-colors shrink-0">＋</button>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={currentUser ? `Message #${CHANNELS.find(c => c.id === activeChannel)?.name ?? "general"}` : "Sign in to chat"}
                  disabled={!currentUser}
                  maxLength={1000}
                  className="flex-1 bg-transparent text-[14px] text-white/90 placeholder:text-white/20 focus:outline-none py-2.5 disabled:opacity-40"
                />
                <div className="flex gap-1 shrink-0">
                  <button className="w-8 h-8 rounded-lg text-white/20 hover:text-white/40 flex items-center justify-center text-sm transition-colors">GIF</button>
                  <button className="w-8 h-8 rounded-lg text-white/20 hover:text-white/40 flex items-center justify-center text-sm transition-colors">😀</button>
                </div>
              </div>
            </div>
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
            <div className="flex-1 px-2 py-4">
              {categories.map(cat => (
                <div key={cat} className="mb-4">
                  <div className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/25">▼ {cat}</div>
                  {CHANNELS.filter(c => c.category === cat).map(ch => (
                    <button
                      key={ch.id}
                      onClick={() => { setActiveChannel(ch.id); setDrawerOpen(false) }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left text-[13px] transition-all",
                        activeChannel === ch.id ? "bg-[rgba(184,255,79,0.12)] text-white/90" : "text-white/40"
                      )}
                    >
                      <span className="text-[15px]">{ch.icon}</span>
                      <span className="font-medium">{ch.name}</span>
                    </button>
                  ))}
                </div>
              ))}
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
    </div>
  )
}
