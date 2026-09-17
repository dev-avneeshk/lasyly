"use client"

import { useCallback, useMemo } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { buildDayWindow, getSeasonInfo, shiftIso } from "@/lib/props/dates"

interface PropsHeaderProps {
  sport: string
  /** Currently selected day, local `YYYY-MM-DD`. */
  selectedDate: string
  /** Today's local `YYYY-MM-DD`, resolved once by the parent. */
  todayIso: string
  onDateChange: (iso: string) => void
}

/**
 * Editorial page header for the Props page: breadcrumb, title, season chip and
 * a three-day date navigator.
 */
export function PropsHeader({ sport, selectedDate, todayIso, onDateChange }: PropsHeaderProps) {
  const router = useRouter()
  const season = useMemo(() => getSeasonInfo(sport), [sport])
  const days = useMemo(() => buildDayWindow(selectedDate, todayIso, 1), [selectedDate, todayIso])

  // Props is a top-level destination (the top-bar sport tabs link straight to
  // `/analysis?sport=…`), so there's no parent route to climb to. Step back
  // through history when there is one, and fall back to Explore for direct
  // hits — a deep link or a fresh tab would otherwise leave this a dead end.
  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
      return
    }
    router.push("/explore")
  }, [router])

  return (
    <header className="flex flex-col gap-4">
      {/* Breadcrumb + kicker */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={goBack}
          aria-label={`Back from ${sport} props`}
          className="group flex items-center gap-1 -ml-1 rounded-md px-1 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/50"
        >
          <ChevronLeft
            aria-hidden
            className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5"
          />
          {sport}
        </button>
        <p className="hidden md:block text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-text-muted)]/60">
          Stats <span className="text-[var(--color-lime)]/50">•</span> Insights{" "}
          <span className="text-[var(--color-lime)]/50">•</span> Opportunity
        </p>
      </div>

      {/* Title + controls */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[30px] md:text-[38px] leading-[1.05] font-extrabold tracking-[-0.03em] text-[var(--color-text-primary)]">
            {sport}{" "}
            <span className="font-semibold text-[var(--color-text-muted)]">Player Props</span>
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
            Smarter data. Better decisions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Season context — display only; the feed always covers the live season. */}
          <div className="flex items-center gap-2.5 h-[52px] pl-3 pr-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70">
            {season.logoUrl ? (
              <Image
                src={season.logoUrl}
                alt=""
                width={24}
                height={24}
                className="w-6 h-6 object-contain"
                unoptimized
              />
            ) : (
              <span className="w-6 h-6 rounded-md bg-[var(--color-lime)]/15 text-[var(--color-lime)] text-[9px] font-black flex items-center justify-center">
                {sport.slice(0, 3).toUpperCase()}
              </span>
            )}
            <span className="flex flex-col leading-tight">
              <span className="text-[13px] font-bold text-[var(--color-text-primary)]">{season.label}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">{season.phase}</span>
            </span>
          </div>

          {/* Date navigator */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onDateChange(shiftIso(selectedDate, -1))}
              aria-label="Previous day"
              className="w-9 h-9 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/70 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-white/20 transition-colors flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 p-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70">
              {days.map((day) => {
                const isSelected = day.iso === selectedDate
                return (
                  <button
                    key={day.iso}
                    type="button"
                    onClick={() => onDateChange(day.iso)}
                    aria-pressed={isSelected}
                    aria-label={`${day.relativeLabel ?? day.dayName} ${day.monthDay}`}
                    className={cn(
                      "flex flex-col items-center justify-center min-w-[62px] px-3 py-1.5 rounded-lg transition-colors",
                      isSelected
                        ? "bg-[var(--color-lime)] text-black shadow-[0_0_18px_rgba(212,255,0,0.22)]"
                        : "text-[var(--color-text-muted)] hover:bg-white/5 hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider",
                        isSelected ? "text-black/60" : ""
                      )}
                      suppressHydrationWarning
                    >
                      {day.dayName}
                    </span>
                    <span className="text-[12px] font-bold" suppressHydrationWarning>
                      {day.monthDay}
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => onDateChange(shiftIso(selectedDate, 1))}
              aria-label="Next day"
              className="w-9 h-9 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/70 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-white/20 transition-colors flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
