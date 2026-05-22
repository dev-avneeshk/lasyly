"use client"

import { useState, useEffect } from "react"
import { Sparkles, X } from "lucide-react"

interface AIWriteupProps {
  propId: string
  writeup: string | null
  loading: boolean
  error: boolean
  retryCount: number
  onRetry: () => void
  onExpand: () => void
}

export function AIWriteup({
  propId,
  writeup,
  loading,
  error,
  retryCount,
  onRetry,
  onExpand,
}: AIWriteupProps) {
  const [showPopup, setShowPopup] = useState(false)

  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (!showPopup) return
    const timer = setTimeout(() => setShowPopup(false), 3000)
    return () => clearTimeout(timer)
  }, [showPopup])

  function handleClick() {
    setShowPopup(true)
  }

  return (
    <div className="relative">
      {/* AI Analysis button */}
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/50 rounded"
        aria-label="AI Analysis - coming soon"
      >
        <Sparkles className="w-3.5 h-3.5 text-[var(--color-lime)]" />
        <span className="text-xs font-medium text-[var(--color-text-muted)]">
          AI Analysis
        </span>
      </button>

      {/* Coming Soon Popup */}
      {showPopup && (
        <div className="absolute bottom-full left-0 mb-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl px-4 py-3 shadow-lg min-w-[200px]">
            <Sparkles className="w-4 h-4 text-[var(--color-lime)] shrink-0" />
            <span className="text-xs text-white font-medium whitespace-nowrap">
              This feature isn&apos;t available yet
            </span>
            <button
              type="button"
              onClick={() => setShowPopup(false)}
              className="ml-auto text-[var(--color-text-muted)] hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
