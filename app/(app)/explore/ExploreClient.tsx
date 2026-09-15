"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight, Flame, Zap, MapPin, Trophy, Newspaper, Users, Clock, Heart, MessageCircle, Send, Plus, Copy } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import dynamic from "next/dynamic"
import type { LiveMatch } from "@/types"
import type { NewsItem } from "@/types/news"
import type { LeaderboardSnapshotEntry, FeedSnapshot } from "@/lib/data/isr-snapshots"
import { formatMatchTime, formatRelative } from "@/lib/datetime"

const MatchDetailModal = dynamic(() => import("@/components/scores/MatchDetailModal"), { ssr: false })

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
  initialLeaders: LeaderboardSnapshotEntry[]
  initialFeed: FeedSnapshot
}

export default function ExploreClient({ initialScores, initialArticle, initialLeaders, initialFeed }: ExploreClientProps) {
  const scoresRef = useRef<HTMLDivElement>(null)
  const [scores, setScores] = useState<LiveMatch[]>(initialScores)
  const [scoresLoading, setScoresLoading] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<LiveMatch | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>("today")
  const [sportFilter, setSportFilter] = useState<SportFilter>("all")
  const [showSportDropdown, setShowSportDropdown] = useState(false)
  // Scraped news image URLs rot (ESPN removes photos), and a broken <Image>
  // leaves a dead box in the Top Story card. Track the failure and drop it.
  const [topStoryImageFailed, setTopStoryImageFailed] = useState(false)

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

  // Refetch when filters change.
  useEffect(() => {
    if (usingInitial && scores === initialScores) return
    const ctrl = new AbortController()
    fetchScores(ctrl.signal)
    return () => ctrl.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, sportFilter])

  // 30s polling
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
      {/* Explore section — scores strip */}
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
            <button onClick={() => scrollScores(-1)} aria-label="Scroll scores left" className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-white transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => scrollScores(1)} aria-label="Scroll scores right" className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:border-white transition-colors">
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
              const isFinished = match.status === "Finished"
              return (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className="min-w-[220px] flex-shrink-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 cursor-pointer transition-colors hover:border-[var(--color-lime)]/30"
                >
                  {/* Same timezone-driven server/client text mismatch as the
                      featured card: keep the time on one line and let the league
                      absorb the slack, so a longer server-rendered timestamp
                      cannot reflow the row at hydration. */}
                  <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mb-2">
                    <span className="whitespace-nowrap shrink-0" suppressHydrationWarning>
                      {isFinished ? "FT" : match.startTime ? formatMatchTime(match.startTime) : (match.clock || "Scheduled")}
                    </span>
                    <span className="truncate ml-2 min-w-0">{match.league}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[13px]">
                      {match.homeLogo ? (
                        <Image src={match.homeLogo} alt="" width={20} height={20} className="w-5 h-5 object-contain" loading="lazy" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-[#333] flex items-center justify-center text-[9px] font-bold">
                          {match.homeTeam.slice(0, 3).toUpperCase()}
                        </div>
                      )}
                      <span className={`flex-1 font-medium truncate ${isFinished && match.homeScore > match.awayScore ? "text-white" : ""}`}>
                        {match.homeTeam}
                      </span>
                      <span className={`font-bold ${isFinished && match.homeScore > match.awayScore ? "text-white" : "text-white/70"}`}>
                        {match.status === "Not Started" ? "-" : match.homeScore}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[13px]">
                      {match.awayLogo ? (
                        <Image src={match.awayLogo} alt="" width={20} height={20} className="w-5 h-5 object-contain" loading="lazy" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-[#333] flex items-center justify-center text-[9px] font-bold">
                          {match.awayTeam.slice(0, 3).toUpperCase()}
                        </div>
                      )}
                      <span className={`flex-1 font-medium truncate ${isFinished && match.awayScore > match.homeScore ? "text-white" : ""}`}>
                        {match.awayTeam}
                      </span>
                      <span className={`font-bold ${isFinished && match.awayScore > match.homeScore ? "text-white" : "text-white/70"}`}>
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

      {/* Main content: Social Feed + Mini Leaderboard */}
      <section className="px-6 md:px-10 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Social Feed — 2/3 width */}
        <div className="lg:col-span-2">
          <SocialFeed initialFeed={initialFeed} />
        </div>

        {/* Sidebar: Top Story + Mini Leaderboard — 1/3 width */}
        <div className="space-y-6">
          {/* Top Story */}
          {initialArticle && (
            <Link href="/news" className="block group">
              <div className="rounded-2xl overflow-hidden relative bg-[#222] min-h-[220px] flex flex-col justify-end transition-shadow group-hover:ring-2 group-hover:ring-[var(--color-lime)]/30">
                {/* `priority` was removed deliberately. The grid is single-column
                    on mobile, so this sidebar card sits BELOW the fold there —
                    `priority` emitted a <link rel=preload> for a large
                    off-screen image that competed with above-the-fold requests
                    on exactly the viewport where LCP was worst. It also is not
                    the LCP element on desktop. `onError` hides the image when a
                    scraped news URL has rotted (these 404 regularly), so a dead
                    image no longer leaves an empty priority slot. */}
                {initialArticle.image && !topStoryImageFailed && (
                  <Image
                    src={initialArticle.image}
                    alt={initialArticle.title || ""}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover"
                    onError={() => setTopStoryImageFailed(true)}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/90" />
                <div className="absolute top-3 right-3 bg-[var(--color-lime)] text-black px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 z-10">
                  <Zap className="w-3 h-3" /> TOP STORY
                </div>
                <div className="relative p-4 z-10">
                  <h2 className="text-sm font-extrabold uppercase leading-tight mb-1 line-clamp-2">
                    {initialArticle.title}
                  </h2>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {initialArticle.source} • {initialArticle.category}
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* Mini Leaderboard */}
          <MiniLeaderboard initialLeaders={initialLeaders} />
        </div>
      </section>

      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
    </div>
  )
}


/** Featured Game — picks the hottest upcoming match (falls back to a result) */
function FeaturedGame({ scores }: { scores: LiveMatch[] }) {
  const popularSports = ["Basketball", "Football", "American Football", "Tennis", "MMA"]
  const upcomingMatches = scores.filter((m) => m.status === "Not Started")
  const popularUpcoming = upcomingMatches.find((m) => popularSports.includes(m.sport))
  const hotMatch = popularUpcoming || upcomingMatches[0] || scores[0]

  if (!hotMatch) return null

  return (
    <Link href="/scores" className="block group">
      <div className="rounded-2xl border border-[var(--color-border)] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-colors group-hover:border-[var(--color-lime)]/30"
        style={{ background: "linear-gradient(135deg, #1a2e1a 0%, #1e2820 30%, #1a1f1a 60%, var(--color-surface) 100%)" }}>
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-warning)] mb-2">
            <Flame className="w-4 h-4" /> FEATURED MATCHUP
          </div>
          <h3 className="text-xl md:text-2xl font-extrabold tracking-wide mb-1">
            {hotMatch.homeTeam} vs {hotMatch.awayTeam}
          </h3>
          {/* `truncate` (nowrap + ellipsis) is load-bearing, not cosmetic.
              formatMatchTime resolves in the VIEWER's timezone, so the server
              renders a different string than the client — e.g. "3 Oct, 12:30 am"
              on a UTC server vs "7:00 pm" locally. The longer server string
              wrapped onto a second line and then collapsed to one line at
              hydration, shrinking this block by ~16px and pulling the whole feed
              section up with it. That reflow was the measured 0.121 CLS on
              /explore (confirmed in the Lighthouse trace: siblings moved up 16px
              while text boxes narrowed 314px -> 308px). Pinning this to a single
              line makes the height independent of the string length. */}
          <p className="text-xs text-[var(--color-text-muted)] mb-1 truncate" suppressHydrationWarning>
            {hotMatch.league} · {hotMatch.status === "Not Started" ? (hotMatch.startTime ? formatMatchTime(hotMatch.startTime) : "Upcoming") : `${hotMatch.homeScore} - ${hotMatch.awayScore}`}
          </p>
          {hotMatch.venue && (
            <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {hotMatch.venue}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {hotMatch.status === "Not Started" && (
            <div className="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-lime)]/30 rounded-full px-4 py-2 text-sm font-semibold">
              <span className="text-[var(--color-lime)]">UPCOMING</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            {hotMatch.homeLogo && (
              <Image src={hotMatch.homeLogo} alt={hotMatch.homeTeam} width={40} height={40} className="w-10 h-10 object-contain" />
            )}
            <span className="text-2xl font-black">{hotMatch.status === "Not Started" ? "vs" : `${hotMatch.homeScore} - ${hotMatch.awayScore}`}</span>
            {hotMatch.awayLogo && (
              <Image src={hotMatch.awayLogo} alt={hotMatch.awayTeam} width={40} height={40} className="w-10 h-10 object-contain" />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

/** Mini Leaderboard — compact top 5 bettors */
function MiniLeaderboard({ initialLeaders }: { initialLeaders: LeaderboardSnapshotEntry[] }) {
  type LeaderEntry = LeaderboardSnapshotEntry

  // Seed from the server-rendered snapshot so the leaderboard is real content in
  // the first HTML paint (LCP) rather than a skeleton.
  const [leaders, setLeaders] = useState<LeaderEntry[]>(initialLeaders)
  // Deliberately starts `false` even when the snapshot came back empty. The
  // server runs the same aggregation as /api/leaderboard, so an empty snapshot
  // is a real answer ("nobody has 10+ resolved picks yet"), not a pending one.
  // Starting this `true` rendered five skeleton rows into the SSR HTML which
  // then collapsed into the much shorter "No data yet" state once the client
  // fetch resolved — that swap was the entire measured 0.121 CLS on /explore.
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialLeaders.length > 0) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/leaderboard?sort=win_rate&limit=5")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.leaderboard) {
          setLeaders(data.leaderboard.slice(0, 5))
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [initialLeaders])

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[var(--color-lime)]" /> LEADERBOARD
        </h3>
        <Link href="/leaderboard" className="text-[11px] font-bold text-[var(--color-lime)] hover:underline">
          View All →
        </Link>
      </div>

      {/* min-h keeps the card a stable height across the empty / populated /
          recovery-fetch states so a late fill-in cannot push the page around. */}
      {loading ? (
        <div className="space-y-3 min-h-[200px]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-5 h-5 rounded-full bg-white/10" />
              <div className="flex-1 h-3 bg-white/10 rounded" />
              <div className="w-10 h-3 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      ) : leaders.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-4 min-h-[200px] flex items-center justify-center">No data yet</p>
      ) : (
        <div className="space-y-2.5 min-h-[200px]">
          {leaders.map((entry, i) => (
            <Link
              key={entry.user_id}
              href={`/l/${entry.username}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
            >
              <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-[var(--color-text-muted)]"}`}>
                {i + 1}
              </span>
              {entry.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[var(--color-lime)]/10 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-[var(--color-lime)]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate group-hover:text-[var(--color-lime)] transition-colors">
                  {entry.display_name || entry.username}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">{entry.total_picks} picks</p>
              </div>
              <span className="text-xs font-bold text-[var(--color-lime)]">{entry.win_rate}%</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}


// ─── Social Feed Types ──────────────────────────────────────────────────────

type FeedPost = {
  id: string
  user_id: string
  content: string | null
  image_url: string | null
  parlay_id: string | null
  like_count: number
  comment_count: number
  created_at: string
  liked_by_me: boolean
  profile: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  } | null
  parlay: {
    id: string
    status: string
    odds: number | null
    legs: Array<{
      id: string
      player_name: string
      stat_category: string
      prop_line: number
      direction: string
      l10_hit_rate: number | null
    }>
  } | null
}

type FeedComment = {
  id: string
  content: string
  created_at: string
  profile: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  } | null
}

/** Instagram-style social feed with infinite scroll */
function SocialFeed({ initialFeed }: { initialFeed: FeedSnapshot }) {
  // Seed from the server-rendered first page so the feed is real content in the
  // first paint (a primary LCP element) instead of three skeleton cards. The
  // snapshot omits per-user like state; a background refresh after mount fills
  // in `liked_by_me` for the signed-in user without changing perceived content.
  const [posts, setPosts] = useState<FeedPost[]>(initialFeed.posts)
  const [loading, setLoading] = useState(initialFeed.posts.length === 0)
  const [hasMore, setHasMore] = useState(initialFeed.hasMore)
  const [nextCursor, setNextCursor] = useState<string | null>(initialFeed.nextCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const observerRef = useRef<HTMLDivElement>(null)

  // Compose state
  const [showCompose, setShowCompose] = useState(false)
  const [composeText, setComposeText] = useState("")
  const [posting, setPosting] = useState(false)

  // Share bet state
  const [showBetPicker, setShowBetPicker] = useState(false)
  const [userParlays, setUserParlays] = useState<Array<{ id: string; status: string; odds: number | null; created_at: string; legs: Array<{ id: string; player_name: string; stat_category: string; prop_line: number; direction: string }> }>>([])
  const [loadingParlays, setLoadingParlays] = useState(false)
  const [selectedParlay, setSelectedParlay] = useState<typeof userParlays[0] | null>(null)

  const fetchPosts = useCallback(async (cursor?: string | null, showSkeleton = true) => {
    const isLoadMore = !!cursor
    if (isLoadMore) setLoadingMore(true)
    else if (showSkeleton) setLoading(true)

    try {
      const params = new URLSearchParams()
      if (cursor) params.set("cursor", cursor)
      const res = await fetch(`/api/feed/posts?${params.toString()}`)
      if (!res.ok) return
      const data = await res.json()

      if (isLoadMore) {
        setPosts((prev) => [...prev, ...(data.posts ?? [])])
      } else {
        setPosts(data.posts ?? [])
      }
      setHasMore(data.hasMore ?? false)
      setNextCursor(data.nextCursor ?? null)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    // If the server already seeded the feed, refresh silently in the background
    // (to pick up per-user like state and any newer posts) without flashing the
    // skeleton over already-painted content.
    fetchPosts(null, initialFeed.posts.length === 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPosts])

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || loadingMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchPosts(nextCursor)
        }
      },
      { threshold: 0.5 }
    )
    const el = observerRef.current
    if (el) observer.observe(el)
    return () => { if (el) observer.unobserve(el) }
  }, [hasMore, loadingMore, nextCursor, fetchPosts])

  const fetchUserParlays = async () => {
    setLoadingParlays(true)
    try {
      const res = await fetch("/api/parlays?limit=20")
      if (res.ok) {
        const data = await res.json()
        setUserParlays(data.parlays ?? [])
      }
    } catch {
      // silently fail
    } finally {
      setLoadingParlays(false)
    }
  }

  const handleShareBet = () => {
    if (!showBetPicker) fetchUserParlays()
    setShowBetPicker(!showBetPicker)
  }

  const handlePost = async () => {
    if (!composeText.trim() && !selectedParlay) return
    if (posting) return
    setPosting(true)
    try {
      const res = await fetch("/api/feed/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: composeText.trim() || null,
          parlay_id: selectedParlay?.id || null,
        }),
      })
      if (res.ok) {
        setComposeText("")
        setSelectedParlay(null)
        setShowBetPicker(false)
        setShowCompose(false)
        // Refresh feed
        fetchPosts()
      }
    } catch {
      // silently fail
    } finally {
      setPosting(false)
    }
  }

  const handleLike = async (postId: string) => {
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.liked_by_me ? p.like_count - 1 : p.like_count + 1 }
          : p
      )
    )

    try {
      await fetch("/api/feed/posts/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId }),
      })
    } catch {
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.liked_by_me ? p.like_count - 1 : p.like_count + 1 }
            : p
        )
      )
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--color-lime)]" /> COMMUNITY
        </h3>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-lime)] text-black rounded-lg text-xs font-bold hover:bg-[var(--color-lime)]/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Post
        </button>
      </div>

      {/* Compose Box */}
      {showCompose && (
        <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-4">
          <textarea
            value={composeText}
            onChange={(e) => setComposeText(e.target.value.slice(0, 500))}
            placeholder="Share a pick or thought..."
            className="w-full bg-transparent text-sm text-white placeholder:text-[var(--color-text-muted)] resize-none outline-none min-h-[80px]"
            rows={3}
          />

          {/* Selected Bet Preview */}
          {selectedParlay && (
            <div className="mt-2 rounded-lg border border-[var(--color-lime)]/20 bg-[var(--color-lime)]/5 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-lime)]">
                  🎯 {selectedParlay.legs.length} Leg Parlay
                </span>
                <button
                  onClick={() => setSelectedParlay(null)}
                  className="text-[10px] text-[var(--color-text-muted)] hover:text-white"
                >
                  ✕ Remove
                </button>
              </div>
              <div className="mt-1 space-y-0.5">
                {selectedParlay.legs.slice(0, 2).map((leg) => (
                  <p key={leg.id} className="text-[11px] text-white/70">
                    {leg.player_name} — {leg.direction === "over" ? "O" : "U"} {leg.prop_line} {leg.stat_category}
                  </p>
                ))}
                {selectedParlay.legs.length > 2 && (
                  <p className="text-[10px] text-[var(--color-text-muted)]">+{selectedParlay.legs.length - 2} more</p>
                )}
              </div>
            </div>
          )}

          {/* Bet Picker */}
          {showBetPicker && (
            <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-black/40 p-3 max-h-[200px] overflow-y-auto">
              <p className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-2">Select a bet to share:</p>
              {loadingParlays ? (
                <div className="flex justify-center py-3">
                  <div className="w-4 h-4 border-2 border-[var(--color-lime)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : userParlays.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-2">No bets found. Create one first!</p>
              ) : (
                <div className="space-y-1.5">
                  {userParlays.map((parlay) => (
                    <button
                      key={parlay.id}
                      onClick={() => { setSelectedParlay(parlay); setShowBetPicker(false) }}
                      className="w-full text-left rounded-md border border-[var(--color-border)] p-2 hover:border-[var(--color-lime)]/40 hover:bg-[var(--color-lime)]/5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white">
                          {parlay.legs.length} Leg{parlay.legs.length > 1 ? "s" : ""}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          parlay.status === "won" ? "bg-lime-500/20 text-lime-400"
                          : parlay.status === "lost" ? "bg-red-500/20 text-red-400"
                          : "bg-amber-500/20 text-amber-400"
                        }`}>
                          {parlay.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">
                        {parlay.legs.map((l) => l.player_name).join(", ")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              {/* Share bet button */}
              <button
                onClick={handleShareBet}
                className={`p-1.5 rounded-md transition-colors ${selectedParlay ? "text-[var(--color-lime)]" : "text-[var(--color-text-muted)] hover:text-white"}`}
                title="Share a bet"
              >
                <Trophy className="w-4 h-4" />
              </button>
              <span className="text-[11px] text-[var(--color-text-muted)]">{composeText.length}/500</span>
            </div>
            <button
              onClick={handlePost}
              disabled={(!composeText.trim() && !selectedParlay) || posting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--color-lime)] text-black rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-lime)]/90 transition-colors"
            >
              <Send className="w-3.5 h-3.5" /> {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-white/10" />
                <div className="flex-1 h-3 bg-white/10 rounded w-24" />
              </div>
              <div className="h-4 bg-white/10 rounded mb-2 w-3/4" />
              <div className="h-4 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-8 text-center">
          <Users className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-muted)]">No posts yet. Be the first to share!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onLike={handleLike} />
          ))}

          {/* Infinite scroll trigger */}
          <div ref={observerRef} className="h-4" />

          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-[var(--color-lime)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Individual post card */
function PostCard({ post, onLike }: { post: FeedPost; onLike: (id: string) => void }) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<FeedComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)
  const [copiedBet, setCopiedBet] = useState(false)

  const loadComments = async () => {
    if (commentsLoading) return
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/feed/posts/comments?post_id=${post.id}`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments ?? [])
      }
    } catch {
      // silently fail
    } finally {
      setCommentsLoading(false)
    }
  }

  const handleToggleComments = () => {
    if (!showComments) loadComments()
    setShowComments(!showComments)
  }

  const handleSubmitComment = async () => {
    if (!newComment.trim() || submittingComment) return
    setSubmittingComment(true)
    try {
      const res = await fetch("/api/feed/posts/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id, content: newComment.trim() }),
      })
      if (res.ok) {
        setNewComment("")
        loadComments()
      }
    } catch {
      // silently fail
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleCopyBet = async () => {
    if (copiedBet || !post.parlay) return
    setCopiedBet(true)

    try {
      const legs = post.parlay.legs.map((leg) => ({
        player_name: leg.player_name,
        stat_category: leg.stat_category,
        prop_line: leg.prop_line,
        direction: leg.direction,
        l10_hit_rate: leg.l10_hit_rate ?? 0,
        sport: "NBA", // default; the feed doesn't expose sport per leg
      }))

      // Only attempt if we have enough legs (validation requires min 2)
      if (legs.length >= 2) {
        await fetch("/api/parlays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legs,
            visibility: "private",
            odds: post.parlay.odds ?? null,
            custom_note: `Copied from @${post.profile?.username ?? "user"}`,
          }),
        })
      }
    } catch {
      // silently fail — the visual feedback is enough
    }

    setTimeout(() => setCopiedBet(false), 2000)
  }

  const timeAgo = (dateStr: string) => formatRelative(dateStr)

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5 transition-colors hover:border-white/10">
      {/* Author header */}
      <div className="flex items-center gap-3 mb-3">
        {post.profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--color-lime)]/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-[var(--color-lime)]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <Link href={`/l/${post.profile?.username ?? ""}`} className="text-sm font-semibold text-white hover:text-[var(--color-lime)] transition-colors">
            {post.profile?.display_name || post.profile?.username || "Anonymous"}
          </Link>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            @{post.profile?.username ?? "user"} · {timeAgo(post.created_at)}
          </p>
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <p className="text-sm text-white/90 mb-3 whitespace-pre-wrap break-words">{post.content}</p>
      )}

      {/* Image — the wrapper reserves a 16:9 box before the image loads. This
          used to be a bare `w-full` <img> with `max-h-[400px]` and no intrinsic
          dimensions, so every post image pushed the rest of the feed down as it
          decoded. That was the measured source of the ~0.12 CLS on /explore
          (Lighthouse blamed this feed section). `aspect-[16/9]` + an absolutely
          positioned image keeps the space stable regardless of the real
          dimensions of a user-supplied URL. */}
      {post.image_url && (
        <div className="relative mb-3 w-full aspect-[16/9] max-h-[400px] rounded-lg overflow-hidden border border-white/5 bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>
      )}

      {/* Linked Bet/Parlay */}
      {post.parlay && (
        <div className="mb-3 rounded-lg border border-[var(--color-lime)]/20 bg-[var(--color-lime)]/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[var(--color-lime)]">
              🎯 {post.parlay.legs.length} Leg Parlay
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
              post.parlay.status === "won" ? "bg-lime-500/20 text-lime-400"
              : post.parlay.status === "lost" ? "bg-red-500/20 text-red-400"
              : "bg-amber-500/20 text-amber-400"
            }`}>
              {post.parlay.status}
            </span>
          </div>
          <div className="space-y-1">
            {post.parlay.legs.slice(0, 3).map((leg) => (
              <div key={leg.id} className="flex items-center justify-between text-xs">
                <span className="text-white/70">
                  {leg.player_name} — {leg.direction === "over" ? "O" : "U"} {leg.prop_line} {leg.stat_category}
                </span>
                {leg.l10_hit_rate != null && (
                  <span className="text-[var(--color-text-muted)]">{leg.l10_hit_rate}%</span>
                )}
              </div>
            ))}
            {post.parlay.legs.length > 3 && (
              <p className="text-[11px] text-[var(--color-text-muted)]">+{post.parlay.legs.length - 3} more</p>
            )}
          </div>
          <button
            onClick={handleCopyBet}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-lime)]/10 border border-[var(--color-lime)]/20 text-[var(--color-lime)] text-xs font-semibold hover:bg-[var(--color-lime)]/20 transition-colors"
          >
            <Copy className="w-3 h-3" /> {copiedBet ? "Added!" : "Add to My Bets"}
          </button>
        </div>
      )}

      {/* Actions: Like, Comment */}
      <div className="flex items-center gap-4 pt-2 border-t border-[var(--color-border)]/50">
        <button
          onClick={() => onLike(post.id)}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            post.liked_by_me ? "text-red-400" : "text-[var(--color-text-muted)] hover:text-red-400"
          }`}
        >
          <Heart className={`w-4 h-4 ${post.liked_by_me ? "fill-current" : ""}`} />
          {post.like_count > 0 && <span>{post.like_count}</span>}
        </button>
        <button
          onClick={handleToggleComments}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          {post.comment_count > 0 && <span>{post.comment_count}</span>}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)]/50">
          {commentsLoading ? (
            <div className="flex justify-center py-2">
              <div className="w-4 h-4 border-2 border-[var(--color-lime)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {comments.length > 0 && (
                <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center">
                        {c.profile?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <Users className="w-3 h-3 text-[var(--color-text-muted)]" />
                        )}
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-white/80">
                          {c.profile?.display_name || c.profile?.username || "User"}
                        </span>
                        <p className="text-xs text-white/70">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value.slice(0, 300))}
                  placeholder="Add a comment..."
                  className="flex-1 bg-black/20 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-lime)]/30"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmitComment() }}
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="p-1.5 rounded-lg bg-[var(--color-lime)]/10 text-[var(--color-lime)] disabled:opacity-50 hover:bg-[var(--color-lime)]/20 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
