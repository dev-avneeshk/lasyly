"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Trophy } from "lucide-react"
import { Game } from "@/lib/props/types"
import { EnhancedPropCardData } from "@/lib/analytics/types"
import { NBA_STAT_FILTERS, TENNIS_STAT_FILTERS, SOCCER_STAT_FILTERS, NFL_STAT_FILTERS, NHL_STAT_FILTERS, DEFAULT_STATS } from "@/lib/props/constants"
import { SportTabs } from "@/components/analysis/SportTabs"
import { GameStrip } from "@/components/analysis/GameStrip"
import { StatFilters } from "@/components/analysis/StatFilters"
import { PropCardGrid } from "@/components/analysis/PropCardGrid"
import { PlayerSearch } from "@/components/analysis/PlayerSearch"
import { MatchupStrip } from "@/components/props/MatchupStrip"
import { ParlayBuilder, ParlayLeg, ParlayState, canAddToParlay } from "@/components/props/ParlayBuilder"
import { StatsPanel } from "@/components/props/StatsPanel"
import { TodayGame } from "@/lib/analytics/engine-v2"
import { createClient } from "@/lib/supabase/client"
import { cachedFetch, readCache } from "@/lib/clientCache"

export default function AnalysisPage() {
  const supabase = useMemo(() => createClient(), [])

  // ─── Core state (initialize from cache to avoid skeleton flash) ─────────────
  const [sport, setSport] = useState<"NBA" | "Tennis" | "Soccer" | "NFL" | "NHL">("NBA")
  const [stat, setStat] = useState(DEFAULT_STATS.NBA)

  // Try to read cached props/games on mount to skip skeleton
  const cachedProps = readCache<{ props?: EnhancedPropCardData[]; todayGames?: TodayGame[] }>(`/api/props?sport=NBA&stat=all&direction=all`)
  const cachedGames = readCache<{ games?: Game[] }>(`/api/props/games?sport=NBA`)

  const [props, setProps] = useState<EnhancedPropCardData[]>(cachedProps?.props ?? [])
  const [games, setGames] = useState<Game[]>(cachedGames?.games ?? [])
  const [loading, setLoading] = useState(!cachedProps?.props?.length)
  const [gamesLoading, setGamesLoading] = useState(!cachedGames?.games?.length)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // ─── Matchup state (NBA only) ──────────────────────────────────────────────
  const [selectedMatchup, setSelectedMatchup] = useState<string | null>(null)
  const [todayGames, setTodayGames] = useState<TodayGame[]>(cachedProps?.todayGames ?? [])
  const [matchupStripLoading, setMatchupStripLoading] = useState(!cachedProps?.todayGames?.length)

  // ─── Parlay state ───────────────────────────────────────────────────────────
  const [parlayState, setParlayState] = useState<ParlayState>({
    legs: [],
    combinedHitRate: null,
    overlappingDates: 0,
    isVisible: false,
  })

  // ─── AI Writeup state ───────────────────────────────────────────────────────
  const [aiWriteups, setAiWriteups] = useState<
    Record<string, { writeup: string | null; loading: boolean; error: boolean; retryCount: number }>
  >({})

  // ─── Stats Panel state ──────────────────────────────────────────────────────
  const [statsPanelOpen, setStatsPanelOpen] = useState(false)
  const [statsPanelPlayer, setStatsPanelPlayer] = useState<string | null>(null)
  const [statsPanelStat, setStatsPanelStat] = useState<string | null>(null)
  const statsPanelTriggerRef = useRef<HTMLElement | null>(null)

  // ─── Direction toggle state ─────────────────────────────────────────────────
  const [directionToggle, setDirectionToggle] = useState<"all" | "over" | "under">("all")

  // ─── Derived values ─────────────────────────────────────────────────────────
  const parlayPropIds = useMemo(() => new Set(parlayState.legs.map((l) => l.propId)), [parlayState.legs])
  const parlayFull = parlayState.legs.length >= 10

  // ─── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)
    }
    checkAuth()
  }, [supabase])

  // ─── Reset stat when sport changes ──────────────────────────────────────────
  useEffect(() => {
    setStat(DEFAULT_STATS[sport])
    setSelectedMatchup(null)
    setDirectionToggle("all")

    // Try to read cached data for the new sport to avoid skeleton flash
    const sportPropsCache = readCache<{ props?: EnhancedPropCardData[]; todayGames?: TodayGame[] }>(`/api/props?sport=${sport}&stat=all&direction=all`)
    const sportGamesCache = readCache<{ games?: Game[] }>(`/api/props/games?sport=${sport}`)

    if (sportPropsCache?.props?.length) {
      setProps(sportPropsCache.props)
      setLoading(false)
      if (sport === "NBA" && sportPropsCache.todayGames) {
        setTodayGames(sportPropsCache.todayGames)
        setMatchupStripLoading(false)
      }
    } else {
      setTodayGames([])
      setProps([])
      setLoading(true)
    }

    if (sportGamesCache?.games?.length) {
      setGames(sportGamesCache.games)
      setGamesLoading(false)
    }
  }, [sport])

  // ─── Fetch games ────────────────────────────────────────────────────────────
  const fetchGames = useCallback(async () => {
    const url = `/api/props/games?sport=${sport}`
    // Only show loading if we don't already have games displayed
    if (games.length === 0) setGamesLoading(true)
    try {
      const data = await cachedFetch<{ games?: Game[] }>(url, 120_000)
      setGames(data.games ?? [])
    } catch {
      // silently fail
    } finally {
      setGamesLoading(false)
    }
  }, [sport, games.length])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  // ─── Fetch props ─────────────────────────────────────────────────────────────
  const fetchProps = useCallback(async () => {
    // Only show skeleton if we don't already have props displayed
    if (props.length === 0) {
      setLoading(true)
      if (sport === "NBA") setMatchupStripLoading(true)
    }
    const params = new URLSearchParams()
    params.set("sport", sport)
    params.set("stat", stat)
    params.set("direction", directionToggle)

    // Matchup filter (NBA only)
    if (sport === "NBA" && selectedMatchup) {
      params.set("matchup", selectedMatchup)
    }

    try {
      const url = `/api/props?${params.toString()}`
      // Cache props for 60 seconds
      const data = await cachedFetch<{ props?: EnhancedPropCardData[]; todayGames?: TodayGame[] }>(url, 60_000)
      setProps(data.props ?? [])
      // Extract todayGames from NBA response
      if (sport === "NBA" && data.todayGames) {
        setTodayGames(data.todayGames)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
      if (sport === "NBA") setMatchupStripLoading(false)
    }
  }, [sport, stat, selectedMatchup, directionToggle, props.length])

  useEffect(() => {
    fetchProps()
  }, [fetchProps])

  // ─── Parlay handlers ────────────────────────────────────────────────────────

  const handleAddToParlay = useCallback(async (prop: EnhancedPropCardData) => {
    const validation = canAddToParlay(parlayState.legs, prop.id)
    if (!validation.canAdd) return

    // Find L10 hit rate: prefer hitRateWindows if available, fallback to hitRate field
    const l10Window = prop.hitRateWindows?.find((w) => w.window === "L10")
    let l10HitRate: number
    if (l10Window?.available) {
      l10HitRate = l10Window.hitRate
    } else if (prop.hitRate && prop.hitRate.total > 0) {
      // Fallback: use the base hitRate (which is L10 from engine-v2)
      l10HitRate = Math.round((prop.hitRate.over / prop.hitRate.total) * 100)
    } else {
      l10HitRate = 0
    }

    const newLeg: ParlayLeg = {
      propId: prop.id,
      player: prop.player,
      statCategory: prop.statCategory,
      propLine: prop.propLine,
      direction: prop.direction ?? "over",
      l10HitRate,
      isWeakLink: false,
    }

    const newLegs = [...parlayState.legs, newLeg]

    // Optimistic update
    setParlayState((prev) => ({
      ...prev,
      legs: newLegs,
      isVisible: true,
    }))

    // Fetch parlay stats from API if 2+ legs
    if (newLegs.length >= 2) {
      try {
        const res = await fetch("/api/props/parlay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legs: newLegs.map((l) => ({ propId: l.propId, direction: l.direction })),
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setParlayState((prev) => ({
            ...prev,
            combinedHitRate: data.combinedHitRate,
            overlappingDates: data.overlappingDates ?? 0,
            legs: prev.legs.map((leg) => {
              const legData = data.legs?.find((l: { propId: string }) => l.propId === leg.propId)
              if (legData) {
                return {
                  ...leg,
                  l10HitRate: legData.l10HitRate ?? leg.l10HitRate,
                  isWeakLink: legData.isWeakLink ?? false,
                  correlationFlag: legData.correlationFlag,
                }
              }
              return leg
            }),
          }))
        }
      } catch {
        // Keep optimistic state
      }
    }
  }, [parlayState.legs])

  const handleRemoveLeg = useCallback(async (propId: string) => {
    const newLegs = parlayState.legs.filter((l) => l.propId !== propId)

    if (newLegs.length === 0) {
      setParlayState({
        legs: [],
        combinedHitRate: null,
        overlappingDates: 0,
        isVisible: false,
      })
      return
    }

    setParlayState((prev) => ({
      ...prev,
      legs: newLegs,
      isVisible: true,
    }))

    // Re-fetch parlay stats if 2+ legs remain
    if (newLegs.length >= 2) {
      try {
        const res = await fetch("/api/props/parlay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legs: newLegs.map((l) => ({ propId: l.propId, direction: l.direction })),
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setParlayState((prev) => ({
            ...prev,
            combinedHitRate: data.combinedHitRate,
            overlappingDates: data.overlappingDates ?? 0,
            legs: prev.legs.map((leg) => {
              const legData = data.legs?.find((l: { propId: string }) => l.propId === leg.propId)
              if (legData) {
                return {
                  ...leg,
                  l10HitRate: legData.l10HitRate ?? leg.l10HitRate,
                  isWeakLink: legData.isWeakLink ?? false,
                  correlationFlag: legData.correlationFlag,
                }
              }
              return leg
            }),
          }))
        }
      } catch {
        // Keep current state
      }
    } else {
      // Single leg: reset combined stats
      setParlayState((prev) => ({
        ...prev,
        combinedHitRate: null,
        overlappingDates: 0,
      }))
    }
  }, [parlayState.legs])

  const handleClearParlay = useCallback(() => {
    setParlayState({
      legs: [],
      combinedHitRate: null,
      overlappingDates: 0,
      isVisible: false,
    })
  }, [])

  // ─── Sentiment vote handler ─────────────────────────────────────────────────

  const handleVote = useCallback(async (propId: string, direction: "over" | "under") => {
    if (!isAuthenticated) return

    // Find the prop to get its identifier
    const prop = props.find((p) => p.id === propId)
    if (!prop) return

    const propIdentifier = `${prop.player}-${prop.statCategory}`

    try {
      const res = await fetch("/api/props/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propIdentifier, direction }),
      })

      if (res.ok) {
        const data = await res.json()
        // Update local sentiment data for this prop
        setProps((prev) =>
          prev.map((p) => {
            if (p.id !== propId) return p
            const total = (data.totals?.over ?? 0) + (data.totals?.under ?? 0)
            return {
              ...p,
              sentiment: {
                overPct: total > 0 ? Math.round(((data.totals?.over ?? 0) / total) * 100) : 50,
                underPct: total > 0 ? Math.round(((data.totals?.under ?? 0) / total) * 100) : 50,
                totalVotes: total,
                userVote: direction,
                hasMinVotes: total >= 5,
              },
            }
          })
        )
      }
    } catch {
      // Don't update state on error (Requirement 9.8)
    }
  }, [isAuthenticated, props])

  // ─── AI Writeup handlers ────────────────────────────────────────────────────

  const handleAIExpand = useCallback(async (propId: string) => {
    // If already loaded or loading, skip
    if (aiWriteups[propId]?.writeup || aiWriteups[propId]?.loading) return

    setAiWriteups((prev) => ({
      ...prev,
      [propId]: { writeup: null, loading: true, error: false, retryCount: 0 },
    }))

    try {
      const res = await fetch(`/api/props/ai-writeup?propId=${encodeURIComponent(propId)}`)
      if (res.ok) {
        const data = await res.json()
        setAiWriteups((prev) => ({
          ...prev,
          [propId]: { writeup: data.writeup ?? null, loading: false, error: !!data.error, retryCount: 0 },
        }))
      } else {
        setAiWriteups((prev) => ({
          ...prev,
          [propId]: { writeup: null, loading: false, error: true, retryCount: 0 },
        }))
      }
    } catch {
      setAiWriteups((prev) => ({
        ...prev,
        [propId]: { writeup: null, loading: false, error: true, retryCount: 0 },
      }))
    }
  }, [aiWriteups])

  const handleAIRetry = useCallback(async (propId: string) => {
    const current = aiWriteups[propId]
    const retryCount = (current?.retryCount ?? 0) + 1
    if (retryCount > 3) return

    setAiWriteups((prev) => ({
      ...prev,
      [propId]: { writeup: null, loading: true, error: false, retryCount },
    }))

    try {
      const res = await fetch(`/api/props/ai-writeup?propId=${encodeURIComponent(propId)}`)
      if (res.ok) {
        const data = await res.json()
        setAiWriteups((prev) => ({
          ...prev,
          [propId]: { writeup: data.writeup ?? null, loading: false, error: !!data.error, retryCount },
        }))
      } else {
        setAiWriteups((prev) => ({
          ...prev,
          [propId]: { writeup: null, loading: false, error: true, retryCount },
        }))
      }
    } catch {
      setAiWriteups((prev) => ({
        ...prev,
        [propId]: { writeup: null, loading: false, error: true, retryCount },
      }))
    }
  }, [aiWriteups])

  // ─── Log Pick handler ───────────────────────────────────────────────────────

  const handleLogPick = useCallback((prop: EnhancedPropCardData) => {
    if (!isAuthenticated) {
      // Redirect to login
      window.location.href = "/login"
      return
    }
    // Navigate to bets page with pre-filled data via query params
    const params = new URLSearchParams({
      player: prop.player,
      sport: prop.sport,
      stat: prop.statCategory,
      line: String(prop.propLine),
      direction: prop.direction ?? "over",
      confidence: String(prop.confidence?.stars ?? 0),
      grade: prop.matchupGrade ?? "",
    })
    window.location.href = `/bets?log=true&${params.toString()}`
  }, [isAuthenticated])

  // ─── Correlation tap handler ────────────────────────────────────────────────

  const handleCorrelationTap = useCallback((propId: string) => {
    // The CorrelationsSection component handles scroll + highlight internally
    // This callback is available for additional logic if needed
  }, [])

  // ─── Stats Panel handler ──────────────────────────────────────────────────────

  const handlePropCardClick = useCallback((prop: EnhancedPropCardData, triggerElement: HTMLElement) => {
    statsPanelTriggerRef.current = triggerElement
    setStatsPanelPlayer(prop.player)
    setStatsPanelStat(prop.statCategory)
    setStatsPanelOpen(true)
  }, [])

  const handleStatsPanelClose = useCallback(() => {
    setStatsPanelOpen(false)
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────────

  const statFilters = sport === "NBA" ? NBA_STAT_FILTERS
    : sport === "Soccer" ? SOCCER_STAT_FILTERS
    : sport === "NFL" ? NFL_STAT_FILTERS
    : sport === "NHL" ? NHL_STAT_FILTERS
    : TENNIS_STAT_FILTERS

  const emptyMessage = "Try a different stat filter or search term. Props are generated from recent game data."

  // ─── Direction toggle handler ───────────────────────────────────────────────
  const handleDirectionToggle = useCallback((dir: "all" | "over" | "under") => {
    setDirectionToggle(dir)
  }, [])

  return (
    <div className="min-h-screen max-w-[1400px] mx-auto text-white font-sans flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 md:px-6 lg:px-8 pt-6 pb-4">
        <Trophy className="w-5 h-5 text-[var(--color-lime)]" />
        <h1 className="text-xl font-black italic tracking-tighter text-[var(--color-lime)] uppercase">
          LASYLY PRO
        </h1>
      </header>

      {/* Main Content */}
      <div className="px-4 md:px-6 lg:px-8 pb-8 flex-1 flex flex-col gap-5">
        {/* Sport Tabs */}
        <SportTabs activeSport={sport} onSportChange={setSport} />

        {/* Tennis: Coming Soon */}
        {sport === "Tennis" ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-full bg-[var(--color-lime)]/10 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-[var(--color-lime)]" />
            </div>
            <h2 className="text-xl font-bold text-white">Coming Soon</h2>
            <p className="text-sm text-[var(--color-text-muted)] text-center max-w-md">
              Tennis props and analytics are currently in development. Check back soon for player stats, match predictions, and more.
            </p>
          </div>
        ) : (
          <>
            {/* Game Strip with Date Navigation (all sports) */}
            <GameStrip games={games} loading={gamesLoading} sport={sport} />

            {/* NBA Matchup Filter (select a specific game to filter props) */}
            {sport === "NBA" && !matchupStripLoading && todayGames.length > 0 && (
              <MatchupStrip
                games={todayGames}
                selectedMatchup={selectedMatchup}
                onSelectMatchup={setSelectedMatchup}
              />
            )}

            {/* Stat Filters */}
            <StatFilters filters={statFilters} activeStat={stat} onStatChange={setStat} />

            {/* Over / Under / All Direction Toggle */}
            <div className="flex items-center gap-1 bg-[var(--color-surface)] rounded-xl p-1 border border-white/5 w-fit">
              <button
                onClick={() => handleDirectionToggle("all")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  directionToggle === "all"
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleDirectionToggle("over")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  directionToggle === "over"
                    ? "bg-[var(--color-lime)]/20 text-[var(--color-lime)]"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                Over
              </button>
              <button
                onClick={() => handleDirectionToggle("under")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  directionToggle === "under"
                    ? "bg-[var(--color-danger)]/20 text-[var(--color-danger)]"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                Under
              </button>
            </div>

            {/* Search */}
            <PlayerSearch sport={sport} />

            {/* Props Grid */}
            <PropCardGrid
              props={props}
              loading={loading}
              onAddToParlay={handleAddToParlay}
              onLogPick={handleLogPick}
              onVote={handleVote}
              onAIExpand={handleAIExpand}
              onCorrelationTap={handleCorrelationTap}
              onAIRetry={handleAIRetry}
              onPropCardClick={handlePropCardClick}
              isAuthenticated={isAuthenticated}
              parlayPropIds={parlayPropIds}
              parlayFull={parlayFull}
              aiWriteups={aiWriteups}
              emptyMessage={emptyMessage}
            />
          </>
        )}
      </div>

      {/* Parlay Builder Bottom Sheet */}
      <ParlayBuilder
        state={parlayState}
        onRemoveLeg={handleRemoveLeg}
        onClear={handleClearParlay}
      />

      {/* Stats Reference Panel */}
      <StatsPanel
        isOpen={statsPanelOpen}
        playerName={statsPanelPlayer}
        statCategory={statsPanelStat}
        onClose={handleStatsPanelClose}
        triggerRef={statsPanelTriggerRef}
      />
    </div>
  )
}
