"use client"

import { useState, useCallback } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
  title: string
  defaultExpanded?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({
  title,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        toggle()
      }
    },
    [toggle]
  )

  return (
    <div className="border-b border-[var(--color-border)]/50 last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/50 focus-visible:ring-inset"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}
