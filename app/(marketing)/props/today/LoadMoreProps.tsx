"use client"

import { useState } from "react"
import Link from "next/link"
import type { PublicPropEntry } from "@/lib/data/public-props"

interface LoadMorePropsProps {
  props: PublicPropEntry[]
}

/**
 * Client component that reveals additional props beyond the initial 200.
 * Props are already server-rendered as hidden; this component manages visibility.
 */
export function LoadMoreProps({ props }: LoadMorePropsProps) {
  const [visible, setVisible] = useState(false)

  if (props.length === 0) return null

  return (
    <div className="mt-8">
      {!visible && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setVisible(true)}
            className="inline-flex items-center gap-2 border border-[var(--color-lime)]/30 text-[var(--color-lime)] font-semibold px-6 py-3 rounded-full text-sm hover:bg-[var(--color-lime)]/5 transition-colors"
          >
            Load {props.length} more props
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {visible && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {groupPropsBySportAndGame(props).map(([sport, games]) => (
            <div key={sport} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-[var(--color-lime)]" />
                <h3 className="text-lg font-bold text-white">{sport}</h3>
              </div>

              {games.map(([gameKey, gameProps]) => (
                <div key={gameKey} className="mb-5">
                  <div className="flex items-center gap-2 mb-3 pl-5">
                    <span className="text-sm font-semibold text-white/80">
                      {gameProps[0].game.awayTeam} @ {gameProps[0].game.homeTeam}
                    </span>
                  </div>

                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                    <div className="hidden sm:grid grid-cols-[1fr_120px_80px_90px_70px] gap-2 px-4 py-2.5 border-b border-[var(--color-border)] bg-white/[0.02]">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Player</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Stat</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right">Line</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-right">L10 Hit</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] text-center">Grade</span>
                    </div>

                    {gameProps.map((prop) => (
                      <LoadMorePropRow key={`${prop.playerSlug}-${prop.statCategory}`} prop={prop} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LoadMorePropRow({ prop }: { prop: PublicPropEntry }) {
  const gradeColor = getGradeColor(prop.matchupGrade)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_80px_90px_70px] gap-1 sm:gap-2 px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-2">
        <Link
          href={`/players/${prop.playerSlug}`}
          className="text-sm font-semibold text-white hover:text-[var(--color-lime)] transition-colors"
        >
          {prop.playerName}
        </Link>
        <span className="text-[11px] text-[var(--color-text-muted)] hidden sm:inline">{prop.team}</span>
      </div>

      <div className="flex items-center gap-3 sm:hidden text-xs text-[var(--color-text-muted)]">
        <span>{prop.statCategory}</span>
        <span className="font-semibold text-white">{prop.propLine}</span>
        <span className={prop.l10HitRate >= 60 ? "text-green-400" : prop.l10HitRate >= 40 ? "text-yellow-400" : "text-red-400"}>
          {prop.l10HitRate}%
        </span>
        <span className={`text-xs font-bold ${gradeColor}`}>{prop.matchupGrade}</span>
      </div>

      <span className="hidden sm:flex items-center text-sm text-[var(--color-text-muted)]">
        {prop.statCategory}
      </span>
      <span className="hidden sm:flex items-center justify-end text-sm font-semibold text-white">
        {prop.propLine}
      </span>
      <span className={`hidden sm:flex items-center justify-end text-sm font-medium ${prop.l10HitRate >= 60 ? "text-green-400" : prop.l10HitRate >= 40 ? "text-yellow-400" : "text-red-400"}`}>
        {prop.l10HitRate}%
      </span>
      <span className={`hidden sm:flex items-center justify-center text-sm font-bold ${gradeColor}`}>
        {prop.matchupGrade}
      </span>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupPropsBySportAndGame(
  props: PublicPropEntry[]
): [string, [string, PublicPropEntry[]][]][] {
  const grouped: Record<string, Record<string, PublicPropEntry[]>> = {}

  for (const prop of props) {
    if (!grouped[prop.sport]) {
      grouped[prop.sport] = {}
    }
    const gameKey = `${prop.game.awayTeam}@${prop.game.homeTeam}`
    if (!grouped[prop.sport][gameKey]) {
      grouped[prop.sport][gameKey] = []
    }
    grouped[prop.sport][gameKey].push(prop)
  }

  // Return as sorted entries
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sport, games]) => [
      sport,
      Object.entries(games).sort(([, a], [, b]) => {
        const timeA = new Date(a[0]?.game.startTime ?? "").getTime()
        const timeB = new Date(b[0]?.game.startTime ?? "").getTime()
        return timeA - timeB
      }),
    ])
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case "A": return "text-green-400"
    case "B": return "text-emerald-400"
    case "C": return "text-yellow-400"
    case "D": return "text-orange-400"
    case "F": return "text-red-400"
    default: return "text-[var(--color-text-muted)]"
  }
}
