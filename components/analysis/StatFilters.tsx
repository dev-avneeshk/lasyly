"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatFilter } from "@/lib/props/types"

interface StatFiltersProps {
  filters: StatFilter[]
  activeStat: string
  onStatChange: (stat: string) => void
  /** How many pills to show before collapsing the rest into "More". */
  visibleCount?: number
}

export function StatFilters({
  filters,
  activeStat,
  onStatChange,
  visibleCount = 7,
}: StatFiltersProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const { inline, overflow } = useMemo(() => {
    if (filters.length <= visibleCount) return { inline: filters, overflow: [] as StatFilter[] }

    const head = filters.slice(0, visibleCount)
    const tail = filters.slice(visibleCount)

    // Keep the active filter visible even when it lives in the overflow.
    const activeInTail = tail.findIndex((f) => f.key === activeStat)
    if (activeInTail === -1) return { inline: head, overflow: tail }

    const promoted = tail[activeInTail]
    return {
      inline: [...head.slice(0, visibleCount - 1), promoted],
      overflow: [head[visibleCount - 1], ...tail.filter((_, i) => i !== activeInTail)],
    }
  }, [filters, activeStat, visibleCount])

  useEffect(() => {
    if (!moreOpen) return
    function onPointerDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [moreOpen])

  const pillClass = (isActive: boolean) =>
    cn(
      "shrink-0 h-8 px-4 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5",
      isActive
        ? "bg-[var(--color-lime)] text-black"
        : "border border-[var(--color-border)] bg-[var(--color-surface)]/70 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-white/20"
    )

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5"
      role="group"
      aria-label="Stat filters"
    >
      {inline.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onStatChange(filter.key)}
          aria-pressed={activeStat === filter.key}
          className={pillClass(activeStat === filter.key)}
        >
          {filter.label}
        </button>
      ))}

      {overflow.length > 0 && (
        <div ref={moreRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={pillClass(false)}
          >
            More
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", moreOpen && "rotate-180")} />
          </button>

          {moreOpen && (
            <div
              role="menu"
              className="absolute top-full right-0 mt-2 z-40 min-w-[176px] max-h-[300px] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
            >
              {overflow.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeStat === filter.key}
                  onClick={() => {
                    onStatChange(filter.key)
                    setMoreOpen(false)
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {filter.label}
                  {activeStat === filter.key && <Check className="w-3.5 h-3.5 text-[var(--color-lime)]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
