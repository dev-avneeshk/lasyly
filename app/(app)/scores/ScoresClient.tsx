"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Radio, Trophy, Clock, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LiveMatch } from "@/types"
import MatchDetailModal from "@/components/scores/MatchDetailModal"

// ─── Constants ───────────────────────────────────────────────────────────────

const SPORT_CATEGORIES = [
  { id: "popular", label: "All", emoji: "🔥" },
  { id: "live", label: "Live", emoji: "🔴" },
  { id: "Football", label: "Soccer", emoji: "⚽" },
  { id: "Basketball", label: "Basketball", emoji: "🏀" },
  { id: "American Football", label: "Football", emoji: "🏈" },
  { id: "Tennis", label: "Tennis", emoji: "🎾" },
  { id: "Hockey", label: "Hockey", emoji: "🏒" },
  { id: "Baseball", label: "Baseball", emoji: "⚾" },
  { id: "F1", label: "F1", emoji: "🏎️" },
  { id: "MMA", label: "MMA", emoji: "🥊" },
  { id: "Golf", label: "Golf", emoji: "⛳" },
  { id: "Cricket", label: "Cricket", emoji: "🏏" },
]

type MatchTab = "all" | "live" | "upcoming" | "finished"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isLiveStatus(status: string): boolean {
  return (
    status === "In Progress" ||
    status === "Halftime" ||
    status === "First Half" ||
    status === "Second Half" ||
    status === "Q1" ||
    status === "Q2" ||
    status === "Q3" ||
    status === "Q4" ||
    status === "OT"
  )
}

function formatYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
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
  const [activeTab, setActiveTab] = useState<MatchTab>("all")
  const [selectedDate, setSelectedDate] = useState(initialDate)

  // Initial scores come straight from the server render — no loading flash.
  const [scores, setScores] = useState<LiveMatch[]>(initialScores)
  const [scoresLoading, setScoresLoading] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null)

  const weekDays = useMemo(() => getWeekDays(), [])

  // Server renders with UTC's "today"; client uses local time. On the
  // day-boundary edge case, sync to the user's local today after mount.
  useEffect(() => {
    const localToday = formatYYYYMMDD(new Date())
    if (localToday !== initialDate && selectedDate === initialDate) {
      setSelectedDate(localToday)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Fetch Scores ──────────────────────────────────────────────────────────

  const fetchScores = useCallback(async (date: string, signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/scores?date=${date}`, { signal })
      const json = await res.json()
      if (json.success) {
        setScores(json.data)
      }
    } catch {
      // silently fail; AbortError is also caught here
    }
  }, [])

  // Refetch when the selected date changes, but skip the very first render
  // since server already provided initialScores for initialDate.
  useEffect(() => {
    if (selectedDate === initialDate && scores === initialScores) {
      // server-rendered branch; nothing to do
      return
    }

    const ctrl = new AbortController()
    setScoresLoading(true)
    fetchScores(selectedDate, ctrl.signal).finally(() => setScoresLoading(false))
    return () => ctrl.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, fetchScores])

  // 15s polling, only while viewing today.
  useEffect(() => {
    const todayStr = formatYYYYMMDD(new Date())
    if (selectedDate !== todayStr) return

    const interval = setInterval(() => {
      fetchScores(selectedDate)
    }, 15000)
    return () => clearInterval(interval)
  }, [selectedDate, fetchScores])

  // ─── Filtered Matches ──────────────────────────────────────────────────────

  const filteredMatches = useMemo(() => {
    let filtered = scores

    if (activeSport === "live") {
      filtered = filtered.filter((m) => isLiveStatus(m.status))
    } else if (activeSport !== "popular") {
      filtered = filtered.filter((m) => m.sport === activeSport)
    }

    if (activeTab === "live") {
      filtered = filtered.filter((m) => isLiveStatus(m.status))
    } else if (activeTab === "upcoming") {
      filtered = filtered.filter((m) => m.status === "Not Started")
    } else if (activeTab === "finished") {
      filtered = filtered.filter((m) => m.status === "Finished")
    }

    return filtered
  }, [scores, activeSport, activeTab])

  const sportFilteredScores = useMemo(() => {
    if (activeSport === "live") {
      return scores.filter((m) => isLiveStatus(m.status))
    } else if (activeSport !== "popular") {
      return scores.filter((m) => m.sport === activeSport)
    }
    return scores
  }, [scores, activeSport])

  const liveCount = sportFilteredScores.filter((m) => isLiveStatus(m.status)).length
  const upcomingCount = sportFilteredScores.filter((m) => m.status === "Not Started").length
  const finishedCount = sportFilteredScores.filter((m) => m.status === "Finished").length

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Sport Categories Scroller */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
        {SPORT_CATEGORIES.map((sport) => (
          <button
            key={sport.id}
            onClick={() => setActiveSport(sport.id)}
            className={cn(
              "flex items-center gap-2 min-w-fit py-2.5 px-4 rounded-full transition-all text-sm font-semibold",
              activeSport === sport.id
                ? "bg-[var(--color-lime)] text-black shadow-lg shadow-[var(--color-lime)]/20"
                : "bg-white/[0.05] text-white/60 hover:bg-white/[0.08] hover:text-white"
            )}
          >
            <span>{sport.emoji}</span>
            <span>{sport.label}</span>
          </button>
        ))}
      </div>

      {/* Date Picker + Status Tabs Row */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Date Picker */}
        <div className="flex items-center gap-1 bg-[var(--color-surface)] rounded-xl p-1.5 border border-white/5">
          {weekDays.map((d) => (
            <button
              key={d.fullDate}
              onClick={() => setSelectedDate(d.fullDate)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-all",
                selectedDate === d.fullDate
                  ? "bg-[var(--color-lime)] text-black"
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              )}
            >
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider",
                selectedDate === d.fullDate ? "text-black/70" : ""
              )}>{d.day}</span>
              <span className={cn(
                "text-base font-black",
                selectedDate === d.fullDate ? "text-black" : "text-white"
              )}>
                {d.date}
              </span>
            </button>
          ))}
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-[var(--color-surface)] border border-white/5 p-1.5 flex-1">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold transition-all",
              activeTab === "all" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
            )}
          >
            <span>All</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 font-black">{scores.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("live")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold transition-all",
              activeTab === "live"
                ? "bg-[#25d65f]/20 text-[#25d65f]"
                : "text-white/40 hover:text-white/70"
            )}
          >
            <Radio className="h-3 w-3" />
            <span>Live</span>
            {liveCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#25d65f]/20 font-black text-[#25d65f]">{liveCount}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("upcoming")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold transition-all",
              activeTab === "upcoming" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
            )}
          >
            <Clock className="h-3 w-3" />
            <span>Upcoming</span>
            {upcomingCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 font-black">{upcomingCount}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("finished")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold transition-all",
              activeTab === "finished" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
            )}
          >
            <CheckCircle className="h-3 w-3" />
            <span>Done</span>
            {finishedCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 font-black">{finishedCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Match Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {scoresLoading && scores.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-2xl bg-white/[0.03] border border-white/5" />
          ))
        ) : filteredMatches.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-white/5 bg-white/[0.02] p-10 text-center">
            <Trophy className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-sm font-medium text-white/50">No matches found</p>
            <p className="text-xs text-white/30 mt-1">
              {activeSport !== "popular" ? "Try selecting \"All\" sports or a different date" : "Try a different date"}
            </p>
          </div>
        ) : (
          filteredMatches.map((match) => (
            <MatchCard key={match.id} match={match} onSelect={() => setSelectedMatch(match)} />
          ))
        )}
      </div>

      {/* Match Detail Modal */}
      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  )
}

// ─── Sports that allow draws ─────────────────────────────────────────────────

const DRAW_SPORTS = new Set(["Football", "Hockey", "Cricket"])

// ─── 1X2 Vote Storage (localStorage-backed) ─────────────────────────────────

function getMatchVotes(matchId: string): { "1": number; X: number; "2": number } {
  if (typeof window === "undefined") return { "1": 0, X: 0, "2": 0 }
  try {
    const stored = localStorage.getItem(`match-votes:${matchId}`)
    if (stored) return JSON.parse(stored)
  } catch {}
  return { "1": 0, X: 0, "2": 0 }
}

function saveMatchVote(matchId: string, choice: "1" | "X" | "2") {
  if (typeof window === "undefined") return
  const key = `match-vote-choice:${matchId}`
  const prevChoice = localStorage.getItem(key) as "1" | "X" | "2" | null
  const votes = getMatchVotes(matchId)

  if (prevChoice && prevChoice !== choice) {
    votes[prevChoice] = Math.max(0, votes[prevChoice] - 1)
  }
  if (prevChoice !== choice) {
    votes[choice] += 1
  }

  localStorage.setItem(`match-votes:${matchId}`, JSON.stringify(votes))
  localStorage.setItem(key, choice)
}

function getUserVote(matchId: string): "1" | "X" | "2" | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(`match-vote-choice:${matchId}`) as "1" | "X" | "2" | null
}

// ─── Match Card with 1X2 Voting ─────────────────────────────────────────────

function MatchCard({ match, onSelect }: { match: LiveMatch; onSelect: () => void }) {
  const live = isLiveStatus(match.status)
  const finished = match.status === "Finished"
  const allowDraw = DRAW_SPORTS.has(match.sport)

  const [userVote, setUserVote] = useState<"1" | "X" | "2" | null>(null)
  const [votes, setVotes] = useState<{ "1": number; X: number; "2": number }>({ "1": 0, X: 0, "2": 0 })

  useEffect(() => {
    setUserVote(getUserVote(match.id))
    setVotes(getMatchVotes(match.id))
  }, [match.id])

  const handleVote = (choice: "1" | "X" | "2") => {
    if (finished) return
    saveMatchVote(match.id, choice)
    setUserVote(choice)
    setVotes(getMatchVotes(match.id))
  }

  const totalVotes = votes["1"] + votes.X + votes["2"]
  const pct1 = totalVotes > 0 ? Math.round((votes["1"] / totalVotes) * 100) : 0
  const pctX = allowDraw && totalVotes > 0 ? Math.round((votes.X / totalVotes) * 100) : 0
  const pct2 = totalVotes > 0 ? 100 - pct1 - pctX : 0

  return (
    <div
      className={cn(
        "rounded-2xl p-4 border transition-all",
        live
          ? "bg-gradient-to-r from-[#25d65f]/[0.04] to-transparent border-[#25d65f]/20 hover:border-[#25d65f]/40"
          : finished
          ? "bg-[var(--color-surface)] border-white/[0.06] hover:border-white/15"
          : "bg-[var(--color-surface)] border-white/[0.06] hover:border-[var(--color-lime)]/20"
      )}
    >
      {/* Clickable area for match detail */}
      <div onClick={onSelect} className="cursor-pointer">
        {/* League + Status Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-white/50 uppercase truncate">{match.league}</span>
          <div className="flex items-center gap-1.5">
            {live && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-[#25d65f] animate-pulse" />
                <span className="text-[10px] font-bold text-[#25d65f]">{match.clock || "LIVE"}</span>
              </>
            )}
            {finished && (
              <span className="text-[10px] font-bold text-white/30 bg-white/5 rounded-full px-2 py-0.5">FT</span>
            )}
            {match.status === "Not Started" && (
              <span className="text-[10px] font-medium text-white/40">
                {match.clock || (match.startTime ? new Date(match.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Scheduled")}
              </span>
            )}
          </div>
        </div>

        {/* Teams + Score */}
        <div className="space-y-2">
          {/* Home Team */}
          <div className="flex items-center gap-2.5">
            {match.homeLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.homeLogo} alt="" className="w-6 h-6 object-contain shrink-0" loading="lazy" decoding="async" />
            ) : (
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[8px] font-bold text-white/50 shrink-0">
                {match.homeTeam.slice(0, 3)}
              </div>
            )}
            <span className={cn(
              "flex-1 text-sm font-semibold truncate",
              finished && match.homeScore > match.awayScore ? "text-white" : "text-white/80"
            )}>
              {match.homeTeam}
            </span>
            <span className={cn(
              "text-lg font-black tabular-nums min-w-[24px] text-right",
              live ? "text-white" : finished ? (match.homeScore > match.awayScore ? "text-white" : "text-white/50") : "text-white/30"
            )}>
              {match.status === "Not Started" ? "-" : match.homeScore}
            </span>
          </div>

          {/* Away Team */}
          <div className="flex items-center gap-2.5">
            {match.awayLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.awayLogo} alt="" className="w-6 h-6 object-contain shrink-0" loading="lazy" decoding="async" />
            ) : (
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[8px] font-bold text-white/50 shrink-0">
                {match.awayTeam.slice(0, 3)}
              </div>
            )}
            <span className={cn(
              "flex-1 text-sm font-semibold truncate",
              finished && match.awayScore > match.homeScore ? "text-white" : "text-white/80"
            )}>
              {match.awayTeam}
            </span>
            <span className={cn(
              "text-lg font-black tabular-nums min-w-[24px] text-right",
              live ? "text-white" : finished ? (match.awayScore > match.homeScore ? "text-white" : "text-white/50") : "text-white/30"
            )}>
              {match.status === "Not Started" ? "-" : match.awayScore}
            </span>
          </div>
        </div>
      </div>

      {/* 1X2 Voting Section */}
      <div className="mt-3 pt-3 border-t border-white/5">
        {totalVotes > 0 && (
          <div className="flex h-1 rounded-full overflow-hidden mb-2 bg-white/5">
            <div className="bg-[var(--color-lime)] transition-all duration-300" style={{ width: `${pct1}%` }} />
            {allowDraw && <div className="bg-white/30 transition-all duration-300" style={{ width: `${pctX}%` }} />}
            <div className="bg-[var(--color-danger)] transition-all duration-300" style={{ width: `${pct2}%` }} />
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); handleVote("1") }}
            disabled={finished}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border transition-all",
              finished
                ? "bg-white/[0.02] border-white/[0.04] cursor-not-allowed opacity-40"
                : userVote === "1"
                ? "bg-[var(--color-lime)]/10 border-[var(--color-lime)]/40"
                : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
            )}
          >
            <span className={cn("text-[11px] font-black", finished ? "text-white/30" : userVote === "1" ? "text-[var(--color-lime)]" : "text-white/60")}>1</span>
            <span className={cn("text-[10px] font-bold", finished ? "text-white/20" : userVote === "1" ? "text-[var(--color-lime)]/70" : "text-white/30")}>{totalVotes > 0 ? `${pct1}%` : "—"}</span>
          </button>

          {allowDraw && (
            <button
              onClick={(e) => { e.stopPropagation(); handleVote("X") }}
              disabled={finished}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border transition-all",
                finished
                  ? "bg-white/[0.02] border-white/[0.04] cursor-not-allowed opacity-40"
                  : userVote === "X"
                  ? "bg-white/10 border-white/30"
                  : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
              )}
            >
              <span className={cn("text-[11px] font-black", finished ? "text-white/30" : userVote === "X" ? "text-white" : "text-white/60")}>X</span>
              <span className={cn("text-[10px] font-bold", finished ? "text-white/20" : userVote === "X" ? "text-white/70" : "text-white/30")}>{totalVotes > 0 ? `${pctX}%` : "—"}</span>
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); handleVote("2") }}
            disabled={finished}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border transition-all",
              finished
                ? "bg-white/[0.02] border-white/[0.04] cursor-not-allowed opacity-40"
                : userVote === "2"
                ? "bg-[var(--color-danger)]/10 border-[var(--color-danger)]/40"
                : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
            )}
          >
            <span className={cn("text-[11px] font-black", finished ? "text-white/30" : userVote === "2" ? "text-[var(--color-danger)]" : "text-white/60")}>2</span>
            <span className={cn("text-[10px] font-bold", finished ? "text-white/20" : userVote === "2" ? "text-[var(--color-danger)]/70" : "text-white/30")}>{totalVotes > 0 ? `${pct2}%` : "—"}</span>
          </button>
        </div>

        {finished && <p className="text-[8px] text-white/20 text-center mt-1 font-medium uppercase tracking-wider">Voting closed</p>}
      </div>
    </div>
  )
}
