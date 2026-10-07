"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { X, MapPin, Tv, BarChart3, Users2, Clock } from "lucide-react"
import { LiveMatch, MatchSummary } from "@/types"
import { cn } from "@/lib/utils"
import { formatMatchTime, formatDay, formatDateReadable, formatTime } from "@/lib/datetime"
import { alignHomeAway, orderHomeFirst } from "@/lib/scores/alignTeams"

interface MatchDetailModalProps {
  match: LiveMatch | null
  onClose: () => void
}

type Tab = "summary" | "boxscore" | "stats" | "standings"

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

// Sports that are individual (no team stats or box score)
const INDIVIDUAL_SPORTS = new Set(["Tennis", "MMA", "Golf", "F1"])

// Sports where box scores (individual player stats) make sense
const BOX_SCORE_SPORTS = new Set(["Basketball", "American Football", "Hockey", "Baseball"])

function getTabsForSport(
  sport: string
): { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] {
  if (INDIVIDUAL_SPORTS.has(sport)) {
    // Individual sports: match info only
    return [
      { id: "summary", label: "Match Info", icon: <Clock className="h-3.5 w-3.5" />, show: true },
    ]
  }

  // Team sports: show relevant tabs
  // Only show Box Score for sports that actually have player-level stats
  const showBoxScore = BOX_SCORE_SPORTS.has(sport)

  return [
    { id: "stats", label: "Team Stats", icon: <Users2 className="h-3.5 w-3.5" />, show: true },
    { id: "boxscore", label: "Box Score", icon: <BarChart3 className="h-3.5 w-3.5" />, show: showBoxScore },
    { id: "standings", label: "Standings", icon: <Clock className="h-3.5 w-3.5" />, show: true },
  ]
}

