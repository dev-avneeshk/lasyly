"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Game } from "@/lib/props/types"
import { TodayGame } from "@/lib/analytics/engine-v2"
import { buildDayWindow, formatGameTime } from "@/lib/props/dates"

interface GameStripProps {
  /** Scheduled games for the selected date (source of logos and scores). */
  games: Game[]
  /**
   * Abbreviation-keyed games from the props engine. When present the strip
   * becomes a matchup filter, because these carry the exact abbreviations the
   * `matchup` API param expects.
   */
  todayGames?: TodayGame[]
  loading: boolean
  selectedDate: string
  todayIso: string
  selectedMatchup?: string | null
  onSelectMatchup?: (matchup: string | null) => void
}

interface StripItem {
  id: string
  /** Matchup key for the API (`HOME-AWAY`), or null when not filterable. */
  matchupKey: string | null
  awayAbbr: string
  homeAbbr: string
  awayLogo: string | null
  homeLogo: string | null
  time: string
  status: "scheduled" | "live" | "final"
  awayScore?: number
  homeScore?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function abbreviate(name: string): string {
  if (!name) return "—"
  if (name.length <= 4) return name.toUpperCase()
  const words = name.split(" ")
  return words[words.length - 1].slice(0, 3).toUpperCase()
}

/**
 * ESPN team logo URLs end in the team's slug (`.../nfl/500/buf.png`), which
 * matches the abbreviations the props engine returns. That gives us a reliable
 * join key between the two feeds without maintaining a name→abbr table.
 */
function slugFromLogo(url?: string | null): string | null {
  if (!url) return null
  const match = url.match(/\/([a-z0-9]+)\.png(?:$|\?)/i)
  return match ? match[1].toLowerCase() : null
}

function normalizeStatus(status: Game["status"]): StripItem["status"] {
  return status === "completed" ? "final" : status
}

function buildItems(games: Game[], todayGames: TodayGame[]): StripItem[] {
  const logoBySlug = new Map<string, string>()
  const scoreByPair = new Map<string, { away?: number; home?: number; status: StripItem["status"] }>()

  for (const game of games) {
    const awaySlug = slugFromLogo(game.awayLogo)
    const homeSlug = slugFromLogo(game.homeLogo)
    if (awaySlug && game.awayLogo) logoBySlug.set(awaySlug, game.awayLogo)
    if (homeSlug && game.homeLogo) logoBySlug.set(homeSlug, game.homeLogo)
    if (awaySlug && homeSlug) {
      scoreByPair.set(`${awaySlug}-${homeSlug}`, {
        away: game.awayScore,
        home: game.homeScore,
        status: normalizeStatus(game.status),
      })
    }
  }

  // Preferred path: abbreviation-accurate games, so cards can filter props.
  if (todayGames.length > 0) {
    return todayGames.map((game) => {
      const awaySlug = game.awayTeam.toLowerCase()
      const homeSlug = game.homeTeam.toLowerCase()
      const pair = scoreByPair.get(`${awaySlug}-${homeSlug}`)
      return {
        id: `${game.homeTeam}-${game.awayTeam}`,
        matchupKey: `${game.homeTeam}-${game.awayTeam}`,
        awayAbbr: game.awayTeam.toUpperCase(),
        homeAbbr: game.homeTeam.toUpperCase(),
        awayLogo: logoBySlug.get(awaySlug) ?? null,
        homeLogo: logoBySlug.get(homeSlug) ?? null,
        time: formatGameTime(game.gameTime) ?? "TBD",
        status: game.status,
        awayScore: pair?.away,
        homeScore: pair?.home,
      }
    })
  }

  // Fallback: schedule feed only. Displays fine, but isn't safe to filter on.
  return games.map((game) => ({
    id: game.id,
    matchupKey: null,
    awayAbbr: abbreviate(game.awayTeam),
    homeAbbr: abbreviate(game.homeTeam),
    awayLogo: game.awayLogo ?? null,
    homeLogo: game.homeLogo ?? null,
    time: formatGameTime(game.gameTime) ?? "TBD",
    status: normalizeStatus(game.status),
    awayScore: game.awayScore,
    homeScore: game.homeScore,
  }))
}

function TeamMark({ logo, abbr }: { logo: string | null; abbr: string }) {
  if (logo) {
    // Logos come from several ESPN CDN hosts and are tiny; a plain img keeps
    // the strip cheap to render while scrolling.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className="w-6 h-6 object-contain shrink-0" />
  }
  return (
    <span className="w-6 h-6 shrink-0 rounded-md bg-white/10 text-[8px] font-bold text-white/60 flex items-center justify-center">
      {abbr.slice(0, 3)}
    </span>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GameStrip({
  games,
  todayGames = [],
  loading,
  selectedDate,
  todayIso,
  selectedMatchup = null,
  onSelectMatchup,
}: GameStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const items = useMemo(() => buildItems(games, todayGames), [games, todayGames])

  const dayLabel = useMemo(() => {
    const day = buildDayWindow(selectedDate, todayIso, 0)[0]
    return (day.relativeLabel ?? `${day.dayName}, ${day.monthDay}`).toUpperCase()
  }, [selectedDate, todayIso])

  const updateScrollAffordances = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateScrollAffordances()
    const el = scrollerRef.current
    if (!el) return
    const observer = new ResizeObserver(updateScrollAffordances)
    observer.observe(el)
    return () => observer.disconnect()
  }, [items.length, updateScrollAffordances])

  const scrollBy = (direction: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" })
  }

  return (
    <section className="flex flex-col gap-2.5" aria-label="Games">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
          suppressHydrationWarning
        >
          {dayLabel}
        </h2>
        {selectedMatchup && onSelectMatchup && (
          <button
            type="button"
            onClick={() => onSelectMatchup(null)}
            className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-lime)] hover:underline"
          >
            Clear game filter
          </button>
        )}
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          onScroll={updateScrollAffordances}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-1"
        >
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[72px] w-[190px] shrink-0 animate-pulse rounded-xl bg-white/5" />
            ))
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-[72px] w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40">
              <p className="text-sm text-[var(--color-text-muted)]">No games scheduled</p>
            </div>
          ) : (
            items.map((item) => {
              const isSelected = !!item.matchupKey && item.matchupKey === selectedMatchup
              const selectable = !!item.matchupKey && !!onSelectMatchup

              const content = (
                <>
                  <div className="flex items-center justify-center gap-2 w-full">
                    <TeamMark logo={item.awayLogo} abbr={item.awayAbbr} />
                    <span className="text-[11px] font-bold text-[var(--color-text-primary)]">
                      {item.awayAbbr}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">@</span>
                    <span className="text-[11px] font-bold text-[var(--color-text-primary)]">
                      {item.homeAbbr}
                    </span>
                    <TeamMark logo={item.homeLogo} abbr={item.homeAbbr} />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-semibold",
                      item.status === "live"
                        ? "text-[var(--color-lime)]"
                        : "text-[var(--color-text-muted)]"
                    )}
                    suppressHydrationWarning
                  >
                    {item.status === "live"
                      ? "LIVE"
                      : item.status === "final"
                        ? item.awayScore != null && item.homeScore != null
                          ? `FINAL ${item.awayScore}-${item.homeScore}`
                          : "FINAL"
                        : item.time}
                  </span>
                </>
              )

              const baseClass = cn(
                "shrink-0 flex flex-col items-center justify-center gap-1.5 min-w-[190px] h-[72px] px-4 rounded-xl border transition-colors",
                isSelected
                  ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10"
                  : "border-[var(--color-border)] bg-[var(--color-surface)]/70",
                selectable && !isSelected && "hover:border-[var(--color-lime)]/40"
              )

              if (!selectable) {
                return (
                  <div key={item.id} className={baseClass}>
                    {content}
                  </div>
                )
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectMatchup?.(isSelected ? null : item.matchupKey)}
                  aria-pressed={isSelected}
                  aria-label={`${item.awayAbbr} at ${item.homeAbbr}${isSelected ? ", filtering props" : ", filter props to this game"}`}
                  className={baseClass}
                >
                  {content}
                </button>
              )
            })
          )}
        </div>

        {/* Edge scroll affordances */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll games left"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-8 h-8 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Scroll games right"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-8 h-8 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </section>
  )
}
