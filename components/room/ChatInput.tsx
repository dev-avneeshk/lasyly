"use client"

import { memo, useState, useCallback } from "react"

type ChatInputProps = {
  disabled: boolean
  placeholder: string
  /** Send the trimmed message. Returns nothing; parent handles the async work. */
  onSend: (content: string) => void
}

/**
 * Chat message input, isolated into its own component with LOCAL state.
 *
 * Keeping `input` here (instead of in the room page) means keystrokes only
 * re-render this small component — not the entire message feed. This is the
 * single biggest client-side win for chat perf: typing no longer reconciles
 * hundreds of message rows.
 */
function ChatInputBase({ disabled, placeholder, onSend }: ChatInputProps) {
  const [value, setValue] = useState("")

  const submit = useCallback(() => {
    const content = value.trim()
    if (!content) return
    onSend(content)
    setValue("")
  }, [value, onSend])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    },
    [submit]
  )

  return (
    <div className="shrink-0 px-5 pb-5 pt-2">
      <div className="flex items-center gap-3 bg-[#1A1A1A] border border-white/[0.06] rounded-2xl px-5 py-1.5 focus-within:border-[rgba(184,255,79,0.2)] transition-colors">
        <button className="text-white/20 hover:text-white/40 text-lg transition-colors shrink-0">＋</button>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={1000}
          className="flex-1 bg-transparent text-[14px] text-white/90 placeholder:text-white/20 focus:outline-none py-2.5 disabled:opacity-40"
        />
        <div className="flex gap-1 shrink-0">
          <button className="w-8 h-8 rounded-lg text-white/20 hover:text-white/40 flex items-center justify-center text-sm transition-colors">GIF</button>
          <button className="w-8 h-8 rounded-lg text-white/20 hover:text-white/40 flex items-center justify-center text-sm transition-colors">😀</button>
        </div>
      </div>
    </div>
  )
}

export const ChatInput = memo(ChatInputBase)
