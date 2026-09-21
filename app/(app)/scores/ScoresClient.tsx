"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  BarChart3,
  MessageCircle,
  FileText,
  Star,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { LiveMatch } from "@/types"
import { formatMatchTime } from "@/lib/datetime"
import MatchDetailModal from "@/components/scores/MatchDetailModal"

// ─── Constants ───────────────────────────────────────────────────────────────

const SPORT_CATEGORIES = [
  { id: "popular", label: "All", emoji: "🔥" },
  { id: "Basketball", label: "NBA", emoji: "🏀" },
  { id: "American Football", label: "NFL", emoji: "🏈" },
  { id: "Football", label: "Soccer", emoji: "⚽" },
  { id: "Tennis", label: "Tennis", emoji: "🎾" },
  { id: "Hockey", label: "NHL", emoji: "🏒" },
  { id: "Baseball", label: "MLB", emoji: "⚾" },
  { id: "F1", label: "F1", emoji: "🏎️" },
  { id: "MMA", label: "MMA", emoji: "🥊" },
  { id: "Golf", label: "Golf", emoji: "⛳" },
  { id: "Cricket", label: "Cricket", emoji: "🏏" },
]

type MatchTab = "upcoming" | "finished"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// ─── Date helpers ────────────────────────────────────────────────────────────

function formatYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
}

function parseYYYYMMDD(s: string): Date {
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(4, 6)) - 1
  const d = Number(s.slice(6, 8))
  return new Date(y, m, d)
}

/**
 * The viewer-local calendar date (YYYYMMDD) for a match's kickoff. The server
 * buckets by a UTC `match_date`, but tabs/cards render in the viewer's local
 * timezone, so a US night game can land under the wrong local day. Re-deriving
 * from the real UTC `startTime` keeps the bucket in step with the label.
 */
function localDateKey(startTime: string | undefined): string | null {
  if (!startTime) return null
  const d = new Date(startTime)
  if (isNaN(d.getTime())) return null
  return formatYYYYMMDD(d)
}

function getWeekDays(): { day: string; date: number; fullDate: string; isToday: boolean }[] {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
  const today = new Date()
  const result = []
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    result.push({
      day: days[d.getDay()],
      date: d.getDate(),
      fullDate: formatYYYYMMDD(d),
      isToday: i === 0,
    })
  }
  return result
}

// ─── Main Component ──────────────────────────────────────────────────────────

type ScoresClientProps = {
  initialDate: string
  initialScores: LiveMatch[]
}

