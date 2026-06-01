"use client"

import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const ALLOWED_EMOJIS = ["🔥", "💰", "🎯", "👀", "💪", "❤️"] as const

type Reaction = {
  id: string
  message_id: string
  user_id: string
  emoji: string
}

type ReactionGroup = {
  emoji: string
  count: number
  hasReacted: boolean
}

type MessageReactionsProps = {
  messageId: string
  roomId: string
  currentUserId: string | null
}

export default function MessageReactions({ messageId, roomId, currentUserId }: MessageReactionsProps) {
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchReactions = async () => {
      const { data } = await supabase
        .from("message_reactions")
        .select("id, message_id, user_id, emoji")
        .eq("message_id", messageId)

      if (data) setReactions(data)
    }
    fetchReactions()
  }, [supabase, messageId])

  const grouped: ReactionGroup[] = useMemo(() => {
    const map = new Map<string, { count: number; hasReacted: boolean }>()
    for (const r of reactions) {
      const existing = map.get(r.emoji) ?? { count: 0, hasReacted: false }
      existing.count++
      if (r.user_id === currentUserId) existing.hasReacted = true
      map.set(r.emoji, existing)
    }
    return Array.from(map.entries()).map(([emoji, { count, hasReacted }]) => ({
      emoji,
      count,
      hasReacted,
    }))
  }, [reactions, currentUserId])

  const handleReaction = async (emoji: string) => {
    if (!currentUserId || loading) return
    setLoading(true)

    // Optimistic update
    const existingReaction = reactions.find(
      (r) => r.emoji === emoji && r.user_id === currentUserId
    )

    if (existingReaction) {
      setReactions((prev) => prev.filter((r) => r.id !== existingReaction.id))
    } else {
      const optimistic: Reaction = {
        id: `temp-${Date.now()}`,
        message_id: messageId,
        user_id: currentUserId,
        emoji,
      }
      setReactions((prev) => [...prev, optimistic])
    }

    try {
      const res = await fetch(`/api/rooms/${roomId}/messages/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, emoji }),
      })

      if (!res.ok) {
        // Revert optimistic update on failure
        const { data } = await supabase
          .from("message_reactions")
          .select("id, message_id, user_id, emoji")
          .eq("message_id", messageId)
        if (data) setReactions(data)
      }
    } catch {
      // Revert on network error
      const { data } = await supabase
        .from("message_reactions")
        .select("id, message_id, user_id, emoji")
        .eq("message_id", messageId)
      if (data) setReactions(data)
    } finally {
      setLoading(false)
      setShowPicker(false)
    }
  }

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {/* Existing reaction badges */}
      {grouped.map((group) => (
        <button
          key={group.emoji}
          type="button"
          onClick={() => handleReaction(group.emoji)}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all",
            group.hasReacted
              ? "bg-[var(--color-primary)]/15 border-[var(--color-primary)]/30 text-white"
              : "bg-white/5 border-white/10 text-[var(--color-text-muted)] hover:border-white/20"
          )}
        >
          <span>{group.emoji}</span>
          <span className="font-medium">{group.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      {currentUserId && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 text-[var(--color-text-muted)] hover:border-white/20 hover:text-white transition-all text-xs"
            title="Add reaction"
          >
            +
          </button>

          {/* Emoji picker */}
          {showPicker && (
            <div className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 rounded-lg bg-[var(--color-surface-elevated)] border border-white/10 shadow-xl z-50">
              {ALLOWED_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReaction(emoji)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-base"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
