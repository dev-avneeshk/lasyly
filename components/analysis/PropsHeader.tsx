"use client"

import { useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { TOP_BAR_SPORTS } from "@/components/layout/TopBarSportTabs"
import { buildDayWindow, getSeasonInfo, parseLocalIso, shiftIso } from "@/lib/props/dates"

interface PropsHeaderProps {
  sport: string
  /** Currently selected day, local `YYYY-MM-DD`. */
  selectedDate: string
  /** Today's local `YYYY-MM-DD`, resolved once by the parent. */
  todayIso: string
  onDateChange: (iso: string) => void
  /** The day's games, rendered beside the title on wide screens. */
  games?: React.ReactNode
}

/**
 * Props page header: league mark, title, a date pill with day stepping, and
 * the day's game carousel (the per-game filter) on the same row.
 */
export function PropsHeader({ sport, selectedDate, todayIso, onDateChange, games }: PropsHeaderProps) {
  const season = useMemo(() => getSeasonInfo(sport), [sport])
  const day = useMemo(() => buildDayWindow(selectedDate, todayIso, 0)[0], [selectedDate, todayIso])
  const fullDate = useMemo(
    () =>
      parseLocalIso(selectedDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [selectedDate]
  )

  return (
    <header className="flex flex-col gap-4">
      {/* Sport switcher for small screens, where the top-bar tabs are hidden. */}
      <nav
        aria-label="Props sport"
        className="md:hidden -mx-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-1"
      >
        {TOP_BAR_SPORTS.map((s) => {
          const isActive = s.toLowerCase() === sport.toLowerCase()
          return (
            <Link
              key={s}
              href={`/analysis?sport=${s}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "shrink-0 h-9 px-4 rounded-full border text-[13px] font-bold tracking-wide flex items-center transition-colors",
                isActive
                  ? "bg-[var(--color-lime)] border-[var(--color-lime)] text-black"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]/70 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {s}
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        {/* Title */}
        <div className="flex items-center gap-3 shrink-0">
          {season.logoUrl ? (
            <Image
              src={season.logoUrl}
              alt=""
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
              unoptimized
            />
          ) : (
            <span className="w-10 h-10 rounded-lg bg-[var(--color-lime)]/15 text-[var(--color-lime)] text-[11px] font-black flex items-center justify-center">
              {sport.slice(0, 3).toUpperCase()}
            </span>
          )}
          <div className="leading-tight">
            <h1 className="text-[24px] md:text-[26px] font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
              {sport} Props Analysis
            </h1>
            <p className="text-[12px] text-[var(--color-text-muted)]">
              AI projections, matchup analytics and data-driven props.
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3 xl:justify-end">
          {/* Date pill with day stepping */}
          <div className="flex shrink-0 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70">
            <button
              type="button"
              onClick={() => onDateChange(shiftIso(selectedDate, -1))}
              aria-label="Previous day"
              className="h-[56px] w-7 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-2 pr-1">
              <CalendarDays aria-hidden className="h-4 w-4 text-[var(--color-text-muted)]" />
              <span className="leading-tight" suppressHydrationWarning>
                <span className="block text-[12px] font-bold text-[var(--color-text-primary)]">
                  {day.relativeLabel ?? day.dayName}
                </span>
                <span className="block text-[11px] text-[var(--color-text-muted)]">{fullDate}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDateChange(shiftIso(selectedDate, 1))}
              aria-label="Next day"
              className="h-[56px] w-7 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Game carousel */}
          {games && <div className="min-w-0 flex-1 xl:max-w-[760px]">{games}</div>}
        </div>
      </div>
    </header>
  )
}
