"use client"

import { X } from "lucide-react"

export interface StatsPanelHeaderProps {
  playerName: string
  teamAbbr: string
  position: string
  statCategory: string
  onClose: () => void
}

export function StatsPanelHeader({
  playerName,
  teamAbbr,
  position,
  statCategory,
  onClose,
}: StatsPanelHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 pb-4 pt-5">
      <div className="min-w-0">
        <h2
          id="stats-panel-title"
          className="truncate text-lg font-bold text-white"
        >
          {playerName}
        </h2>
        <div className="mt-1 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <span className="font-medium">{teamAbbr}</span>
          <span aria-hidden="true">·</span>
          <span>{position}</span>
          <span aria-hidden="true">·</span>
          <span className="capitalize">{statCategory}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/50"
        aria-label="Close stats panel"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
