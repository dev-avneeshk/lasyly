"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, LayoutGrid, List } from "lucide-react"
import { cn } from "@/lib/utils"

export type PropSortKey = "popularity" | "hitRate" | "confidence" | "line" | "name"
export type PropViewMode = "grid" | "list"

export const SORT_OPTIONS: { key: PropSortKey; label: string }[] = [
  { key: "popularity", label: "Popularity" },
  { key: "hitRate", label: "Hit Rate" },
  { key: "confidence", label: "Confidence" },
  { key: "line", label: "Line (High–Low)" },
  { key: "name", label: "Player (A–Z)" },
]

interface PropsToolbarProps {
  /** Search field, supplied by the page so the toolbar stays presentational. */
  children: React.ReactNode
  sortBy: PropSortKey
  onSortChange: (key: PropSortKey) => void
  viewMode: PropViewMode
  onViewModeChange: (mode: PropViewMode) => void
}

export function PropsToolbar({
  children,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}: PropsToolbarProps) {
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const activeLabel = SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? "Popularity"

  useEffect(() => {
    if (!sortOpen) return
    function onPointerDown(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSortOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [sortOpen])

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">{children}</div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Sort */}
        <div ref={sortRef} className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            aria-expanded={sortOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 h-11 px-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 hover:border-white/20 transition-colors"
          >
            <span className="text-xs text-[var(--color-text-muted)]">Sort by</span>
            <span className="text-xs font-bold text-[var(--color-text-primary)]">{activeLabel}</span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform",
                sortOpen && "rotate-180"
              )}
            />
          </button>

          {sortOpen && (
            <div
              role="menu"
              className="absolute top-full right-0 mt-2 z-40 min-w-[196px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
            >
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={sortBy === option.key}
                  onClick={() => {
                    onSortChange(option.key)
                    setSortOpen(false)
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {option.label}
                  {sortBy === option.key && <Check className="w-3.5 h-3.5 text-[var(--color-lime)]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View mode */}
        <div
          className="flex items-center gap-1 h-11 p-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70"
          role="group"
          aria-label="Card layout"
        >
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            aria-pressed={viewMode === "list"}
            aria-label="Detailed list view"
            title="Detailed view — hit-rate windows, matchup grade, sentiment and AI notes"
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
              viewMode === "list"
                ? "bg-[var(--color-lime)] text-black"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5"
            )}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            aria-pressed={viewMode === "grid"}
            aria-label="Compact grid view"
            title="Compact view"
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
              viewMode === "grid"
                ? "bg-[var(--color-lime)] text-black"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
