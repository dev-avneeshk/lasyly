"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { X, MapPin, Tv, TrendingUp, BarChart3, Users2, Clock } from "lucide-react"
import { LiveMatch, MatchSummary } from "@/types"
import { cn } from "@/lib/utils"

interface MatchDetailModalProps {
  match: LiveMatch | null
  onClose: () => void
}

type Tab = "summary" | "boxscore" | "stats"

function isLive(status: string): boolean {
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

// ─── Sport-specific tab configuration ────────────────────────────────────────

// Sports that are team-based and support box scores / team stats
const TEAM_SPORTS = new Set(["Football", "Basketball", "American Football", "Hockey", "Baseball", "Cricket"])
// Sports that are individual (no team stats or box score)
const INDIVIDUAL_SPORTS = new Set(["Tennis", "MMA", "Golf", "F1"])

function getTabsForSport(
  sport: string,
  hasTeamStats?: boolean,
  hasBoxscore?: boolean
): { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] {
  if (INDIVIDUAL_SPORTS.has(sport)) {
    // Individual sports: show match summary/details only
    return [
      { id: "summary", label: "Match Info", icon: <Clock className="h-3.5 w-3.5" />, show: true },
    ]
  }

  // Team sports: show all relevant tabs
  return [
    { id: "stats", label: "Team Stats", icon: <Users2 className="h-3.5 w-3.5" />, show: true },
    { id: "boxscore", label: "Box Score", icon: <BarChart3 className="h-3.5 w-3.5" />, show: true },
    { id: "summary", label: "Standings", icon: <Clock className="h-3.5 w-3.5" />, show: true },
  ]
}

function TeamLogo({ url, name, color, size = "lg" }: { url?: string; name: string; color?: string; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16" : "h-8 w-8"
  const textSize = size === "lg" ? "text-lg" : "text-[10px]"

  if (url) {
    return (
      <div className={cn("relative", dim)}>
        {color && (
          <div
            className="absolute inset-0 rounded-full opacity-20 blur-lg"
            style={{ backgroundColor: `#${color}` }}
          />
        )}
        <img
          src={url}
          alt={name}
          className={cn("relative object-contain", dim)}
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-black",
        dim,
        textSize
      )}
      style={{
        backgroundColor: color ? `#${color}22` : "rgba(255,255,255,0.08)",
        color: color ? `#${color}` : "rgba(255,255,255,0.5)",
      }}
    >
      {name.slice(0, 3).toUpperCase()}
    </div>
  )
}

export default function MatchDetailModal({ match, onClose }: MatchDetailModalProps) {
  const [summary, setSummary] = useState<MatchSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>("stats")
  const [mounted, setMounted] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (match) {
      triggerRef.current = document.activeElement
      // Individual sports always show summary; team sports show stats when live/finished
      if (match.status === "Not Started" || INDIVIDUAL_SPORTS.has(match.sport)) {
        setActiveTab("summary")
      } else {
        setActiveTab("stats")
      }
    }
  }, [match])

  const fetchSummary = useCallback(async (eventId: string, league: string) => {
    setLoading(true)
    setFetchError(false)
    try {
      const params = new URLSearchParams()
      if (league) params.set("league", league)
      const res = await fetch(`/api/scores/${eventId}/summary?${params.toString()}`)
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      if (json.success) {
        setSummary(json.data)
      } else {
        setFetchError(true)
      }
    } catch {
      setFetchError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (match?.eventId) {
      fetchSummary(match.eventId, match.league)
    } else if (match) {
      // No eventId — try using the match id as eventId
      setSummary(null)
      setFetchError(false)
      setLoading(false)
    } else {
      setSummary(null)
      setFetchError(false)
    }
  }, [match?.eventId, match?.league, match?.id, fetchSummary])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (match) {
      document.addEventListener("keydown", handleKey)
      return () => document.removeEventListener("keydown", handleKey)
    }
  }, [match, onClose])

  useEffect(() => {
    if (!match && triggerRef.current && triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus()
    }
  }, [match])

  if (!match || !mounted) return null

  const live = isLive(match.status)
  const venue = summary?.venue || match.venue
  const hasBoxscore = summary?.boxscore?.players && summary.boxscore.players.length > 0
  const hasTeamStats = summary?.boxscore?.teams && summary.boxscore.teams.length > 0
  const isUpcoming = match.status === "Not Started"

  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = isUpcoming
    ? [
        { id: "summary", label: "Preview", icon: <Clock className="h-3.5 w-3.5" />, show: true },
      ]
    : getTabsForSport(match.sport, hasTeamStats, hasBoxscore)

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${match.homeTeam} vs ${match.awayTeam} details`}
    >
      <div className="w-full max-w-lg max-h-[90vh] rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a0a4a] to-[#0d0025] shadow-[0_25px_80px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Scoreboard Header */}
        <div className="relative overflow-hidden">
          {/* Background gradient using team colors */}
          <div className="absolute inset-0">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `linear-gradient(135deg, ${match.homeColor ? `#${match.homeColor}` : '#4a2d8a'} 0%, transparent 50%, ${match.awayColor ? `#${match.awayColor}` : '#2d4a8a'} 100%)`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#1a0a4a]" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white transition-all"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* League & Status */}
          <div className="relative pt-5 pb-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                {match.league}
              </span>
              {live && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#25d65f]/15 px-2 py-0.5 border border-[#25d65f]/30">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25d65f] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#25d65f]" />
                  </span>
                  <span className="text-[10px] font-bold text-[#25d65f]">{match.clock || "LIVE"}</span>
                </span>
              )}
              {match.status === "Finished" && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white/50">
                  FINAL
                </span>
              )}
              {match.status === "Not Started" && (
                <span className="text-[10px] font-medium text-white/40">
                  {match.clock || "Scheduled"}
                </span>
              )}
            </div>
          </div>

          {/* Score Display */}
          <div className="relative px-6 pb-6 pt-2">
            <div className="flex items-center justify-between">
              {/* Home Team */}
              <div className="flex-1 flex flex-col items-center gap-2">
                <TeamLogo url={match.homeLogo} name={match.homeTeam} color={match.homeColor} />
                <span className="text-xs font-bold text-white/90 text-center leading-tight max-w-[100px]">
                  {match.homeTeam}
                </span>
              </div>

              {/* Score */}
              <div className="flex-shrink-0 px-4 text-center">
                {match.status === "Not Started" ? (
                  <div>
                    <span className="text-2xl font-black text-white/30">VS</span>
                    {match.clock && (
                      <p className="mt-1 text-xs text-white/40">{match.clock}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-4xl font-black tabular-nums",
                      match.homeScore >= match.awayScore ? "text-white" : "text-white/50"
                    )}>
                      {match.homeScore}
                    </span>
                    <span className="text-lg text-white/20 font-light">:</span>
                    <span className={cn(
                      "text-4xl font-black tabular-nums",
                      match.awayScore >= match.homeScore ? "text-white" : "text-white/50"
                    )}>
                      {match.awayScore}
                    </span>
                  </div>
                )}
              </div>

              {/* Away Team */}
              <div className="flex-1 flex flex-col items-center gap-2">
                <TeamLogo url={match.awayLogo} name={match.awayTeam} color={match.awayColor} />
                <span className="text-xs font-bold text-white/90 text-center leading-tight max-w-[100px]">
                  {match.awayTeam}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {!loading && !fetchError && (
          <div className="flex border-b border-white/5 px-4">
            {tabs.filter(t => t.show).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all border-b-2 -mb-px",
                  activeTab === tab.id
                    ? "border-[var(--color-primary)] text-white"
                    : "border-transparent text-white/40 hover:text-white/70"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-white/10 border-t-[var(--color-primary)]" />
              <span className="text-xs text-white/40">Loading match details...</span>
            </div>
          )}

          {fetchError && !loading && (
            <div className="text-center py-8">
              <p className="text-sm text-white/40">Detailed stats unavailable</p>
              <p className="text-xs text-white/25 mt-1">ESPN data may not be available for this match</p>
            </div>
          )}

          {!loading && !fetchError && activeTab === "summary" && (
            <SummaryTab match={match} summary={summary} venue={venue} />
          )}

          {!loading && !fetchError && activeTab === "boxscore" && (
            summary?.boxscore?.players ? (
              <BoxScoreTab players={summary.boxscore.players} />
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-white/40">Box score not available yet</p>
                <p className="text-xs text-white/25 mt-1">Player stats will appear once loaded from ESPN</p>
              </div>
            )
          )}

          {!loading && !fetchError && activeTab === "stats" && (
            summary?.boxscore?.teams ? (
              <TeamStatsTab teams={summary.boxscore.teams} homeTeam={match.homeTeam} awayTeam={match.awayTeam} />
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-white/40">Team stats not available yet</p>
                <p className="text-xs text-white/25 mt-1">Stats will appear once the game data is loaded from ESPN</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Summary Tab ─────────────────────────────────────────────────────────────

function SummaryTab({ match, summary, venue }: { match: LiveMatch; summary: MatchSummary | null; venue?: string }) {
  const isUpcoming = match.status === "Not Started"
  const isIndividual = INDIVIDUAL_SPORTS.has(match.sport)

  return (
    <div className="space-y-4">
      {/* Upcoming Game Preview Header */}
      {isUpcoming && (
        <div className="rounded-xl bg-gradient-to-r from-[var(--color-lime)]/5 to-transparent border border-[var(--color-lime)]/10 p-4 text-center">
          <p className="text-xs font-bold text-[var(--color-lime)] uppercase tracking-wider mb-1">
            {isIndividual ? "Match Preview" : "Game Preview"}
          </p>
          <p className="text-sm text-white/70">
            {match.clock || "Time TBD"} · {match.league}
          </p>
        </div>
      )}

      {/* Sport-specific score display for individual sports (live/finished) */}
      {isIndividual && !isUpcoming && (
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-[var(--color-primary)]" />
            <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
              {match.sport === "Tennis" ? "Match Score" : match.sport === "MMA" ? "Fight Result" : "Result"}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
              <span className={cn(
                "text-sm font-bold",
                match.homeScore >= match.awayScore ? "text-white" : "text-white/50"
              )}>
                {match.homeTeam}
              </span>
              <span className={cn(
                "text-lg font-black tabular-nums",
                match.homeScore >= match.awayScore ? "text-[var(--color-lime)]" : "text-white/50"
              )}>
                {match.homeScore}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
              <span className={cn(
                "text-sm font-bold",
                match.awayScore >= match.homeScore ? "text-white" : "text-white/50"
              )}>
                {match.awayTeam}
              </span>
              <span className={cn(
                "text-lg font-black tabular-nums",
                match.awayScore >= match.homeScore ? "text-[var(--color-lime)]" : "text-white/50"
              )}>
                {match.awayScore}
              </span>
            </div>
          </div>
          {match.sport === "Tennis" && (
            <p className="text-[10px] text-white/30 text-center mt-2">Sets won</p>
          )}
        </div>
      )}

      {/* Match Info */}
      <div className="flex flex-wrap gap-3">
        {venue && (
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">
            <MapPin className="h-3.5 w-3.5 text-white/40" />
            <span>{venue}</span>
          </div>
        )}
        {summary?.broadcasts && summary.broadcasts.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">
            <Tv className="h-3.5 w-3.5 text-white/40" />
            <span>{summary.broadcasts.join(", ")}</span>
          </div>
        )}
      </div>

      {/* Odds */}
      {summary?.odds && (
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-[var(--color-primary)]" />
            <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Betting Lines</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {summary.odds.homeMoneyline && (
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-[10px] text-white/40 mb-1 truncate">{match.homeTeam}</p>
                <p className="text-sm font-black text-white">{summary.odds.homeMoneyline}</p>
              </div>
            )}
            {summary.odds.spread && (
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-[10px] text-white/40 mb-1">
                  {match.sport === "Tennis" ? "Game Spread" : "Spread"}
                </p>
                <p className="text-sm font-black text-white">{summary.odds.spread}</p>
              </div>
            )}
            {summary.odds.awayMoneyline && (
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-[10px] text-white/40 mb-1 truncate">{match.awayTeam}</p>
                <p className="text-sm font-black text-white">{summary.odds.awayMoneyline}</p>
              </div>
            )}
          </div>
          {summary.odds.overUnder && (
            <div className="mt-3 rounded-lg bg-white/5 p-3 text-center">
              <p className="text-[10px] text-white/40 mb-1">
                {match.sport === "Tennis" ? "Total Games" : "Over/Under"}
              </p>
              <p className="text-sm font-black text-white">{summary.odds.overUnder}</p>
            </div>
          )}
        </div>
      )}

      {/* Leaders */}
      {summary?.leaders && summary.leaders.length > 0 && (
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
          <span className="text-xs font-bold text-white/70 uppercase tracking-wider">
            {isIndividual ? "Key Stats" : "Game Leaders"}
          </span>
          <div className="mt-3 space-y-2">
            {summary.leaders.slice(0, 6).map((leader, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/50">
                    {leader.team}
                  </span>
                  <span className="text-sm font-semibold text-white truncate">{leader.name}</span>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="text-sm font-black text-white">{leader.value}</span>
                  <span className="text-[10px] text-white/40 ml-1">{leader.stat}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Headline */}
      {summary?.headline && (
        <p className="text-xs text-white/50 italic px-1">{summary.headline}</p>
      )}

      {/* Fallback for upcoming with no data */}
      {isUpcoming && !summary?.odds && !summary?.broadcasts && !venue && (
        <div className="text-center py-6">
          <p className="text-sm text-white/40">
            {isIndividual ? "Match details will be available closer to start" : "Game details will be available closer to tip-off"}
          </p>
          <p className="text-xs text-white/25 mt-1">Check back for odds, venue, and broadcast info</p>
        </div>
      )}

      {/* Fallback for individual sports with no summary data (live/finished) */}
      {isIndividual && !isUpcoming && !summary?.odds && !summary?.leaders && !venue && (
        <div className="text-center py-4">
          <p className="text-xs text-white/30">Detailed stats may not be available for this match</p>
        </div>
      )}
    </div>
  )
}

// ─── Box Score Tab ───────────────────────────────────────────────────────────

function BoxScoreTab({ players }: { players: NonNullable<MatchSummary["boxscore"]>["players"] }) {
  const [expandedTeam, setExpandedTeam] = useState<number>(0)

  return (
    <div className="space-y-4">
      {/* Team selector */}
      {players.length > 1 && (
        <div className="flex rounded-lg bg-white/5 p-1">
          {players.map((teamGroup, i) => (
            <button
              key={i}
              onClick={() => setExpandedTeam(i)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-xs font-bold transition-all",
                expandedTeam === i
                  ? "bg-[var(--color-primary)] text-white shadow-lg"
                  : "text-white/50 hover:text-white/80"
              )}
            >
              {teamGroup.team}
            </button>
          ))}
        </div>
      )}

      {/* Player stats table */}
      {players[expandedTeam] && (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left px-3 py-2.5 text-white/50 font-semibold sticky left-0 bg-[#1a0a4a] min-w-[130px] z-10">
                    Player
                  </th>
                  {players[expandedTeam].labels.map((label, li) => (
                    <th key={li} className="text-center px-2 py-2.5 text-white/50 font-semibold min-w-[40px] whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players[expandedTeam].athletes.map((athlete, ai) => (
                  <tr
                    key={ai}
                    className={cn(
                      "border-t border-white/5 transition-colors hover:bg-white/[0.03]",
                      ai === 0 && "bg-[var(--color-primary)]/5"
                    )}
                  >
                    <td className="px-3 py-2.5 sticky left-0 bg-[#1a0a4a] z-10">
                      <div className="flex items-center gap-2">
                        <span className="text-white/90 font-semibold truncate max-w-[90px]">
                          {athlete.name}
                        </span>
                        {athlete.position && (
                          <span className="text-[9px] font-medium text-white/30 bg-white/5 rounded px-1 py-0.5">
                            {athlete.position}
                          </span>
                        )}
                      </div>
                    </td>
                    {athlete.stats.map((stat, si) => (
                      <td
                        key={si}
                        className={cn(
                          "text-center px-2 py-2.5 tabular-nums",
                          si === 0 ? "text-white/80 font-semibold" : "text-white/60"
                        )}
                      >
                        {stat}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Team Stats Tab ──────────────────────────────────────────────────────────

function TeamStatsTab({
  teams,
  homeTeam,
  awayTeam,
}: {
  teams: NonNullable<MatchSummary["boxscore"]>["teams"]
  homeTeam: string
  awayTeam: string
}) {
  if (teams.length < 2) return null

  const team1 = teams[0]
  const team2 = teams[1]

  // Pair stats by label
  const pairedStats: Array<{ label: string; home: string; away: string }> = []
  const team2Map = new Map(team2.stats.map((s) => [s.label, s.value]))

  for (const stat of team1.stats) {
    pairedStats.push({
      label: stat.label,
      home: stat.value,
      away: team2Map.get(stat.label) ?? "-",
    })
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          {team1.logo && <img src={team1.logo} alt="" className="h-5 w-5 object-contain" />}
          <span className="text-xs font-bold text-white/80 truncate max-w-[100px]">{team1.team || homeTeam}</span>
        </div>
        <span className="text-[10px] font-bold text-white/30 uppercase">Stats</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white/80 truncate max-w-[100px]">{team2.team || awayTeam}</span>
          {team2.logo && <img src={team2.logo} alt="" className="h-5 w-5 object-contain" />}
        </div>
      </div>

      {/* Stat bars */}
      <div className="space-y-1">
        {pairedStats.slice(0, 12).map((stat, i) => {
          const homeVal = parseFloat(stat.home) || 0
          const awayVal = parseFloat(stat.away) || 0
          const total = homeVal + awayVal || 1
          const homePercent = (homeVal / total) * 100
          const awayPercent = (awayVal / total) * 100

          return (
            <div key={i} className="rounded-lg bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white/90 tabular-nums">{stat.home}</span>
                <span className="text-[10px] font-medium text-white/40">{stat.label}</span>
                <span className="text-xs font-bold text-white/90 tabular-nums">{stat.away}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5">
                <div
                  className="rounded-full transition-all duration-500"
                  style={{
                    width: `${homePercent}%`,
                    backgroundColor: homeVal >= awayVal ? "var(--color-primary)" : "rgba(255,255,255,0.15)",
                  }}
                />
                <div
                  className="rounded-full transition-all duration-500"
                  style={{
                    width: `${awayPercent}%`,
                    backgroundColor: awayVal > homeVal ? "var(--color-primary)" : "rgba(255,255,255,0.15)",
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
