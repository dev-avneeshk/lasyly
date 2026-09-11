"use client"

import { memo, useState, useCallback, useRef, useEffect } from "react"
import { Plus, Smile, SendHorizonal } from "lucide-react"
import { cn } from "@/lib/utils"

type ChatInputProps = {
  disabled: boolean
  placeholder: string
  /** Send the trimmed message. Returns nothing; parent handles the async work. */
  onSend: (content: string) => void
}

const MAX_LEN = 1000

/**
 * Chat message input, isolated into its own component with LOCAL state.
 *
 * Keeping `input` here (instead of in the room page) means keystrokes only
 * re-render this small component — not the entire message feed. This is the
 * single biggest client-side win for chat perf: typing no longer reconciles
 * hundreds of message rows.
 *
 * Uses an auto-growing textarea so multi-line drafts are visible while typing.
 */
function ChatInputBase({ disabled, placeholder, onSend }: ChatInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-grow the textarea up to a sensible cap.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }, [value])

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

  const canSend = value.trim().length > 0 && !disabled
  const nearLimit = value.length > MAX_LEN - 100

  return (
    <div className="shrink-0 px-5 pb-5 pt-2">
      <div
        className={cn(
          "flex items-end gap-2 bg-[#161616] border rounded-2xl pl-2.5 pr-2 py-1.5 transition-colors",
          disabled
            ? "border-white/[0.05] opacity-70"
            : "border-white/[0.07] focus-within:border-[rgba(184,255,79,0.28)]"
        )}
      >
        <button
          type="button"
          disabled={disabled}
          className="w-9 h-9 shrink-0 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.06] flex items-center justify-center transition-colors disabled:opacity-40"
          title="Add attachment"
          aria-label="Add attachment"
        >
          <Plus className="w-5 h-5" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={MAX_LEN}
          className="flex-1 resize-none bg-transparent text-[14px] leading-[1.5] text-white/90 placeholder:text-white/25 focus:outline-none py-2 disabled:opacity-40 max-h-[140px]"
        />

        <div className="flex items-center gap-1 shrink-0 self-end pb-0.5">
          {nearLimit && (
            <span className={cn("text-[10px] font-mono mr-1", value.length >= MAX_LEN ? "text-[#F87171]" : "text-white/30")}>
              {MAX_LEN - value.length}
            </span>
          )}
          <button
            type="button"
            disabled={disabled}
            className="w-9 h-9 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.06] flex items-center justify-center transition-colors disabled:opacity-40"
            title="Emoji"
            aria-label="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
              canSend
                ? "bg-[#B8FF4F] text-black hover:bg-[#a9f53a] scale-100"
                : "bg-white/[0.06] text-white/25 scale-95 cursor-not-allowed"
            )}
            title="Send"
            aria-label="Send message"
          >
            <SendHorizonal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export const ChatInput = memo(ChatInputBase)
