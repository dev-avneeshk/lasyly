"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface DateNavigatorProps {
  selectedDate: string // YYYYMMDD
  onDateChange: (date: string) => void
}

function formatYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
}

function getLabel(date: Date, today: Date): string {
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return "Today"
  if (diff === -1) return "Yesterday"
  if (diff === 1) return "Tomorrow"
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export default function DateNavigator({ selectedDate, onDateChange }: DateNavigatorProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const dates = useMemo(() => {
    const result: { date: string; label: string; isToday: boolean }[] = []
    for (let i = -7; i <= 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      result.push({
        date: formatYYYYMMDD(d),
        label: getLabel(d, today),
        isToday: i === 0,
      })
    }
    return result
  }, [today])

  const selectedIndex = dates.findIndex((d) => d.date === selectedDate)

  const canGoBack = selectedIndex > 0
  const canGoForward = selectedIndex < dates.length - 1

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => canGoBack && onDateChange(dates[selectedIndex - 1].date)}
        disabled={!canGoBack}
        className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1.5 px-1">
          {dates.map((d) => {
            const isSelected = d.date === selectedDate
            return (
              <button
                key={d.date}
                onClick={() => onDateChange(d.date)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/30"
                    : d.isToday
                    ? "bg-white/10 text-white hover:bg-white/15"
                    : "text-[var(--color-text-muted)] hover:bg-white/5 hover:text-white"
                }`}
              >
                {d.label}
              </button>
            )
          })}
        </div>
      </div>

      <button
        onClick={() => canGoForward && onDateChange(dates[selectedIndex + 1].date)}
        disabled={!canGoForward}
        className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Next day"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}
