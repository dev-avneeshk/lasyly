"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Search, Trophy, Clock, History, Radio, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { LiveMatch } from "@/types"
import MatchDetailModal from "./MatchDetailModal"

// ─── Types ───────────────────────────────────────────────────────────────────

type ScoresTab = "live" | "completed" | "history"

type HistoryMatch = LiveMatch & { matchDate?: string }

const SCORE_SPORTS = [
  { id: "All", label: "All Sports", emoji: "◎" },
  { id: "Football", label: "Football", emoji: "⚽" },
  { id: "Basketball", label: "Basketball", emoji: "🏀" },
  { id: "American Football", label: "NFL", emoji: "🏈" },
  { id: "Hockey", label: "Hockey", emoji: "🏒" },
]

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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LiveScoresSection() {
  const [activeTab, setActiveTab] = useState<ScoresTab>("live")
  const [scoreSport, setScoreSport] = useState("All")
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null)

  // Live scores
  const [scores, setScores] = useState<LiveMatch[]>([])
  const [scoresLoading, setScoresLoading] = useState(true)

  // Search
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<HistoryMatch[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // History
  const [historyMatches, setHistoryMatches] = useState<HistoryMatch[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)

  // ─── Fetch Live Scores ───────────────────────────────────────────────────

  useEffect(() => {
    const fetchScores = async () => {
      try {
        const res = await fetch("/api/scores")
        const json = await res.json()
        if (json.success) {
          setScores(json.data)
        }
      } catch {
        // silently fail
      } finally {
        setScoresLoading(false)
      }
    }

    fetchScores()
    const interval = setInterval(fetchScores, 15000)
    return () => clearInterval(interval)
  }, [])

  // ─── Search ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    setSearchLoading(true)

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: searchQuery })
        if (scoreSport !== "All") params.set("sport", scoreSport)
        const res = await fetch(`/api/scores/search?${params.toString()}`)
        const json = await res.json()
        if (json.success) {
          setSearchResults(json.data)
        }
      } catch {
        // silently fail
      } finally {
        setSearchLoading(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [searchQuery, scoreSport])

  // ─── History ─────────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async (page: number, sport: string) => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "30",
      })
      if (sport !== "All") params.set("sport", sport)
      const res = await fetch(`/api/scores/history?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setHistoryMatches(json.data)
        setHistoryTotal(json.pagination?.total ?? 0)
      }
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory(historyPage, scoreSport)
    }
  }, [activeTab, historyPage, scoreSport, fetchHistory])

  // ─── Derived Data ────────────────────────────────────────────────────────

  const liveCount = scores.filter((m) => isLiveStatus(m.status)).length

  const filteredScores = useMemo(() => {
    const base = scoreSport === "All" ? scores : scores.filter((m) => m.sport === scoreSport)
    if (activeTab === "live") return base.filter((m) => m.status !== "Finished")
    if (activeTab === "completed") return base.filter((m) => m.status === "Finished")
    return base
  }, [scores, scoreSport, activeTab])

  const groupedByLeague = useMemo(() => {
    const source = isSearching ? searchResults : filteredScores
    return source.reduce<Record<string, (LiveMatch | HistoryMatch)[]>>((acc, match) => {
      const league = match.league || "Other"
      if (!acc[league]) acc[league] = []
      acc[league].push(match)
      return acc
    }, {})
  }, [filteredScores, searchResults, isSearching])

  const sortedLeagues = useMemo(() => {
    return Object.entries(groupedByLeague).sort(([, a], [, b]) => {
      const aLive = a.some((m) => isLiveStatus(m.status))
      const bLive = b.some((m) => isLiveStatus(m.status))
      if (aLive && !bLive) return -1
      if (!aLive && bLive) return 1
      return 0
    })
  }, [groupedByLeague])

  // For history tab, group by date
  const historyByDate = useMemo(() => {
    if (activeTab !== "history") return {}
    return historyMatches.reduce<Record<string, HistoryMatch[]>>((acc, match) => {
      const date = match.matchDate || "Unknown"
      if (!acc[date]) acc[date] = []
      acc[date].push(match)
      return acc
    }, {})
  }, [historyMatches, activeTab])

  const displayMatches = isSearching ? searchResults : (activeTab === "history" ? historyMatches : filteredScores)
  const isLoading = isSearching ? searchLoading : (activeTab === "history" ? historyLoading : scoresLoading)

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-white tracking-tight">Live Scores</h2>
          {liveCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#25d65f]/10 border border-[#25d65f]/25 px-3 py-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25d65f] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#25d65f]" />
              </span>
              <span className="text-[11px] font-bold text-[#25d65f]">{liveCount} Live</span>
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-white/40">
          {scores.length} matches today
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search teams or players..."
          className="w-full h-11 bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-transparent transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      {!isSearching && (
        <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
          {([
            { id: "live" as const, label: "Live & Upcoming", icon: <Radio className="h-3.5 w-3.5" /> },
            { id: "completed" as const, label: "Completed", icon: <Trophy className="h-3.5 w-3.5" /> },
            { id: "history" as const, label: "History", icon: <History className="h-3.5 w-3.5" /> },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setHistoryPage(1) }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all",
                activeTab === tab.id
                  ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.id === "live" ? "Live" : tab.id === "completed" ? "Done" : "History"}</span>
            </button>
          ))}
        </div>
      )}

      {/* Sport Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {SCORE_SPORTS.map((sport) => (
          <button
            key={sport.id}
            onClick={() => { setScoreSport(sport.id); setHistoryPage(1) }}
            className={cn(
              "shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all",
              scoreSport === sport.id
                ? "bg-[var(--color-primary)] text-white shadow-[0_4px_16px_rgba(108,99,255,0.35)]"
                : "bg-white/[0.04] text-white/50 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/80"
            )}
          >
            <span>{sport.emoji}</span>
            <span>{sport.label}</span>
          </button>
        ))}
      </div>

      {/* Search indicator */}
      {isSearching && (
        <div className="flex items-center gap-2 px-1">
          <Search className="h-3.5 w-3.5 text-[var(--color-primary)]" />
          <span className="text-xs font-medium text-white/60">
            {searchLoading ? "Searching..." : `${searchResults.length} results for "${searchQuery}"`}
          </span>
        </div>
      )}

      {/* Content */}
      {isLoading && displayMatches.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[130px] animate-pulse rounded-2xl bg-white/[0.03] border border-white/5" />
          ))}
        </div>
      ) : displayMatches.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-10 text-center">
          <Trophy className="w-10 h-10 text-white/15 mx-auto mb-3" />
          <p className="text-sm font-medium text-white/50">
            {isSearching ? "No matches found" : activeTab === "history" ? "No historical matches stored yet" : "No matches available"}
          </p>
          <p className="text-xs text-white/30 mt-1">
            {isSearching ? "Try a different search term" : "Try selecting a different sport or tab"}
          </p>
        </div>
      ) : activeTab === "history" && !isSearching ? (
        /* History view grouped by date */
        <div className="space-y-6">
          {Object.entries(historyByDate).map(([date, matches]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-white/60 bg-white/5 rounded-full px-3 py-1">
                  {formatDate(date)}
                </span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} onClick={() => setSelectedMatch(match)} />
                ))}
              </div>
            </div>
          ))}

          {/* History pagination */}
          {historyTotal > 30 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage <= 1}
                className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-white disabled:opacity-30 hover:bg-white/[0.08] transition-all"
              >
                Previous
              </button>
              <span className="text-xs text-white/40">
                Page {historyPage} of {Math.ceil(historyTotal / 30)}
              </span>
              <button
                onClick={() => setHistoryPage((p) => p + 1)}
                disabled={historyPage >= Math.ceil(historyTotal / 30)}
                className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs font-bold text-white disabled:opacity-30 hover:bg-white/[0.08] transition-all"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Live/Completed/Search view grouped by league */
        <div className="space-y-6">
          {sortedLeagues.map(([league, matches]) => (
            <div key={league}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-black text-white/90 uppercase tracking-wider">{league}</h3>
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[10px] font-medium text-white/30 bg-white/5 rounded-full px-2.5 py-0.5">
                  {matches.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} onClick={() => setSelectedMatch(match)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Match Detail Modal */}
      <MatchDetailModal
        match={selectedMatch ? (scores.find((m) => m.id === selectedMatch.id) || selectedMatch) : null}
        onClose={() => setSelectedMatch(null)}
      />
    </section>
  )
}

// ─── Match Card ──────────────────────────────────────────────────────────────

function TeamLogo({ url, name, color }: { url?: string; name: string; color?: string }) {
  if (url) {
    return (
      <div className="relative h-7 w-7 shrink-0">
        <img src={url} alt={name} className="h-7 w-7 object-contain" loading="lazy" />
      </div>
    )
  }
  return (
    <div
      className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full text-[9px] font-black"
      style={{
        backgroundColor: color ? `#${color}22` : "rgba(255,255,255,0.08)",
        color: color ? `#${color}` : "rgba(255,255,255,0.4)",
      }}
    >
      {name.slice(0, 3).toUpperCase()}
    </div>
  )
}

