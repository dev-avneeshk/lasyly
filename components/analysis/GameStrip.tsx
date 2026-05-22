"use client"

import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Game } from "@/lib/props/types"

interface GameStripProps {
  games: Game[]
  loading: boolean
  sport?: string
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function getDateRange(): { label: string; date: string; isToday: boolean; dayName: string }[] {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const today = new Date()
  const result = []

  for (let i = -1; i <= 1; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    result.push({
      label: i === 0 ? "Today" : i === -1 ? "Yesterday" : "Tomorrow",
      date: d.toISOString().split("T")[0],
      isToday: i === 0,
      dayName: days[d.getDay()],
    })
  }

  return result
}

/**
 * Formats a game time string to the user's local timezone.
 */
function formatLocalTime(gameTime: string): string {
  try {
    const date = new Date(gameTime)
    if (isNaN(date.getTime())) return gameTime
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  } catch {
    return gameTime
  }
}

function abbreviate(name: string): string {
  if (name.length <= 4) return name.toUpperCase()
  const words = name.split(" ")
  const lastWord = words[words.length - 1]
  return lastWord.slice(0, 3).toUpperCase()
}

export function GameStrip({ games: initialGames, loading: initialLoading, sport = "NBA" }: GameStripProps) {
  const dates = useMemo(() => getDateRange(), [])
  const todayDate = useMemo(() => dates.find(d => d.isToday)?.date ?? "", [dates])
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const [games, setGames] = useState<Game[]>(initialGames)
  const [loading, setLoading] = useState(initialLoading)

  // Sync initial games when they arrive from parent
  useEffect(() => {
    if (selectedDate === todayDate) {
      setGames(initialGames)
      setLoading(initialLoading)
    }
  }, [initialGames, initialLoading, selectedDate, todayDate])

  // Fetch games when date changes (non-today)
  useEffect(() => {
    if (selectedDate === todayDate) return // Today's games come from parent

    let cancelled = false
    setLoading(true)

    fetch(`/api/props/games?sport=${sport}&date=${selectedDate}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setGames(data.games ?? [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGames([])
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [selectedDate, sport, todayDate])

  return (
    <div className="flex flex-col gap-3">
      {/* Date Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {dates.map((d) => (
          <button
            key={d.date}
            onClick={() => setSelectedDate(d.date)}
            className={cn(
              "shrink-0 flex flex-col items-center px-3 py-1.5 rounded-lg transition-all",
              selectedDate === d.date
                ? "bg-[var(--color-lime)] text-black"
                : "bg-[var(--color-surface)]/60 text-[var(--color-text-muted)] hover:bg-white/5 hover:text-white border border-[var(--color-border)]"
            )}
          >
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wider",
              selectedDate === d.date ? "text-black/60" : ""
            )}>
              {d.dayName}
            </span>
            <span className={cn(
              "text-[11px] font-bold",
              selectedDate === d.date ? "text-black" : "text-white"
            )}>
              {d.label}
            </span>
          </button>
        ))}
      </div>

      {/* Games Strip */}
      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 w-40 shrink-0 animate-pulse rounded-xl bg-white/5"
            />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="flex items-center justify-center h-14 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40">
          <p className="text-sm text-[var(--color-text-muted)]">
            No games {selectedDate === todayDate ? "today" : `on ${dates.find(d => d.date === selectedDate)?.label ?? selectedDate}`}
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {games.map((game) => (
            <div
              key={game.id}
              className={cn(
                "shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors",
                "border-[var(--color-border)] bg-[var(--color-surface)]/60",
                game.status === "live" && "border-[var(--color-lime)]/40"
              )}
            >
              {/* Away team */}
              <div className="flex items-center gap-1.5">
                {game.awayLogo ? (
                  <img src={game.awayLogo} alt="" className="w-5 h-5 object-contain" />
                ) : (
                  <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[7px] font-bold text-white/50">
                    {abbreviate(game.awayTeam).slice(0, 3)}
                  </div>
                )}
                <span className="text-xs font-semibold text-white">{abbreviate(game.awayTeam)}</span>
              </div>

              {/* Score / Status */}
              <div className="flex flex-col items-center">
                {game.status === "completed" ? (
                  <span className="text-[11px] font-mono font-bold text-white/80">
                    {game.awayScore} - {game.homeScore}
                  </span>
                ) : game.status === "live" ? (
                  <span className="text-[10px] font-bold text-[var(--color-lime)]">LIVE</span>
                ) : (
                  <span className="text-[10px] text-[var(--color-text-muted)]">@</span>
                )}
                {game.status === "scheduled" && (
                  <span className="text-[9px] text-[var(--color-text-muted)]" suppressHydrationWarning>
                    {formatLocalTime(game.gameTime)}
                  </span>
                )}
              </div>

              {/* Home team */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white">{abbreviate(game.homeTeam)}</span>
                {game.homeLogo ? (
                  <img src={game.homeLogo} alt="" className="w-5 h-5 object-contain" />
                ) : (
                  <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[7px] font-bold text-white/50">
                    {abbreviate(game.homeTeam).slice(0, 3)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
