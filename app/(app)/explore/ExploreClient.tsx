"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight, Flame, Zap, MapPin, Trophy, Newspaper } from "lucide-react"
import Link from "next/link"
import type { LiveMatch } from "@/types"
import type { NewsItem } from "@/types/news"
import MatchDetailModal from "@/components/scores/MatchDetailModal"

type DateFilter = "today" | "all"
type SportFilter = "all" | string

const SPORT_OPTIONS = [
  { id: "all", label: "ALL SPORTS", emoji: "🔥" },
  { id: "Football", label: "SOCCER", emoji: "⚽" },
  { id: "Basketball", label: "BASKETBALL", emoji: "🏀" },
  { id: "American Football", label: "FOOTBALL", emoji: "🏈" },
  { id: "Tennis", label: "TENNIS", emoji: "🎾" },
  { id: "Hockey", label: "HOCKEY", emoji: "🏒" },
  { id: "Baseball", label: "BASEBALL", emoji: "⚾" },
  { id: "MMA", label: "MMA", emoji: "🥊" },
  { id: "Cricket", label: "CRICKET", emoji: "🏏" },
]

type ExploreClientProps = {
  initialScores: LiveMatch[]
  initialArticle: NewsItem | null
}

export default function ExploreClient({ initialScores, initialArticle }: ExploreClientProps) {
  const scoresRef = useRef<HTMLDivElement>(null)
  const [scores, setScores] = useState<LiveMatch[]>(initialScores)
  const [scoresLoading, setScoresLoading] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>("today")
  const [sportFilter, setSportFilter] = useState<SportFilter>("all")
  const [showSportDropdown, setShowSportDropdown] = useState(false)

  // Track whether we're still using the SSR data (date=today, sport=all).
  const usingInitial = dateFilter === "today" && sportFilter === "all"

  const fetchScores = useCallback(async (signal?: AbortSignal) => {
    setScoresLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFilter === "today") {
        const today = new Date()
        const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
        params.set("date", dateStr)
      }
      if (sportFilter !== "all") {
        params.set("sport", sportFilter)
      }
      const res = await fetch(`/api/scores?${params.toString()}`, { signal })
      const json = await res.json()
      if (json.success && json.data) {
        setScores(json.data)
      }
    } catch { /* silently fail; AbortError lands here too */ }
    finally { setScoresLoading(false) }
  }, [dateFilter, sportFilter])

  // Refetch when filters change. Skip the very first render if filters still
  // match the SSR snapshot (today + all sports).
  useEffect(() => {
    if (usingInitial && scores === initialScores) return
    const ctrl = new AbortController()
    fetchScores(ctrl.signal)
    return () => ctrl.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, sportFilter])

  // 30s polling regardless of filters; cheap because /api/scores is DB-cached.
  useEffect(() => {
    const interval = setInterval(() => fetchScores(), 30000)
    return () => clearInterval(interval)
  }, [fetchScores])

  // Close sport dropdown on outside click
  useEffect(() => {
    if (!showSportDropdown) return
    const handleClick = () => setShowSportDropdown(false)
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [showSportDropdown])

  const scrollScores = (dir: number) => {
    scoresRef.current?.scrollBy({ left: dir * 240, behavior: "smooth" })
  }

  return (
    <div className="w-full">
      {/* Explore section */}
      <section className="px-6 md:px-10 py-6 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-[var(--color-lime)]" />
            <span>EXPLORE</span>
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setDateFilter(dateFilter === "today" ? "all" : "today")}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-medium transition-colors ${
                dateFilter === "today"
                  ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                  : "border-[var(--color-border)] hover:border-white/30"
              }`}
            >
              📅 TODAY
            </button>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowSportDropdown(!showSportDropdown) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-medium transition-colors ${
                  sportFilter !== "all"
                    ? "border-[var(--color-lime)] bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                    : "border-[var(--color-border)] hover:border-white/30"
                }`}
              >
                {sportFilter === "all" ? "🔥 ALL SPORTS" : `${SPORT_OPTIONS.find(s => s.id === sportFilter)?.emoji || "🎯"} ${SPORT_OPTIONS.find(s => s.id === sportFilter)?.label || sportFilter.toUpperCase()}`}
              </button>
              {showSportDropdown && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl py-1 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                  {SPORT_OPTIONS.map((sport) => (
                    <button
                      key={sport.id}
                      onClick={() => { setSportFilter(sport.id); setShowSportDropdown(false) }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 transition-colors ${
                        sportFilter === sport.id
                          ? "bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <span>{sport.emoji}</span>
                      <span>{sport.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => scrollScores(-1)} className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => scrollScores(1)} className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-white transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Score cards track */}
        <div ref={scoresRef} className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
          {scoresLoading && scores.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="min-w-[220px] flex-shrink-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 animate-pulse">
                <div className="h-3 w-16 bg-white/10 rounded mb-3" />
                <div className="space-y-2">
                  <div className="h-4 bg-white/10 rounded" />
                  <div className="h-4 bg-white/10 rounded" />
                </div>
              </div>
            ))
          ) : scores.length === 0 ? (
            <div className="min-w-[220px] flex-shrink-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 text-center">
              <p className="text-xs text-[var(--color-text-muted)]">No games today</p>
            </div>
          ) : (
            scores.slice(0, 20).map((match) => {
              const isLive = match.status !== "Finished" && match.status !== "Not Started"
              const isFinished = match.status === "Finished"
              return (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className={`min-w-[220px] flex-shrink-0 bg-[var(--color-surface)] border rounded-xl p-3 cursor-pointer transition-all hover:border-[var(--color-lime)]/30 ${isLive ? "border-[#25d65f]/30" : "border-[var(--color-border)]"}`}
                >
                  <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mb-2">
                    <span className={isLive ? "text-[#25d65f] font-bold" : ""}>
                      {isLive ? `● ${match.clock || "LIVE"}` : isFinished ? "FT" : match.clock || (match.startTime ? new Date(match.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Scheduled")}
                    </span>
                    <span className="truncate ml-2">{match.league}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[13px]">
                      {match.homeLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={match.homeLogo} alt="" className="w-5 h-5 object-contain" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-[#333] flex items-center justify-center text-[9px] font-bold">
                          {match.homeTeam.slice(0, 3).toUpperCase()}
                        </div>
                      )}
                      <span className={`flex-1 font-medium truncate ${isFinished && match.homeScore > match.awayScore ? "text-white" : ""}`}>
                        {match.homeTeam}
                      </span>
                      <span className={`font-bold ${isLive ? "text-white" : isFinished && match.homeScore > match.awayScore ? "text-white" : "text-white/60"}`}>
                        {match.status === "Not Started" ? "-" : match.homeScore}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px]">
                      {match.awayLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={match.awayLogo} alt="" className="w-5 h-5 object-contain" loading="lazy" decoding="async" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-[#333] flex items-center justify-center text-[9px] font-bold">
                          {match.awayTeam.slice(0, 3).toUpperCase()}
                        </div>
                      )}
                      <span className={`flex-1 font-medium truncate ${isFinished && match.awayScore > match.homeScore ? "text-white" : ""}`}>
                        {match.awayTeam}
                      </span>
                      <span className={`font-bold ${isLive ? "text-white" : isFinished && match.awayScore > match.homeScore ? "text-white" : "text-white/60"}`}>
                        {match.status === "Not Started" ? "-" : match.awayScore}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Featured game */}
      <section className="px-6 md:px-10 py-6">
        <FeaturedGame scores={scores} />
      </section>

      <TopStoryAndStats scores={scores} initialArticle={initialArticle} />

      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  )
}

/** Featured Game — picks the hottest live or upcoming match */
function FeaturedGame({ scores }: { scores: LiveMatch[] }) {
  const popularSports = ["Basketball", "Football", "American Football", "Tennis", "MMA"]
  const liveMatches = scores.filter((m) => m.status !== "Finished" && m.status !== "Not Started")
  const upcomingMatches = scores.filter((m) => m.status === "Not Started")
  const popularLive = liveMatches.find((m) => popularSports.includes(m.sport))
  const popularUpcoming = upcomingMatches.find((m) => popularSports.includes(m.sport))
  const hotMatch = popularLive || liveMatches[0] || popularUpcoming || upcomingMatches[0] || scores[0]

  if (!hotMatch) return null

  return (
    <Link href="/scores" className="block group">
      <div className="rounded-2xl border border-[var(--color-border)] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all group-hover:border-[var(--color-lime)]/30"
        style={{ background: "linear-gradient(135deg, #1a2e1a 0%, #1e2820 30%, #1a1f1a 60%, var(--color-surface) 100%)" }}>
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-warning)] mb-2">
            <Flame className="w-4 h-4" /> FEATURED MATCHUP
          </div>
          <h3 className="text-xl md:text-2xl font-extrabold tracking-wide mb-1">
            {hotMatch.homeTeam} vs {hotMatch.awayTeam}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mb-1">
            {hotMatch.league} · {hotMatch.status === "Not Started" ? (hotMatch.clock || "Upcoming") : `${hotMatch.homeScore} - ${hotMatch.awayScore}`}
          </p>
          {hotMatch.venue && (
            <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {hotMatch.venue}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {(hotMatch.status !== "Finished" && hotMatch.status !== "Not Started") && (
            <div className="flex items-center gap-2 bg-[var(--color-surface)] border border-[#25d65f]/30 rounded-full px-4 py-2 text-sm font-semibold">
              <span className="text-[#25d65f]">● LIVE</span>
            </div>
          )}
          {hotMatch.status === "Not Started" && (
            <div className="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-lime)]/30 rounded-full px-4 py-2 text-sm font-semibold">
              <span className="text-[var(--color-lime)]">UPCOMING</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            {hotMatch.homeLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hotMatch.homeLogo} alt={hotMatch.homeTeam} className="w-10 h-10 object-contain" loading="lazy" decoding="async" />
            )}
            <span className="text-2xl font-black">{hotMatch.status === "Not Started" ? "vs" : `${hotMatch.homeScore} - ${hotMatch.awayScore}`}</span>
            {hotMatch.awayLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hotMatch.awayLogo} alt={hotMatch.awayTeam} className="w-10 h-10 object-contain" loading="lazy" decoding="async" />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

/** Top Story (server-provided) + Quick Stats */
function TopStoryAndStats({ scores, initialArticle }: { scores: LiveMatch[]; initialArticle: NewsItem | null }) {
  const article = initialArticle

  const liveCount = scores.filter((m) => m.status !== "Finished" && m.status !== "Not Started").length
  const upcomingCount = scores.filter((m) => m.status === "Not Started").length
  const finishedCount = scores.filter((m) => m.status === "Finished").length
  const totalGames = scores.length

  return (
    <section className="px-6 md:px-10 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Link href="/news" className="block group">
        <div className="rounded-2xl overflow-hidden relative bg-[#222] min-h-[400px] flex flex-col justify-end transition-all group-hover:ring-2 group-hover:ring-[var(--color-lime)]/30">
          {article?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={article.image} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/90" />
          <div className="absolute top-4 right-4 bg-[var(--color-lime)] text-black px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1 z-10">
            <Zap className="w-3 h-3" /> TOP STORY
          </div>
          <div className="relative p-6 z-10">
            <h2 className="text-xl font-extrabold uppercase leading-tight mb-2">
              {article?.title ?? "TOP STORIES & ANALYSIS"}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {article ? `${article.source} • ${article.category}` : "Sports • Featured"}
            </p>
            <p className="text-xs text-[var(--color-lime)] mt-2 font-semibold group-hover:underline flex items-center gap-1">
              <Newspaper className="w-3 h-3" /> Read more in News →
            </p>
          </div>
        </div>
      </Link>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[var(--color-lime)]" /> TODAY&apos;S SPORTS
          </h3>
          <Link href="/scores" className="text-xs font-bold text-[var(--color-lime)] hover:underline">
            View All →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <div className="text-2xl font-black text-white">{totalGames}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">Total Games</div>
          </div>
          <div className="bg-black/20 rounded-xl p-4 border border-[#25d65f]/20">
            <div className="text-2xl font-black text-[#25d65f]">{liveCount}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">Live Now</div>
          </div>
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <div className="text-2xl font-black text-white">{upcomingCount}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">Upcoming</div>
          </div>
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <div className="text-2xl font-black text-white/60">{finishedCount}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">Finished</div>
          </div>
        </div>

        <div className="flex-1">
          <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-3">Active Sports</h4>
          <div className="space-y-2">
            {(() => {
              const sportCounts: Record<string, number> = {}
              scores.forEach((m) => {
                sportCounts[m.sport] = (sportCounts[m.sport] || 0) + 1
              })
              const sorted = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])
              const sportEmoji: Record<string, string> = {
                Football: "⚽", Basketball: "🏀", "American Football": "🏈",
                Tennis: "🎾", Hockey: "🏒", Baseball: "⚾", F1: "🏎️",
                MMA: "🥊", Golf: "⛳", Cricket: "🏏",
              }
              return sorted.slice(0, 5).map(([sport, count]) => (
                <div key={sport} className="flex items-center justify-between p-2.5 rounded-xl bg-black/20 border border-white/[0.04]">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{sportEmoji[sport] || "🎯"}</span>
                    <span className="text-sm font-medium text-white">{sport}</span>
                  </div>
                  <span className="text-xs font-bold text-[var(--color-text-muted)]">{count} games</span>
                </div>
              ))
            })()}
            {scores.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No games scheduled today</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