function TeamLogo({ url, name, color, size = "lg" }: { url?: string; name: string; color?: string; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-16 w-16" : "h-8 w-8"
  const textSize = size === "lg" ? "text-lg" : "text-[10px]"

  if (url) {
    return (
      <div className={cn("relative grid place-items-center", dim)}>
        {color && (
          <div
            className="absolute inset-0 rounded-full opacity-30 blur-xl"
            style={{ backgroundColor: `#${color}` }}
          />
        )}
        {/* Subtle ring so light logos still read against the dark surface */}
        <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
        <img
          src={url}
          alt={name}
          className={cn("relative object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]", size === "lg" ? "h-12 w-12" : "h-6 w-6")}
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-black ring-1 ring-inset ring-white/10",
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
  const isUpcoming = match.status === "Not Started"

  const tabs: { id: Tab; label: string; icon: React.ReactNode; show: boolean }[] = isUpcoming
    ? [{ id: "summary", label: "Preview", icon: <Clock className="h-3.5 w-3.5" />, show: true }]
    : getTabsForSport(match.sport)
  const visibleTabs = tabs.filter((t) => t.show)

  // ESPN lists boxscore entries away-first; bind them to the header's sides
  // (home left, away right) by flag/name rather than array position.
  const alignedTeams = summary?.boxscore?.teams ? alignHomeAway(summary.boxscore.teams, match) : null
  const playersHomeFirst = summary?.boxscore?.players ? orderHomeFirst(summary.boxscore.players, match) : []

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
      <div className="w-full max-w-lg max-h-[90vh] rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
        {/* Scoreboard Header */}
        {/* shrink-0: tall tab content must scroll, never compress the header
            (overflow-hidden makes its min-height 0, which clipped the names). */}
        <div className="relative shrink-0 overflow-hidden">
          {/* Team-color wash — the one committed color moment, kept low and
              anchored to the two teams' actual brand colors. */}
          <div className="absolute inset-0">
            <div
              className="absolute inset-0 opacity-[0.22]"
              style={{
                background: `radial-gradient(120% 90% at 12% 0%, ${match.homeColor ? `#${match.homeColor}` : "var(--color-primary)"} 0%, transparent 55%), radial-gradient(120% 90% at 88% 0%, ${match.awayColor ? `#${match.awayColor}` : "var(--color-secondary)"} 0%, transparent 55%)`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-surface)]/40 to-[var(--color-surface)]" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-3.5 top-3.5 z-10 grid place-items-center h-8 w-8 rounded-full bg-black/20 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* League & Status */}
          <div className="relative pt-6 pb-1 flex flex-col items-center gap-2">
            <span className="text-[11px] font-semibold text-white/55 uppercase tracking-[0.18em]">
              {match.league}
            </span>
            {live && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success)]/15 px-2.5 py-1 border border-[var(--color-success)]/30">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                </span>
                <span className="text-[10px] font-bold tracking-wide text-[var(--color-success)]">{match.clock || "LIVE"}</span>
              </span>
            )}
            {match.status === "Finished" && (
              <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-white/55">
                FINAL
              </span>
            )}
            {match.status === "Not Started" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-lime)]/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-[var(--color-lime)]">
                <Clock className="h-3 w-3" />
                {match.startTime
                  ? formatMatchTime(match.startTime)
                  : "SCHEDULED"}
              </span>
            )}
          </div>

          {/* Score Display */}
          <div className="relative px-3 sm:px-6 pb-7 pt-3">
            <div className="flex items-start justify-between gap-1.5 sm:gap-2">
              {/* Home Team */}
              <div className="flex-1 basis-0 min-w-0 flex flex-col items-center gap-2.5">
                <TeamLogo url={match.homeLogo} name={match.homeTeam} color={match.homeColor} />
                <span
                  className="w-full break-words text-[12px] sm:text-[13px] font-bold text-white/90 text-center leading-tight"
                  title={match.homeTeam}
                >
                  {match.homeTeam}
                </span>
              </div>

              {/* Score */}
              <div className="flex-shrink-0 px-1 sm:px-2 pt-3 text-center">
                {match.status === "Not Started" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-white/25 tracking-wider">VS</span>
                    {match.startTime && (
                      <p className="mt-1.5 text-[11px] font-medium text-white/45">
                        {formatDay(match.startTime)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 sm:gap-2.5">
                    <span className={cn(
                      "text-3xl sm:text-5xl font-black tabular-nums leading-none transition-colors",
                      match.homeScore > match.awayScore
                        ? "text-[var(--color-lime)]"
                        : match.homeScore === match.awayScore ? "text-white" : "text-white/40"
                    )}>
                      {match.homeScore}
                    </span>
                    <span className="text-xl sm:text-2xl text-white/20 font-light leading-none">–</span>
                    <span className={cn(
                      "text-3xl sm:text-5xl font-black tabular-nums leading-none transition-colors",
                      match.awayScore > match.homeScore
                        ? "text-[var(--color-lime)]"
                        : match.awayScore === match.homeScore ? "text-white" : "text-white/40"
                    )}>
                      {match.awayScore}
                    </span>
                  </div>
                )}
              </div>

              {/* Away Team */}
              <div className="flex-1 basis-0 min-w-0 flex flex-col items-center gap-2.5">
                <TeamLogo url={match.awayLogo} name={match.awayTeam} color={match.awayColor} />
                <span
                  className="w-full break-words text-[12px] sm:text-[13px] font-bold text-white/90 text-center leading-tight"
                  title={match.awayTeam}
                >
                  {match.awayTeam}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs — segmented control */}
        {!loading && !fetchError && visibleTabs.length > 1 && (
          <div className="shrink-0 px-4 pt-3 pb-1">
            <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-all duration-150",
                    activeTab === tab.id
                      ? "bg-[var(--color-primary)] text-white shadow-[0_2px_10px_-2px_var(--color-primary)]"
                      : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]"
                  )}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="space-y-3 py-2">
              {/* Skeleton rows — matches the stat-bar layout users are about to see */}
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="h-3 w-6 rounded bg-white/[0.06]" />
                    <div className="h-2.5 w-16 rounded bg-white/[0.05]" />
                    <div className="h-3 w-6 rounded bg-white/[0.06]" />
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.04]" />
                </div>
              ))}
            </div>
          )}

          {fetchError && !loading && (
            <div className="flex flex-col items-center text-center py-10">
              <div className="grid place-items-center h-11 w-11 rounded-full bg-white/[0.04] mb-3">
                <BarChart3 className="h-5 w-5 text-white/25" />
              </div>
              <p className="text-sm font-semibold text-white/55">Detailed stats unavailable</p>
              <p className="text-xs text-white/30 mt-1 max-w-[240px]">Live data for this match hasn&apos;t been published yet. Check back closer to game time.</p>
            </div>
          )}

          {!loading && !fetchError && activeTab === "summary" && (
            <SummaryTab match={match} summary={summary} venue={venue} />
          )}

          {!loading && !fetchError && activeTab === "boxscore" && (
            playersHomeFirst.length > 0 ? (
              <BoxScoreTab players={playersHomeFirst} />
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-white/40">Box score not available yet</p>
                <p className="text-xs text-white/25 mt-1">Player stats will appear once loaded from ESPN</p>
              </div>
            )
          )}

          {!loading && !fetchError && activeTab === "stats" && (
            alignedTeams ? (
              <TeamStatsTab
                home={alignedTeams.home}
                away={alignedTeams.away}
                homeTeam={match.homeTeam}
                awayTeam={match.awayTeam}
                homeColor={match.homeColor}
                awayColor={match.awayColor}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-white/40">Team stats not available yet</p>
                <p className="text-xs text-white/25 mt-1">Stats will appear once the game data is loaded from ESPN</p>
              </div>
            )
          )}

          {!loading && !fetchError && activeTab === "standings" && (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-white/15 mx-auto mb-3" />
              <p className="text-sm text-white/40">Standings not available</p>
              <p className="text-xs text-white/25 mt-1">League standings data is not available for this match</p>
            </div>
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
            {match.startTime
              ? `${formatDateReadable(match.startTime)}, ${formatTime(match.startTime)}`
              : "Time TBD"}{" "}
            · {match.league}
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
      {isUpcoming && !summary?.broadcasts && !venue && (
        <div className="text-center py-6">
          <p className="text-sm text-white/40">
            {isIndividual ? "Match details will be available closer to start" : "Game details will be available closer to tip-off"}
          </p>
          <p className="text-xs text-white/25 mt-1">Check back for venue and broadcast info</p>
        </div>
      )}

      {/* Fallback for individual sports with no summary data (live/finished) */}
      {isIndividual && !isUpcoming && !summary?.leaders && !venue && (
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
                  <th className="text-left px-3 py-2.5 text-white/50 font-semibold sticky left-0 bg-[var(--color-surface)] min-w-[130px] z-10">
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
                    <td className="px-3 py-2.5 sticky left-0 bg-[var(--color-surface)] z-10">
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

type TeamStatsEntry = NonNullable<MatchSummary["boxscore"]>["teams"][number]

function TeamStatsTab({
  home,
  away,
  homeTeam,
  awayTeam,
  homeColor,
  awayColor,
}: {
  /** Entry for the header's left (home) team. */
  home: TeamStatsEntry | null
  /** Entry for the header's right (away) team. */
  away: TeamStatsEntry | null
  homeTeam: string
  awayTeam: string
  homeColor?: string
  awayColor?: string
}) {
  if (!home || !away) return null

  // Each team's brand color, with sensible on-brand fallbacks.
  const homeHex = homeColor ? `#${homeColor}` : "var(--color-primary)"
  const awayHex = awayColor ? `#${awayColor}` : "var(--color-secondary)"

  // Pair stats by label
  const pairedStats: Array<{ label: string; home: string; away: string }> = []
  const awayMap = new Map(away.stats.map((s) => [s.label, s.value]))

  for (const stat of home.stats) {
    pairedStats.push({
      label: stat.label,
      home: stat.value,
      away: awayMap.get(stat.label) ?? "-",
    })
  }

  return (
    <div className="space-y-4">
      {/* Team header with color chips */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {home.logo
            ? <img src={home.logo} alt="" className="h-5 w-5 object-contain shrink-0" />
            : <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: homeHex }} />}
          <span className="text-xs font-bold text-white/85 truncate">{home.team || homeTeam}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span className="text-xs font-bold text-white/85 truncate">{away.team || awayTeam}</span>
          {away.logo
            ? <img src={away.logo} alt="" className="h-5 w-5 object-contain shrink-0" />
            : <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: awayHex }} />}
        </div>
      </div>

      {/* Stat bars — dual, colored by each team, leader gets full opacity */}
      <div className="space-y-3.5">
        {pairedStats.slice(0, 12).map((stat, i) => {
          const homeVal = parseFloat(stat.home) || 0
          const awayVal = parseFloat(stat.away) || 0
          const total = homeVal + awayVal || 1
          const homePercent = (homeVal / total) * 100
          const awayPercent = (awayVal / total) * 100
          const homeLeads = homeVal > awayVal
          const awayLeads = awayVal > homeVal

          return (
            <div key={i}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className={cn(
                  "text-sm font-black tabular-nums transition-colors",
                  homeLeads ? "text-white" : "text-white/45"
                )}>
                  {stat.home}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{stat.label}</span>
                <span className={cn(
                  "text-sm font-black tabular-nums transition-colors",
                  awayLeads ? "text-white" : "text-white/45"
                )}>
                  {stat.away}
                </span>
              </div>
              {/* Two bars growing from the center outward */}
              <div className="flex items-center gap-1">
                <div className="flex-1 flex justify-end h-2 rounded-l-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full rounded-l-full transition-all duration-500 ease-out"
                    style={{
                      width: `${homePercent}%`,
                      backgroundColor: homeHex,
                      opacity: homeLeads ? 1 : 0.4,
                    }}
                  />
                </div>
                <div className="flex-1 flex justify-start h-2 rounded-r-full bg-white/[0.04] overflow-hidden">
                  <div
                    className="h-full rounded-r-full transition-all duration-500 ease-out"
                    style={{
                      width: `${awayPercent}%`,
                      backgroundColor: awayHex,
                      opacity: awayLeads ? 1 : 0.4,
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
