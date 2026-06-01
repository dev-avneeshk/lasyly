"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Plus, Gift, Sticker, SmilePlus, Hash } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

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

type ChatPanelProps = {
  roomId: string
}

// Generate a consistent color from a user ID (Discord-style role colors)
function getUserColor(userId: string): string {
  const colors = [
    "#5865f2", "#57f287", "#fee75c", "#eb459e",
    "#ed4245", "#f47b67", "#e78284", "#99aab5",
  ]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// Group consecutive messages from the same user within 7 minutes (Discord groups within ~7min)
function groupMessages(messages: ChatMessage[]) {
  const groups: { userId: string; messages: ChatMessage[]; isSystem: boolean }[] = []

  for (const msg of messages) {
    const lastGroup = groups[groups.length - 1]
    if (msg.is_system) {
      groups.push({ userId: "system", messages: [msg], isSystem: true })
    } else if (lastGroup && !lastGroup.isSystem && lastGroup.userId === msg.user_id) {
      const lastMsg = lastGroup.messages[lastGroup.messages.length - 1]
      const timeDiff = new Date(msg.created_at).getTime() - new Date(lastMsg.created_at).getTime()
      if (timeDiff < 7 * 60 * 1000) {
        lastGroup.messages.push(msg)
      } else {
        groups.push({ userId: msg.user_id, messages: [msg], isSystem: false })
      }
    } else {
      groups.push({ userId: msg.user_id, messages: [msg], isSystem: false })
    }
  }

  return groups
}

function shouldShowDateSeparator(prev: ChatMessage | null, current: ChatMessage): boolean {
  if (!prev) return true
  const prevDate = new Date(prev.created_at).toDateString()
  const currDate = new Date(current.created_at).toDateString()
  return prevDate !== currDate
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"

  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()

  if (date.toDateString() === today.toDateString()) {
    return "Today at " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return date.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "numeric" }) +
    " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function ChatPanel({ roomId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(false)
  const [sending, setSending] = useState(false)
  const endOfMessagesRef = useRef<HTMLDivElement>(null)
  const lastSentRef = useRef<number>(0)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)
  const inputRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])

  const scrollToBottom = useCallback(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, display_name, avatar_url")
          .eq("id", user.id)
          .single()
        setCurrentUser({ id: user.id, profile })
      }
    }
    getUser()

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/messages`)
        const data = await res.json()
        if (res.ok && data.messages) {
          setMessages(data.messages)
        } else {
          setLoadError("Unable to load chat history.")
        }
      } catch {
        setLoadError("Unable to load chat history.")
      }
    }
    fetchMessages()

    const channel = supabase
      .channel(`room-chat-${roomId}`)
      .on("broadcast", { event: "new_message" }, (payload) => {
        const msg = payload.payload as ChatMessage
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [supabase, roomId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || !currentUser || cooldown || sending) return

    const now = Date.now()
    if (now - lastSentRef.current < 2000) {
      setCooldown(true)
      setTimeout(() => setCooldown(false), 2000 - (now - lastSentRef.current))
      return
    }
    lastSentRef.current = now

    const content = input.trim()
    setInput("")
    setSending(true)

    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      content,
      is_system: false,
      created_at: new Date().toISOString(),
      user_id: currentUser.id,
      profile: currentUser.profile,
    }
    setMessages((prev) => [...prev, optimisticMsg])

    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })

      if (res.ok) {
        const saved = await res.json()
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? { ...optimisticMsg, id: saved.id, created_at: saved.created_at } : m))
        )

        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "new_message",
            payload: {
              id: saved.id,
              content,
              is_system: false,
              created_at: saved.created_at,
              user_id: currentUser.id,
              profile: currentUser.profile,
            },
          })
        }
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
        const errData = await res.json().catch(() => ({}))
        if (errData.error) {
          setLoadError(errData.error)
          setTimeout(() => setLoadError(null), 4000)
        }
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
    } finally {
      setSending(false)
    }
  }

  const messageGroups = groupMessages(messages)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#313338]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Welcome message at top — Discord style */}
        <div className="px-4 pt-6 pb-4 mb-2">
          <div className="w-[68px] h-[68px] rounded-full bg-[#5865f2] flex items-center justify-center mb-3">
            <Hash className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-[32px] font-bold text-[#f2f3f5] leading-tight">Welcome to #general</h2>
          <p className="text-[14px] text-[#949ba4] mt-1">
            This is the start of the #general channel. Share picks, discuss games, and chat with the room.
          </p>
        </div>

        {loadError && (
          <div className="mx-4 rounded bg-[#f0b232]/10 border border-[#f0b232]/20 px-3 py-2 text-[13px] text-[#f0b232] mb-3">
            {loadError}
          </div>
        )}

        {/* Messages */}
        <div className="px-4">
          {messageGroups.map((group, groupIdx) => {
            const firstMsg = group.messages[0]
            const prevGroup = messageGroups[groupIdx - 1]
            const prevLastMsg = prevGroup?.messages[prevGroup.messages.length - 1] ?? null
            const showDate = shouldShowDateSeparator(prevLastMsg, firstMsg)

            return (
              <div key={`group-${groupIdx}`}>
                {showDate && (
                  <div className="flex items-center my-4">
                    <div className="flex-1 h-px bg-[#3f4147]" />
                    <span className="px-2 text-[11px] font-bold text-[#949ba4]">
                      {formatDateSeparator(firstMsg.created_at)}
                    </span>
                    <div className="flex-1 h-px bg-[#3f4147]" />
                  </div>
                )}

                {/* System messages */}
                {group.isSystem && (
                  <div className="flex items-center gap-2 py-1 px-2">
                    <div className="w-4 h-4 rounded-full bg-[#5865f2] flex items-center justify-center shrink-0">
                      <span className="text-[8px] text-white font-bold">→</span>
                    </div>
                    <span className="text-[14px] text-[#949ba4]">{firstMsg.content}</span>
                  </div>
                )}

                {/* User message group — Discord style */}
                {!group.isSystem && (
                  <div className="group/msg hover:bg-[#2e3035] rounded py-0.5 px-2 -mx-2 mt-[17px] first:mt-0">
                    {group.messages.map((msg, msgIdx) => {
                      const name = msg.profile?.display_name || msg.profile?.username || "User"
                      const isFirst = msgIdx === 0
                      const userColor = getUserColor(msg.user_id)

                      if (isFirst) {
                        return (
                          <div key={msg.id} className="flex gap-4">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full shrink-0 mt-0.5 cursor-pointer hover:opacity-80 overflow-hidden flex items-center justify-center" style={{ backgroundColor: userColor }}>
                              {msg.profile?.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={msg.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[13px] font-bold text-white">
                                  {name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span
                                  className="text-[14px] font-medium hover:underline cursor-pointer"
                                  style={{ color: userColor }}
                                >
                                  {name}
                                </span>
                                <span className="text-[11px] text-[#949ba4]">
                                  {formatTimestamp(msg.created_at)}
                                </span>
                              </div>
                              <p className="text-[14px] text-[#dbdee1] leading-[1.375rem] break-words whitespace-pre-wrap">
                                {msg.content}
                              </p>
                            </div>
                          </div>
                        )
                      }

                      // Continuation message (no avatar, just indented text)
                      return (
                        <div key={msg.id} className="flex gap-4">
                          <div className="w-10 shrink-0 flex items-center justify-center">
                            <span className="text-[10px] text-[#949ba4] opacity-0 group-hover/msg:opacity-100 transition-opacity">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-[14px] text-[#dbdee1] leading-[1.375rem] break-words whitespace-pre-wrap min-w-0">
                            {msg.content}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div ref={endOfMessagesRef} className="h-6" />
      </div>

      {/* Input Area — Discord style */}
      <div className="shrink-0 px-4 pb-6 pt-0">
        <div className="flex items-center bg-[#383a40] rounded-lg">
          {/* Attach button */}
          <button
            type="button"
            className="flex items-center justify-center w-11 h-11 shrink-0 text-[#b5bac1] hover:text-[#dbdee1] transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={currentUser ? "Message #general" : "Sign in to chat"}
            disabled={!currentUser}
            maxLength={1000}
            className="flex-1 bg-transparent text-[14px] text-[#dbdee1] placeholder:text-[#6d6f78] focus:outline-none py-2.5 disabled:opacity-40"
          />

          {/* Right side buttons */}
          <div className="flex items-center gap-0.5 pr-2 shrink-0">
            <button type="button" className="w-8 h-8 flex items-center justify-center text-[#b5bac1] hover:text-[#dbdee1] transition-colors rounded">
              <Gift className="w-5 h-5" />
            </button>
            <button type="button" className="w-8 h-8 flex items-center justify-center text-[#b5bac1] hover:text-[#dbdee1] transition-colors rounded">
              <Sticker className="w-5 h-5" />
            </button>
            <button type="button" className="w-8 h-8 flex items-center justify-center text-[#b5bac1] hover:text-[#dbdee1] transition-colors rounded">
              <SmilePlus className="w-5 h-5" />
            </button>
          </div>
        </div>
        {cooldown && (
          <p className="text-[11px] text-[#f0b232] mt-1 ml-3">Slow down — 1 message every 2 seconds</p>
        )}
      </div>
    </div>
  )
}