function MatchCard({ match, onClick }: { match: LiveMatch | HistoryMatch; onClick: () => void }) {
  const live = isLiveStatus(match.status)
  const finished = match.status === "Finished"
  const upcoming = match.status === "Not Started"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl p-4 border transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden group",
        live
          ? "bg-gradient-to-br from-[#25d65f]/[0.04] to-transparent border-[#25d65f]/15 hover:border-[#25d65f]/30"
          : "bg-white/[0.02] border-white/[0.06] hover:border-[var(--color-primary)]/25 hover:bg-white/[0.04]"
      )}
    >
      {match.homeColor && (
        <div
          className="absolute top-0 left-0 w-20 h-20 rounded-full blur-3xl opacity-[0.05] pointer-events-none"
          style={{ backgroundColor: `#${match.homeColor}` }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative">
        <span className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">
          {match.league}
        </span>
        {live && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#25d65f]/10 border border-[#25d65f]/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25d65f] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#25d65f]" />
            </span>
            <span className="text-[10px] font-bold text-[#25d65f]">{match.clock || "LIVE"}</span>
          </div>
        )}
        {finished && (
          <span className="text-[10px] font-bold text-white/40 bg-white/5 rounded-full px-2 py-0.5">FT</span>
        )}
        {upcoming && (
          <div className="flex items-center gap-1 text-white/35">
            <Clock className="h-3 w-3" />
            <span className="text-[10px] font-medium">{match.clock || "TBD"}</span>
          </div>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-2.5 relative">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <TeamLogo url={match.homeLogo} name={match.homeTeam} color={match.homeColor} />
            <span className={cn(
              "text-sm font-semibold truncate",
              finished && match.homeScore > match.awayScore ? "text-white" :
              live ? "text-white/90" : "text-white/70"
            )}>
              {match.homeTeam}
            </span>
          </div>
          <span className={cn(
            "text-lg font-black tabular-nums shrink-0",
            upcoming ? "text-white/20" :
            live ? "text-white" :
            match.homeScore > match.awayScore ? "text-white" : "text-white/50"
          )}>
            {upcoming ? "-" : match.homeScore}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <TeamLogo url={match.awayLogo} name={match.awayTeam} color={match.awayColor} />
            <span className={cn(
              "text-sm font-semibold truncate",
              finished && match.awayScore > match.homeScore ? "text-white" :
              live ? "text-white/90" : "text-white/70"
            )}>
              {match.awayTeam}
            </span>
          </div>
          <span className={cn(
            "text-lg font-black tabular-nums shrink-0",
            upcoming ? "text-white/20" :
            live ? "text-white" :
            match.awayScore > match.homeScore ? "text-white" : "text-white/50"
          )}>
            {upcoming ? "-" : match.awayScore}
          </span>
        </div>
      </div>

      {/* Date for history items */}
      {"matchDate" in match && match.matchDate && finished && (
        <div className="mt-2 pt-2 border-t border-white/5">
          <span className="text-[10px] text-white/25">{formatDate(match.matchDate)}</span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00")
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return "Today"
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday"

    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateStr
  }
}
