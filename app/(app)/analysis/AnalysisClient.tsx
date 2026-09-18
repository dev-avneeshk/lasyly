"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react"
import { Game } from "@/lib/props/types"
import { EnhancedPropCardData } from "@/lib/analytics/types"
import { NBA_STAT_FILTERS, TENNIS_STAT_FILTERS, SOCCER_STAT_FILTERS, NFL_STAT_FILTERS, NHL_STAT_FILTERS, DEFAULT_STATS, STAT_LABELS } from "@/lib/props/constants"
import { todayIso as resolveTodayIso } from "@/lib/props/dates"
import { shareProp } from "@/lib/props/share"
import { PropsHeader } from "@/components/analysis/PropsHeader"
import { GameStrip } from "@/components/analysis/GameStrip"
import { StatFilters } from "@/components/analysis/StatFilters"
import { PropCardGrid } from "@/components/analysis/PropCardGrid"
import { PlayerSearch } from "@/components/analysis/PlayerSearch"
import { PropsToolbar, PropSortKey, PropViewMode } from "@/components/analysis/PropsToolbar"
import { NBAFilters, NBAFilterValues } from "@/components/analysis/NBAFilters"
import { ParlayBuilder, ParlayLeg, ParlayState, canAddToParlay } from "@/components/props/ParlayBuilder"
import { AuthRequiredDialog } from "@/components/auth/AuthGate"
import { StatsPanel } from "@/components/props/StatsPanel"
import { TodayGame } from "@/lib/analytics/engine-v2"
import { cachedFetch, readCache } from "@/lib/clientCache"

const SPORTS = ["NBA", "Tennis", "Soccer", "NFL", "NHL"] as const
type Sport = (typeof SPORTS)[number]

const VIEW_MODE_STORAGE_KEY = "lasyly:props-view-mode"

function normalizeSport(value?: string): Sport {
  const match = SPORTS.find((s) => s.toLowerCase() === (value ?? "").toLowerCase())
  return match ?? "NFL"
}

/** L10 hit rate as a 0–100 number, falling back to the base hit rate. */
function l10HitRateOf(prop: EnhancedPropCardData): number {
  const window = prop.hitRateWindows?.find((w) => w.window === "L10")
  if (window?.available) return window.hitRate
  if (prop.hitRate && prop.hitRate.total > 0) {
    return Math.round((prop.hitRate.over / prop.hitRate.total) * 100)
  }
  return 0
}

type AnalysisClientProps = {
  isAuthenticated: boolean
  initialSearch?: string
  /** Sport from the `?sport=` param — the top-bar tabs drive this. */
  initialSport?: string
}