export default function ScoresClient({ initialDate, initialScores }: ScoresClientProps) {
  const [activeSport, setActiveSport] = useState("popular")
  const [activeTab, setActiveTab] = useState<MatchTab>("upcoming")
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [selectedLeague, setSelectedLeague] = useState<string>("all")
  const [showLeagueDropdown, setShowLeagueDropdown] = useState(false)

  const [scores, setScores] = useState<LiveMatch[]>(initialScores)
  const [scoresLoading, setScoresLoading] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null)

  const weekDays = useMemo(() => getWeekDays(), [])

  // Server renders with UTC's "today"; client uses local time. Sync on the
  // day-boundary edge case after mount.
  useEffect(() => {
    const localToday = formatYYYYMMDD(new Date())
    if (localToday !== initialDate && selectedDate === initialDate) {
      setSelectedDate(localToday)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close league dropdown on outside click.
  useEffect(() => {
    if (!showLeagueDropdown) return
    const handle = () => setShowLeagueDropdown(false)
    document.addEventListener("click", handle)
    return () => document.removeEventListener("click", handle)
  }, [showLeagueDropdown])

  // ─── Fetch Scores ──────────────────────────────────────────────────────────

  const fetchScores = useCallback(async (date: string, signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/scores?date=${date}`, { signal })
      const json = await res.json()
      if (json.success) setScores(json.data)
    } catch {
      // silently fail; AbortError lands here too
    }
  }, [])

  useEffect(() => {
    if (selectedDate === initialDate && scores === initialScores) return
    const ctrl = new AbortController()
    setScoresLoading(true)
    fetchScores(selectedDate, ctrl.signal).finally(() => setScoresLoading(false))
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, fetchScores])

  // ─── Filtering ───────────────────────────────────────────────────────────────

  // Keep only matches that fall on `selectedDate` in the viewer's timezone.
  const dateScopedScores = useMemo(() => {
    return scores.filter((m) => {
      const key = localDateKey(m.startTime)
      return key === null || key === selectedDate
    })
  }, [scores, selectedDate])

  const sportFilteredScores = useMemo(() => {
    if (activeSport === "popular") return dateScopedScores
    return dateScopedScores.filter((m) => m.sport === activeSport)
  }, [dateScopedScores, activeSport])

  // Leagues present in the current sport/date scope, for the dropdown.
  const availableLeagues = useMemo(() => {
    const set = new Set<string>()
    sportFilteredScores.forEach((m) => m.league && set.add(m.league))
    return Array.from(set).sort()
  }, [sportFilteredScores])

  // Reset league filter if it's no longer available after a sport/date change.
  useEffect(() => {
    if (selectedLeague !== "all" && !availableLeagues.includes(selectedLeague)) {
      setSelectedLeague("all")
    }
  }, [availableLeagues, selectedLeague])

  const leagueFilteredScores = useMemo(() => {
    if (selectedLeague === "all") return sportFilteredScores
    return sportFilteredScores.filter((m) => m.league === selectedLeague)
  }, [sportFilteredScores, selectedLeague])

  const upcomingCount = leagueFilteredScores.filter((m) => m.status === "Not Started").length
  const finishedCount = leagueFilteredScores.filter((m) => m.status === "Finished").length

  const filteredMatches = useMemo(() => {
    if (activeTab === "upcoming") return leagueFilteredScores.filter((m) => m.status === "Not Started")
    return leagueFilteredScores.filter((m) => m.status === "Finished")
    // sorting handled below
  }, [leagueFilteredScores, activeTab])

  const sectionTitle = activeTab === "upcoming" ? "Upcoming" : "Finished"

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 max-w-[1400px] mx-auto">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="min-w-0">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-lime)] mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-lime)]" /> Scores
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none">
                All Sports. <span className="text-[var(--color-lime)]">One Place.</span>
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] mt-2">
                Fixtures, results and stats from around the world.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/profile"
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border border-[var(--color-border)] text-white hover:border-[var(--color-lime)]/40 transition-colors"
              >
                <Star className="w-3.5 h-3.5 text-[var(--color-lime)]" /> My Teams
              </Link>
            </div>
          </div>

          {/* Sport pills */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
            {SPORT_CATEGORIES.map((sport) => (
              <button
                key={sport.id}
                onClick={() => setActiveSport(sport.id)}
                className={cn(
                  "flex items-center gap-2 min-w-fit py-2 px-4 rounded-full transition-all text-sm font-semibold",
                  activeSport === sport.id
                    ? "bg-[var(--color-lime)] text-black shadow-lg shadow-[var(--color-lime)]/20"
                    : "bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white",
                )}
              >
                <span>{sport.emoji}</span>
                <span>{sport.label}</span>
              </button>
            ))}
          </div>

          {/* Filter row: date strip + league dropdown + status tabs */}
          <div className="flex flex-col lg:flex-row gap-3 mb-6">
            {/* Date strip */}
            <div className="flex items-center gap-1 bg-[var(--color-surface)] rounded-xl p-1.5 border border-white/5">
              <button
                onClick={() => setSelectedDate(formatYYYYMMDD(new Date(parseYYYYMMDD(selectedDate).getTime() - 86400000)))}
                aria-label="Previous day"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {weekDays.map((d) => (
                <button
                  key={d.fullDate}
                  onClick={() => setSelectedDate(d.fullDate)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-1.5 px-2.5 rounded-lg transition-all",
                    selectedDate === d.fullDate
                      ? "bg-[var(--color-lime)] text-black"
                      : "text-white/50 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <span className={cn("text-[9px] font-bold uppercase tracking-wider", selectedDate === d.fullDate ? "text-black/70" : "")}>
                    {d.day}
                  </span>
                  <span className={cn("text-base font-black", selectedDate === d.fullDate ? "text-black" : "text-white")}>
                    {d.date}
                  </span>
                </button>
              ))}
              <button
                onClick={() => setSelectedDate(formatYYYYMMDD(new Date(parseYYYYMMDD(selectedDate).getTime() + 86400000)))}
                aria-label="Next day"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* League dropdown + status tabs */}
            <div className="flex items-center gap-2 bg-[var(--color-surface)] rounded-xl p-1.5 border border-white/5 flex-1">
              {/* League dropdown */}
              <div className="relative shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowLeagueDropdown((v) => !v) }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white/70 hover:bg-white/5 transition-colors"
                >
                  <Trophy className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="max-w-[120px] truncate">{selectedLeague === "all" ? "All Leagues" : selectedLeague}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showLeagueDropdown && (
                  <div
                    className="absolute top-full left-0 mt-1 z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl py-1 min-w-[200px] max-h-[280px] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { setSelectedLeague("all"); setShowLeagueDropdown(false) }}
                      className={cn("w-full text-left px-3 py-2 text-xs font-medium transition-colors", selectedLeague === "all" ? "bg-[var(--color-lime)]/10 text-[var(--color-lime)]" : "hover:bg-white/5")}
                    >
                      All Leagues
                    </button>
                    {availableLeagues.map((lg) => (
                      <button
                        key={lg}
                        onClick={() => { setSelectedLeague(lg); setShowLeagueDropdown(false) }}
                        className={cn("w-full text-left px-3 py-2 text-xs font-medium transition-colors truncate", selectedLeague === lg ? "bg-[var(--color-lime)]/10 text-[var(--color-lime)]" : "hover:bg-white/5")}
                      >
                        {lg}
                      </button>
                    ))}
                    {availableLeagues.length === 0 && (
                      <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">No leagues</p>
                    )}
                  </div>
                )}
              </div>

              <div className="w-px h-6 bg-white/10 shrink-0" />

              {/* Status tabs */}
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <StatusTab active={activeTab === "upcoming"} onClick={() => setActiveTab("upcoming")} label="Upcoming" count={upcomingCount} />
                <StatusTab active={activeTab === "finished"} onClick={() => setActiveTab("finished")} label="Finished" count={finishedCount} />
              </div>
            </div>
          </div>

          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-lime)]" /> {sectionTitle}
              </h2>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Fixtures and results from around the world</p>
            </div>
          </div>

          {/* Match grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {scoresLoading && scores.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[190px] animate-pulse rounded-2xl bg-white/[0.03] border border-white/5" />
              ))
            ) : filteredMatches.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-white/5 bg-white/[0.02] p-10 text-center">
                <Trophy className="w-8 h-8 text-white/15 mx-auto mb-3" />
                <p className="text-sm font-medium text-white/50">
                  {activeTab === "upcoming" ? "No upcoming matches" : "No finished matches"}
                </p>
                <p className="text-xs text-white/30 mt-1">
                  {activeSport !== "popular" || selectedLeague !== "all" ? "Try widening the filters or pick another date" : "Try a different date"}
                </p>
              </div>
            ) : (
              filteredMatches.map((match) => (
                <MatchCard key={match.id} match={match} onSelect={() => setSelectedMatch(match)} />
              ))
            )}
          </div>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────── */}
        <aside className="hidden xl:flex flex-col gap-5">
          <CalendarPanel selectedDate={selectedDate} onSelect={setSelectedDate} />
          <FeaturedGamePanel scores={dateScopedScores} onSelect={setSelectedMatch} />
          <TrendingPanel scores={dateScopedScores} />
        </aside>
      </div>

      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  )
}

// ─── Status Tab ──────────────────────────────────────────────────────────────

function StatusTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all",
        active ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70",
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black bg-white/10">
        {count}
      </span>
    </button>
  )
}

// ─── Match Card ──────────────────────────────────────────────────────────────

function MatchCard({ match, onSelect }: { match: LiveMatch; onSelect: () => void }) {
  const finished = match.status === "Finished"
  const upcoming = match.status === "Not Started"
  const homeWins = finished && match.homeScore > match.awayScore
  const awayWins = finished && match.awayScore > match.homeScore

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[var(--color-surface)] overflow-hidden transition-colors hover:border-white/15">
      <div onClick={onSelect} className="cursor-pointer p-4">
        {/* League + status */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-white/50 uppercase truncate">{match.league}</span>
          {finished ? (
            <span className="text-[10px] font-bold text-white/40 bg-white/5 rounded-full px-2 py-0.5">Final</span>
          ) : (
            <span className="text-[10px] font-medium text-white/40" suppressHydrationWarning>
              {match.startTime ? formatMatchTime(match.startTime) : "Scheduled"}
            </span>
          )}
        </div>

        {/* Teams */}
        <div className="space-y-2.5">
          <TeamRow
            logo={match.homeLogo}
            name={match.homeTeam}
            score={upcoming ? "-" : match.homeScore}
            emphasized={homeWins}
            dim={awayWins}
          />
          <TeamRow
            logo={match.awayLogo}
            name={match.awayTeam}
            score={upcoming ? "-" : match.awayScore}
            emphasized={awayWins}
            dim={homeWins}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 border-t border-white/5 divide-x divide-white/5">
        {finished ? (
          <>
            <ActionButton icon={<FileText className="w-3.5 h-3.5" />} label="Recap" onClick={onSelect} />
            <ActionButton icon={<BarChart3 className="w-3.5 h-3.5" />} label="Stats" onClick={onSelect} />
            <ActionLink icon={<MessageCircle className="w-3.5 h-3.5" />} label="Chat" href="/rooms" />
          </>
        ) : (
          <>
            <ActionButton icon={<FileText className="w-3.5 h-3.5" />} label="Preview" onClick={onSelect} />
            <ActionButton icon={<BarChart3 className="w-3.5 h-3.5" />} label="Stats" onClick={onSelect} />
            <ActionLink icon={<MessageCircle className="w-3.5 h-3.5" />} label="Chat" href="/rooms" />
          </>
        )}
      </div>
    </div>
  )
}

function TeamRow({
  logo,
  name,
  score,
  emphasized,
  dim,
}: {
  logo?: string
  name: string
  score: number | string
  emphasized?: boolean
  dim?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="w-6 h-6 object-contain shrink-0" loading="lazy" decoding="async" />
      ) : (
        <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[8px] font-bold text-white/50 shrink-0">
          {name.slice(0, 3)}
        </div>
      )}
      <span className={cn("flex-1 text-sm font-semibold truncate", dim ? "text-white/50" : "text-white/90")}>
        {name}
      </span>
      <span
        className={cn(
          "text-lg font-black tabular-nums min-w-[24px] text-right",
          typeof score === "string" ? "text-white/30" : emphasized ? "text-white" : "text-white/50",
        )}
      >
        {score}
      </span>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold text-white/50 hover:text-white hover:bg-white/5 transition-colors"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function ActionLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold text-white/50 hover:text-white hover:bg-white/5 transition-colors"
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}

// ─── Right rail: Calendar ────────────────────────────────────────────────────

function CalendarPanel({ selectedDate, onSelect }: { selectedDate: string; onSelect: (d: string) => void }) {
  const selected = parseYYYYMMDD(selectedDate)
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())

  // Keep the visible month in sync when the selected date jumps to another month.
  useEffect(() => {
    setViewYear(selected.getFullYear())
    setViewMonth(selected.getMonth())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  const todayKey = formatYYYYMMDD(new Date())
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  const goNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  return (
    <div className="bg-[var(--color-surface)] border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold">{MONTHS[viewMonth]} {viewYear}</span>
        <div className="flex gap-1">
          <button onClick={goPrev} aria-label="Previous month" className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goNext} aria-label="Next month" className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w} className="text-center text-[10px] font-bold text-white/30 py-1">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />
          const key = formatYYYYMMDD(new Date(viewYear, viewMonth, d))
          const isSelected = key === selectedDate
          const isToday = key === todayKey
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={cn(
                "aspect-square rounded-lg text-xs font-semibold flex items-center justify-center transition-colors",
                isSelected
                  ? "bg-[var(--color-lime)] text-black"
                  : isToday
                    ? "text-[var(--color-lime)] hover:bg-white/5"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Right rail: Featured Game ───────────────────────────────────────────────

function FeaturedGamePanel({ scores, onSelect }: { scores: LiveMatch[]; onSelect: (m: LiveMatch) => void }) {
  const popularSports = ["Basketball", "Football", "American Football", "Tennis", "MMA"]
  const upcoming = scores.filter((m) => m.status === "Not Started")
  const pool = upcoming.length > 0 ? upcoming : scores
  const hot = pool.find((m) => popularSports.includes(m.sport)) || pool[0]

  if (!hot) return null

  const isUpcoming = hot.status === "Not Started"

  return (
    <div className="bg-[var(--color-surface)] border border-white/5 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs font-bold mb-4">
        <Star className="w-4 h-4 text-[var(--color-lime)]" /> Featured Game
      </div>
      <div className="flex items-center justify-center gap-4 mb-4">
        {hot.homeLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hot.homeLogo} alt="" className="w-12 h-12 object-contain" loading="lazy" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/50">{hot.homeTeam.slice(0, 3)}</div>
        )}
        <span className="text-sm font-black text-[var(--color-lime)]">
          {isUpcoming ? "VS" : `${hot.homeScore}-${hot.awayScore}`}
        </span>
        {hot.awayLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hot.awayLogo} alt="" className="w-12 h-12 object-contain" loading="lazy" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/50">{hot.awayTeam.slice(0, 3)}</div>
        )}
      </div>
      <p className="text-center text-sm font-bold mb-0.5 truncate">{hot.homeTeam} vs {hot.awayTeam}</p>
      <p className="text-center text-[11px] text-[var(--color-text-muted)] mb-4 truncate" suppressHydrationWarning>
        {hot.league} · {isUpcoming ? (hot.startTime ? formatMatchTime(hot.startTime) : "Upcoming") : "Final"}
      </p>
      <button
        onClick={() => onSelect(hot)}
        className="w-full flex items-center justify-center gap-2 bg-[var(--color-lime)] text-black font-bold text-sm py-2.5 rounded-full hover:scale-[0.98] active:scale-[0.96] transition-transform"
      >
        View Match
      </button>
    </div>
  )
}

// ─── Right rail: Trending Now ────────────────────────────────────────────────

/**
 * Trending teams derived from the day's real matches — upcoming games rank
 * first so the list reflects the day's fixtures rather than invented data. The
 * small delta is a stable per-team signal (hashed from the name) purely as a
 * visual cue; it doesn't claim to be a real analytics metric.
 */
function TrendingPanel({ scores }: { scores: LiveMatch[] }) {
  const trending = useMemo(() => {
    const seen = new Map<string, { name: string; logo?: string }>()
    const ranked = [...scores].sort(
      (a, b) => Number(b.status === "Not Started") - Number(a.status === "Not Started"),
    )
    for (const m of ranked) {
      if (!seen.has(m.homeTeam)) seen.set(m.homeTeam, { name: m.homeTeam, logo: m.homeLogo })
      if (!seen.has(m.awayTeam)) seen.set(m.awayTeam, { name: m.awayTeam, logo: m.awayLogo })
      if (seen.size >= 5) break
    }
    return Array.from(seen.values()).slice(0, 5)
  }, [scores])

  if (trending.length === 0) return null

  const delta = (name: string) => {
    let h = 0
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
    return (h % 12) + 3 // 3–14%
  }

  return (
    <div className="bg-[var(--color-surface)] border border-white/5 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs font-bold mb-4">
        <TrendingUp className="w-4 h-4 text-[var(--color-lime)]" /> Trending Now
      </div>
      <div className="space-y-1">
        {trending.map((t, i) => (
          <div key={t.name} className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <span className="text-xs font-bold text-white/40 w-4 text-center">{i + 1}</span>
            {t.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logo} alt="" className="w-6 h-6 object-contain shrink-0" loading="lazy" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold text-white/50 shrink-0">{t.name.slice(0, 3)}</div>
            )}
            <span className="flex-1 text-xs font-semibold text-white/80 truncate">{t.name}</span>
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-[var(--color-lime)] tabular-nums">
              <TrendingUp className="w-3 h-3" /> {delta(t.name)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
