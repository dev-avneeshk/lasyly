"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Send, Smile, Image as ImageIcon, MoreVertical, Wifi } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

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

export default function ChatPanel({ roomId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(false)
  const endOfMessagesRef = useRef<HTMLDivElement>(null)
  const lastSentRef = useRef<number>(0)
  const supabase = useMemo(() => createClient(), [])

  const scrollToBottom = useCallback(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    // 1. Get current user
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

    // 2. Fetch initial messages from API (single DB call, no realtime subscription)
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

    // 3. Subscribe to Broadcast channel (lightweight — no DB polling)
    // This uses Supabase Realtime Broadcast, which is a pub/sub system
    // that doesn't require postgres_changes or DB triggers
    const channel = supabase
      .channel(`room-chat-${roomId}`)
      .on("broadcast", { event: "new_message" }, (payload) => {
        const msg = payload.payload as ChatMessage
        setMessages((prev) => {
          // Avoid duplicates (in case sender also receives their own broadcast)
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, roomId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !currentUser || cooldown) return

    // Client-side rate limit: 2 second cooldown
    const now = Date.now()
    if (now - lastSentRef.current < 2000) {
      setCooldown(true)
      setTimeout(() => setCooldown(false), 2000 - (now - lastSentRef.current))
      return
    }
    lastSentRef.current = now

    const content = input.trim()
    setInput("")

    // Optimistic: add message locally immediately
    const optimisticMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      content,
      is_system: false,
      created_at: new Date().toISOString(),
      user_id: currentUser.id,
      profile: currentUser.profile,
    }
    setMessages((prev) => [...prev, optimisticMsg])

    // Persist to DB via API (single insert, no realtime subscription needed)
    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })

    if (res.ok) {
      const saved = await res.json()

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? { ...optimisticMsg, id: saved.id } : m))
      )

      // Broadcast to other clients in the room (lightweight pub/sub)
      const channel = supabase.channel(`room-chat-${roomId}`)
      channel.send({
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
    } else {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)]/40 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden relative">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-[var(--color-surface)]/80">
        <div>
          <h2 className="font-bold text-white">Live Chat</h2>
          <p className="text-xs text-[var(--color-text-muted)]">{messages.length} messages</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-secondary)]">
            <Wifi className="h-3 w-3" />
            Live
          </span>
          <button className="text-[var(--color-text-muted)] hover:text-white transition-colors" aria-label="Chat options">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loadError && (
          <div className="rounded-lg border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 p-3 text-xs text-[var(--color-warning)]">
            {loadError}
          </div>
        )}

        {messages.length === 0 && !loadError && (
          <div className="mx-auto my-10 max-w-xs rounded-lg border border-white/10 bg-white/[0.03] p-5 text-center">
            <p className="text-sm font-semibold text-white">No messages yet</p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              Be the first to start the conversation.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = currentUser?.id === msg.user_id
          const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          const name = msg.profile?.display_name || msg.profile?.username || "User"
          const avatar = msg.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6C63FF&color=fff`

          return msg.is_system ? (
            <div key={msg.id} className="flex justify-center my-4">
              <div className="px-4 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-xs font-medium text-[var(--color-primary)] shadow-[0_0_10px_rgba(108,99,255,0.1)]">
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
              {!isMe && (
                <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover border border-white/10" />
              )}
              <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[80%]`}>
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-white/90">{name}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">{time}</span>
                  </div>
                )}
                <div className={`px-4 py-2 rounded-lg text-sm ${
                  isMe
                    ? "bg-[var(--color-primary)] text-white rounded-tr-sm shadow-[0_4px_15px_rgba(108,99,255,0.3)]"
                    : "bg-[var(--color-surface-elevated)] text-white/90 rounded-tl-sm border border-white/5"
                }`}>
                  {msg.content}
                </div>
                {isMe && (
                  <span className="text-[10px] text-[var(--color-text-muted)] mt-1">{time}</span>
                )}
              </div>
            </div>
          )
        })}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="p-3 bg-[var(--color-surface)]/80 border-t border-white/5">
        <form onSubmit={handleSend} className="relative flex items-center">
          <button type="button" className="absolute left-3 text-[var(--color-text-muted)] hover:text-white transition-colors">
            <ImageIcon className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentUser ? "Send a message..." : "Sign in to chat"}
            disabled={!currentUser}
            className="w-full h-11 bg-black/20 border border-white/10 rounded-xl pl-11 pr-24 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-all disabled:opacity-50"
          />

          <div className="absolute right-2 flex items-center gap-1">
            <button type="button" className="p-1.5 text-[var(--color-text-muted)] hover:text-[#FFD700] transition-colors">
              <Smile className="w-5 h-5" />
            </button>
            <button
              type="submit"
              disabled={!input.trim() || !currentUser || cooldown}
              className="p-1.5 rounded-lg bg-[var(--color-primary)] text-white disabled:opacity-50 disabled:bg-white/5 disabled:text-white/30 transition-all hover:bg-[var(--color-primary)]/90"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