export default function AnalysisClient({
  isAuthenticated,
  initialSearch = "",
  initialSport,
}: AnalysisClientProps) {
  // ─── Core state ─────────────────────────────────────────────────────────────
  // Sport is derived from the URL rather than held in state, so the top-bar
  // tabs stay the single source of truth and the selection is shareable.
  const sport = normalizeSport(initialSport)
  const [stat, setStat] = useState(DEFAULT_STATS[sport])

  // Resolved once so the header and game strip agree on "today".
  const [todayIso] = useState(() => resolveTodayIso())
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const isToday = selectedDate === todayIso

  // Try to read cached props/games on mount to skip skeleton
  const cachedProps = readCache<{ props?: EnhancedPropCardData[]; todayGames?: TodayGame[] }>(`/api/props?sport=${normalizeSport(initialSport)}&stat=all&direction=all`)
  const cachedGames = readCache<{ games?: Game[] }>(`/api/props/games?sport=${normalizeSport(initialSport)}`)

  const [props, setProps] = useState<EnhancedPropCardData[]>(cachedProps?.props ?? [])
  const [games, setGames] = useState<Game[]>(cachedGames?.games ?? [])
  const [loading, setLoading] = useState(!cachedProps?.props?.length)
  const [gamesLoading, setGamesLoading] = useState(!cachedGames?.games?.length)
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  // ─── Matchup state (NBA + NFL) ─────────────────────────────────────────────
  const [selectedMatchup, setSelectedMatchup] = useState<string | null>(null)
  const [todayGames, setTodayGames] = useState<TodayGame[]>(cachedProps?.todayGames ?? [])

  // ─── Presentation state ─────────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState<PropSortKey>("popularity")
  const [viewMode, setViewMode] = useState<PropViewMode>("grid")

  // Restore the last used layout after mount (avoids a hydration mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
      if (saved === "grid" || saved === "list") setViewMode(saved)
    } catch {
      // localStorage unavailable (private mode) — keep the default.
    }
  }, [])

  const handleViewModeChange = useCallback((mode: PropViewMode) => {
    setViewMode(mode)
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
    } catch {
      // Non-fatal — the choice just won't persist.
    }
  }, [])

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

  // ─── NBA advanced filters state ────────────────────────────────────────────
  const [nbaFilters, setNbaFilters] = useState<NBAFilterValues>({
    minMinutes: 0,
    vsOpponent: false,
    withoutPlayer: "",
  })

  // Debounced version of nbaFilters for API calls (avoids firing on every keystroke)
  const [debouncedNbaFilters, setDebouncedNbaFilters] = useState<NBAFilterValues>(nbaFilters)
  const nbaFiltersTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Debounce only the withoutPlayer text input (300ms)
    // Minutes and vsOpponent apply immediately
    if (nbaFilters.withoutPlayer !== debouncedNbaFilters.withoutPlayer) {
      if (nbaFiltersTimeoutRef.current) clearTimeout(nbaFiltersTimeoutRef.current)
      nbaFiltersTimeoutRef.current = setTimeout(() => {
        setDebouncedNbaFilters(nbaFilters)
      }, 500)
    } else {
      setDebouncedNbaFilters(nbaFilters)
    }
    return () => {
      if (nbaFiltersTimeoutRef.current) clearTimeout(nbaFiltersTimeoutRef.current)
    }
  }, [nbaFilters])

  // ─── Derived values ─────────────────────────────────────────────────────────
  const parlayPropIds = useMemo(() => new Set(parlayState.legs.map((l) => l.propId)), [parlayState.legs])
  const parlayFull = parlayState.legs.length >= 10

  /** Kickoff time per team abbreviation, for the card's game line. */
  const gameTimeByTeam = useMemo(() => {
    const map: Record<string, string> = {}
    for (const game of todayGames) {
      if (!game.gameTime) continue
      map[game.homeTeam.toUpperCase()] = game.gameTime
      map[game.awayTeam.toUpperCase()] = game.gameTime
    }
    return map
  }, [todayGames])

  const sortedProps = useMemo(() => {
    const list = [...props]
    switch (sortBy) {
      case "hitRate":
        return list.sort((a, b) => l10HitRateOf(b) - l10HitRateOf(a))
      case "confidence":
        return list.sort((a, b) => (b.confidence?.stars ?? 0) - (a.confidence?.stars ?? 0))
      case "line":
        return list.sort((a, b) => b.propLine - a.propLine)
      case "name":
        return list.sort((a, b) => a.player.localeCompare(b.player))
      case "popularity":
      default:
        return list.sort((a, b) => {
          const byVotes = (b.sentiment?.totalVotes ?? 0) - (a.sentiment?.totalVotes ?? 0)
          if (byVotes !== 0) return byVotes
          const byConfidence = (b.confidence?.stars ?? 0) - (a.confidence?.stars ?? 0)
          if (byConfidence !== 0) return byConfidence
          return l10HitRateOf(b) - l10HitRateOf(a)
        })
    }
  }, [props, sortBy])

  // ─── Reset stat when sport changes ──────────────────────────────────────────
  useEffect(() => {
    setStat(DEFAULT_STATS[sport])
    setSelectedMatchup(null)
    setDirectionToggle("all")
    setNbaFilters({ minMinutes: 0, vsOpponent: false, withoutPlayer: "" })

    // Try to read cached data for the new sport to avoid skeleton flash
    const sportPropsCache = readCache<{ props?: EnhancedPropCardData[]; todayGames?: TodayGame[] }>(`/api/props?sport=${sport}&stat=all&direction=all`)
    const sportGamesCache = readCache<{ games?: Game[] }>(`/api/props/games?sport=${sport}`)

    if (sportPropsCache?.props?.length) {
      setProps(sportPropsCache.props)
      setLoading(false)
      if ((sport === "NBA" || sport === "NFL") && sportPropsCache.todayGames) {
        const cg = sportPropsCache.todayGames as (TodayGame & { gameDate?: string })[]
        setTodayGames(cg.map((g) => ({
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          gameTime: g.gameTime ?? g.gameDate ?? "",
          status: g.status,
        })) as TodayGame[])
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

  // ─── Fetch games for the selected date ──────────────────────────────────────
  const fetchGames = useCallback(async () => {
    const url = isToday
      ? `/api/props/games?sport=${sport}`
      : `/api/props/games?sport=${sport}&date=${selectedDate}`
    setGamesLoading(true)
    try {
      const data = await cachedFetch<{ games?: Game[] }>(url, 120_000)
      setGames(data.games ?? [])
    } catch {
      // Leave the previously loaded strip in place. Blanking it on a transient
      // error made a rate-limited request look like "no games scheduled".
    } finally {
      setGamesLoading(false)
    }
  }, [sport, selectedDate, isToday])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  // ─── Fetch props ─────────────────────────────────────────────────────────────

  // Whether anything is on screen, tracked in a ref so the fetch callback can
  // read it without depending on it. `props.length` used to be a dependency of
  // fetchProps, which meant every completed fetch changed the callback identity
  // and re-triggered the effect that calls it — a refetch on every load, and a
  // real request the moment the client cache lapsed.
  const hasPropsRef = useRef(props.length > 0)
  useEffect(() => {
    hasPropsRef.current = props.length > 0
  }, [props.length])

  // Monotonic request id. Filter changes fire overlapping requests, and they do
  // not necessarily resolve in order — without this guard a slow response for a
  // previously selected stat could land after, and overwrite, the current one.
  const propsRequestIdRef = useRef(0)

  const fetchProps = useCallback(async () => {
    const requestId = ++propsRequestIdRef.current

    // Only show skeleton if we don't already have props displayed
    if (!hasPropsRef.current) {
      setLoading(true)
    }
    const params = new URLSearchParams()
    params.set("sport", sport)
    params.set("stat", stat)
    params.set("direction", directionToggle)

    // Matchup filter (NBA + NFL)
    if ((sport === "NBA" || sport === "NFL") && selectedMatchup) {
      params.set("matchup", selectedMatchup)
    }

    // NBA advanced filters
    if (sport === "NBA") {
      if (debouncedNbaFilters.minMinutes > 0) {
        params.set("minMinutes", String(debouncedNbaFilters.minMinutes))
      }
      if (debouncedNbaFilters.vsOpponent) {
        params.set("vsOpponent", "true")
      }
      if (debouncedNbaFilters.withoutPlayer.trim()) {
        params.set("withoutPlayer", debouncedNbaFilters.withoutPlayer.trim())
      }
    }

    try {
      const url = `/api/props?${params.toString()}`
      // 2 minutes, matching the server-side props TTL. A shorter client TTL just
      // sends requests the server answers from its own cache anyway.
      const data = await cachedFetch<{ props?: EnhancedPropCardData[]; todayGames?: (TodayGame & { gameDate?: string })[] }>(url, 120_000)

      // A newer request has started — discard this result rather than clobbering it.
      if (requestId !== propsRequestIdRef.current) return

      setProps(data.props ?? [])
      // Extract todayGames for NBA + NFL (both drive the matchup filter).
      if ((sport === "NBA" || sport === "NFL") && data.todayGames) {
        // NFL engine returns { homeTeam, awayTeam, gameDate, status };
        // normalize gameDate → gameTime so the strip renders consistently.
        const normalized = data.todayGames.map((g) => ({
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          gameTime: g.gameTime ?? g.gameDate ?? "",
          status: g.status,
        })) as TodayGame[]
        setTodayGames(normalized)
      }
    } catch {
      // Keep whatever is already on screen; cachedFetch now throws on non-2xx
      // rather than caching the error body.
    } finally {
      if (requestId === propsRequestIdRef.current) {
        setLoading(false)
      }
    }
  }, [sport, stat, selectedMatchup, directionToggle, debouncedNbaFilters])

  useEffect(() => {
    fetchProps()
  }, [fetchProps])

  // ─── Parlay handlers ────────────────────────────────────────────────────────

  // ─── Duplicate toast state (Task 8.2) ─────────────────────────────────────
  const [duplicateToast, setDuplicateToast] = useState<string | null>(null)
  const [logPickToast, setLogPickToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  // Auto-dismiss duplicate toast after 3 seconds (Requirement 7.2)
  useEffect(() => {
    if (!duplicateToast) return
    const timer = setTimeout(() => setDuplicateToast(null), 3000)
    return () => clearTimeout(timer)
  }, [duplicateToast])

  // Auto-dismiss log pick toast after 3 seconds
  useEffect(() => {
    if (!logPickToast) return
    const timer = setTimeout(() => setLogPickToast(null), 3000)
    return () => clearTimeout(timer)
  }, [logPickToast])

  const handleAddToParlay = useCallback(async (
    prop: EnhancedPropCardData,
    directionOverride?: "over" | "under",
  ) => {
    // Auth gate — show popup for guests
    if (!isAuthenticated) {
      setShowAuthDialog(true)
      return
    }
    // Enhanced validation with duplicate (player, stat) check (Task 8.2, Requirement 7.2)
    const validation = canAddToParlay(parlayState.legs, prop.id, prop.player, prop.statCategory)
    if (!validation.canAdd) {
      // Show toast for 3 seconds on duplicate rejection (Requirement 7.2)
      setDuplicateToast(validation.reason)
      return
    }

    const direction = directionOverride ?? prop.direction ?? "over"

    // Find L10 hit rate: prefer hitRateWindows if available, fallback to hitRate field
    const overRate = l10HitRateOf(prop)
    const l10HitRate = direction === "over" ? overRate : Math.max(0, 100 - overRate)

    const newLeg: ParlayLeg = {
      propId: prop.id,
      player: prop.player,
      statCategory: prop.statCategory,
      propLine: prop.propLine,
      direction,
      l10HitRate,
      isWeakLink: false,
      sport: prop.sport ?? sport,
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
  }, [parlayState.legs, isAuthenticated, sport])

  // ─── Parlay leg direction toggle handler (Task 8.3, Requirement 7.5, 7.6, 7.7) ────────

  const handleParlayLegDirectionToggle = useCallback(async (propId: string, newDirection: "over" | "under") => {
    // Update the leg direction optimistically
    const newLegs = parlayState.legs.map((leg) =>
      leg.propId === propId ? { ...leg, direction: newDirection } : leg
    )

    setParlayState((prev) => ({
      ...prev,
      legs: newLegs,
    }))

    // Re-call /api/props/parlay to recalculate combined hit rate (Requirement 7.6)
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
        } else {
          // API failure: retain legs, omit hit rate (Requirement 7.7)
          setParlayState((prev) => ({
            ...prev,
            combinedHitRate: null,
          }))
        }
      } catch {
        // Network failure: retain legs, omit hit rate (Requirement 7.7)
        setParlayState((prev) => ({
          ...prev,
          combinedHitRate: null,
        }))
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

  const handleLogPick = useCallback(async (prop: EnhancedPropCardData) => {
    // Auth gate — show popup for guests
    if (!isAuthenticated) {
      setShowAuthDialog(true)
      return
    }

    // Every sport the props page can render is loggable — the sport allowlist
    // lives in lib/props/statCatalog and is enforced by /api/bets. There used to
    // be a hardcoded ["NBA","Tennis"] check here that short-circuited before the
    // request, so Log silently did nothing on NFL, NHL and Soccer cards.
    try {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: prop.player,
          // Team props and some engines leave `sport` unset; fall back to the
          // page's active sport rather than sending undefined and failing
          // validation.
          sport: prop.sport ?? sport,
          statCategory: prop.statCategory,
          propLine: prop.propLine,
          direction: prop.direction ?? "over",
          confidenceScore: prop.confidence?.stars ?? 3,
          matchupGrade: prop.matchupGrade ?? undefined,
          isMonitored: true,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || "Failed to log pick")
      }

      const statLabel = STAT_LABELS[prop.statCategory] ?? prop.statCategory
      const direction = prop.direction ?? "over"
      setLogPickToast({
        message: `Logged: ${prop.player} ${direction} ${prop.propLine} ${statLabel}`,
        type: "success",
      })
    } catch (err) {
      setLogPickToast({ message: err instanceof Error ? err.message : "Failed to log pick", type: "error" })
    }
  }, [isAuthenticated, sport])

  // ─── Share handler ──────────────────────────────────────────────────────────

  const handleShare = useCallback(async (prop: EnhancedPropCardData) => {
    const outcome = await shareProp(prop)

    // A dismissed share sheet is not a failure — stay quiet.
    if (outcome === "cancelled" || outcome === "shared") return

    setLogPickToast(
      outcome === "copied"
        ? { message: "Link copied to clipboard", type: "success" }
        : { message: "Couldn't share this prop", type: "error" }
    )
  }, [])

  // ─── Correlation tap handler ────────────────────────────────────────────────

  const handleCorrelationTap = useCallback(() => {
    // The CorrelationsSection component handles scroll + highlight internally.
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

  const handleDirectionToggle = useCallback((dir: "all" | "over" | "under") => {
    setDirectionToggle(dir)
  }, [])

  return (
    <div className="min-h-screen max-w-[1400px] mx-auto text-white font-sans flex flex-col">
      <div className="px-4 md:px-6 lg:px-8 pt-6 pb-[7rem] md:pb-8 flex-1 flex flex-col gap-6">
        <PropsHeader
          sport={sport}
          selectedDate={selectedDate}
          todayIso={todayIso}
          onDateChange={setSelectedDate}
        />

        {/* Games for the selected date — also the per-game props filter on NBA/NFL */}
        <GameStrip
          games={games}
          todayGames={sport === "NBA" || sport === "NFL" ? todayGames : []}
          loading={gamesLoading}
          selectedDate={selectedDate}
          todayIso={todayIso}
          selectedMatchup={selectedMatchup}
          onSelectMatchup={sport === "NBA" || sport === "NFL" ? setSelectedMatchup : undefined}
        />

        {!isToday && (
          <p className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3.5 py-2.5 text-xs text-[var(--color-text-muted)]">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-lime)]" />
            You&apos;re viewing another day&apos;s schedule. Prop lines below are always generated for
            today&apos;s slate.
          </p>
        )}

        {/* Stat filters + over/under direction */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <StatFilters filters={statFilters} activeStat={stat} onStatChange={setStat} />
          </div>

          <div
            className="flex items-center gap-1 shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-1 w-fit"
            role="group"
            aria-label="Direction filter"
          >
            {(["all", "over", "under"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => handleDirectionToggle(dir)}
                aria-pressed={directionToggle === dir}
                className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-colors ${
                  directionToggle === dir
                    ? dir === "over"
                      ? "bg-[var(--color-lime)]/20 text-[var(--color-lime)]"
                      : dir === "under"
                        ? "bg-[var(--color-danger)]/20 text-[var(--color-danger)]"
                        : "bg-white/10 text-white"
                    : "text-[var(--color-text-muted)] hover:text-white"
                }`}
              >
                {dir}
              </button>
            ))}
          </div>
        </div>

        {/* Search + sort + layout */}
        <PropsToolbar
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        >
          <PlayerSearch sport={sport} initialQuery={initialSearch} />
        </PropsToolbar>

        {/* NBA Advanced Filters */}
        {sport === "NBA" && (
          <NBAFilters values={nbaFilters} onChange={setNbaFilters} />
        )}

        {/* Section heading + count */}
        <div className="flex items-baseline justify-between gap-3 -mb-1">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            {selectedMatchup ? "Selected Game" : "All Players"}
          </h2>
          {!loading && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] tabular-nums">
              {sortedProps.length.toLocaleString()} {sortedProps.length === 1 ? "Prop" : "Props"}
            </p>
          )}
        </div>

        {/* Props Grid */}
        <PropCardGrid
          props={sortedProps}
          loading={loading}
          viewMode={viewMode}
          gameTimeByTeam={gameTimeByTeam}
          onAddToParlay={handleAddToParlay}
          onLogPick={handleLogPick}
          onShare={handleShare}
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
      </div>

      {/* Parlay Builder Bottom Sheet */}
      <ParlayBuilder
        state={parlayState}
        onRemoveLeg={handleRemoveLeg}
        onClear={handleClearParlay}
        onDirectionToggle={handleParlayLegDirectionToggle}
        isAuthenticated={isAuthenticated}
      />

      {/* Stats Reference Panel */}
      <StatsPanel
        isOpen={statsPanelOpen}
        playerName={statsPanelPlayer}
        statCategory={statsPanelStat}
        onClose={handleStatsPanelClose}
        triggerRef={statsPanelTriggerRef}
      />

      {/* Duplicate prop toast (Task 8.2, Requirement 7.2) */}
      {duplicateToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl px-5 py-3 shadow-lg">
            <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0" />
            <span className="text-sm text-white font-medium">
              {duplicateToast}
            </span>
          </div>
        </div>
      )}

      {/* Log pick toast */}
      {logPickToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl px-5 py-3 shadow-lg">
            {logPickToast.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-[var(--color-lime)] shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span className="text-sm text-white font-medium">
              {logPickToast.message}
            </span>
          </div>
        </div>
      )}

      {/* Auth required dialog for guests */}
      {showAuthDialog && (
        <AuthRequiredDialog onClose={() => setShowAuthDialog(false)} />
      )}
    </div>
  )
}
