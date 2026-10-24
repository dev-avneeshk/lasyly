"use client"

import { useSearchParams } from "next/navigation"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react"
import { Game } from "@/lib/props/types"
import { EnhancedPropCardData } from "@/lib/analytics/types"
import { NBA_STAT_FILTERS, TENNIS_STAT_FILTERS, SOCCER_STAT_FILTERS, NFL_STAT_FILTERS, NHL_STAT_FILTERS, DEFAULT_STATS, STAT_LABELS } from "@/lib/props/constants"
import { todayIso as resolveTodayIso } from "@/lib/props/dates"
import { shareProp } from "@/lib/props/share"
import { PropsHeader } from "@/components/analysis/PropsHeader"
import { GameStrip } from "@/components/analysis/GameStrip"
import { TopValueProps, type BestPropsData } from "@/components/analysis/TopValueProps"
import { PropsTable, type GameInfo } from "@/components/analysis/PropsTable"
import { StatFilters } from "@/components/analysis/StatFilters"
import { PropCardGrid } from "@/components/analysis/PropCardGrid"
import { PlayerSearch } from "@/components/analysis/PlayerSearch"
import { PropsToolbar, type PropSortKey, type PropViewMode, type PositionFilter } from "@/components/analysis/PropsToolbar"
import { NBAFilters, NBAFilterValues } from "@/components/analysis/NBAFilters"
import { ParlayBuilder, ParlayLeg, ParlayState, canAddToParlay } from "@/components/props/ParlayBuilder"
import { AuthRequiredDialog } from "@/components/auth/AuthGate"
import { StatsPanel } from "@/components/props/StatsPanel"
import { TodayGame } from "@/lib/analytics/engine-v2"
import { cachedFetch, readCache } from "@/lib/clientCache"
import { headshotOf, positionGroups, positionOf, projectionOf, sideOf, sideRecord } from "@/lib/props/display"
import { getPredictorLegs, setPredictorLegs, OPEN_PREDICTOR_EVENT } from "@/lib/props/predictorStore"
import { predictionLock, LOCK_LABEL, type LockReason } from "@/lib/props/game-lock"

/** How often the page re-checks tip-off times to lock started games. */
const LOCK_TICK_MS = 15_000


const SPORTS = ["NBA", "Tennis", "Soccer", "NFL", "NHL"] as const
type Sport = (typeof SPORTS)[number]

const VIEW_MODE_STORAGE_KEY = "lasyly:props-view-mode"

function normalizeSport(value?: string): Sport {
  const match = SPORTS.find((s) => s.toLowerCase() === (value ?? "").toLowerCase())
  return match ?? "NBA"
}

/** Row shape from GET /api/bets used to rebuild the saved-pick set. */
type SavedBetRow = {
  id: string
  player_name: string
  sport: string
  stat_category: string
  prop_line: number
  status: string
}

/** Identity of a saved pick: the same player, stat and line on the same sport. */
function savedPickKey(player: string, sport: string, stat: string, line: number): string {
  return `${player.toLowerCase()}|${sport.toUpperCase()}|${stat.toLowerCase()}|${Number(line)}`
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
  /** Selected game from the `?game=` param (e.g. "DET-BOS"), so Back restores it. */
  initialMatchup?: string
}

/** A `HOME-AWAY` matchup key, or null for anything else in the URL. */
function parseMatchup(value?: string | null): string | null {
  const v = (value ?? "").toUpperCase()
  return /^[A-Z]{2,3}-[A-Z]{2,3}$/.test(v) ? v : null
}

export default function AnalysisClient({
  isAuthenticated,
  initialSearch = "",
  initialSport,
  initialMatchup,
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
  const cachedProps = readCache<{ props?: EnhancedPropCardData[]; todayGames?: TodayGame[]; best?: BestPropsData }>(`/api/props?sport=${normalizeSport(initialSport)}&stat=all&direction=all`)
  const cachedGames = readCache<{ games?: Game[] }>(`/api/props/games?sport=${normalizeSport(initialSport)}`)

  const [props, setProps] = useState<EnhancedPropCardData[]>(cachedProps?.props ?? [])
  const [games, setGames] = useState<Game[]>(cachedGames?.games ?? [])
  const [loading, setLoading] = useState(!cachedProps?.props?.length)
  const [gamesLoading, setGamesLoading] = useState(!cachedGames?.games?.length)
  const [showAuthDialog, setShowAuthDialog] = useState(false)

  // ─── Matchup state (NBA + NFL) ─────────────────────────────────────────────
  // Seeded from `?game=` and written back to it, so opening a player and
  // pressing Back returns to the same game instead of the full slate.
  //
  // Read from the live URL, not only the server prop: Back restores Next's
  // cached render from before the game was picked (its `initialMatchup` is
  // stale) while the URL itself carries `?game=`.
  const liveSearchParams = useSearchParams()
  const [selectedMatchup, setSelectedMatchup] = useState<string | null>(
    () => parseMatchup(liveSearchParams.get("game")) ?? parseMatchup(initialMatchup)
  )

  const selectMatchup = useCallback((matchup: string | null) => {
    setSelectedMatchup(matchup)
    try {
      const url = new URL(window.location.href)
      if (matchup) url.searchParams.set("game", matchup)
      else url.searchParams.delete("game")
      // replaceState (not router.replace): updates this history entry without
      // a server round-trip. Pass `null`, not window.history.state: Next's
      // patched replaceState treats a state carrying its own `__NA` marker as
      // an internal call and skips syncing the URL into the router, so Back
      // then restored the entry without `?game=`. With `null` Next copies its
      // internals over and records the new URL (see Next docs: Native History API).
      window.history.replaceState(null, "", url.toString())
    } catch {
      // URL APIs unavailable: the selection still works, it just won't persist.
    }
  }, [])
  const [todayGames, setTodayGames] = useState<TodayGame[]>(cachedProps?.todayGames ?? [])
  // NBA: top props scored against sportsbook lines (null until the API returns them).
  const [best, setBest] = useState<BestPropsData | null>(cachedProps?.best ?? null)

  // ─── Prediction lock ────────────────────────────────────────────────────────
  // The slate's date and today's date as the API reports them (US Eastern),
  // so a viewer in another timezone locks the same games the server does.
  // NBA is the sport whose props API takes a `date` and has per-game tip-offs.
  const datedSport = sport === "NBA"
  const [slateMeta, setSlateMeta] = useState<{ date: string; today: string } | null>(null)
  // Ticks so a game locks at tip-off without a refetch.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), LOCK_TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  // ─── Presentation state ─────────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState<PropSortKey>("value")
  const [viewMode, setViewMode] = useState<PropViewMode>("table")
  const [teamFilter, setTeamFilter] = useState("all")
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("all")
  // Rows ticked in the table, for adding several props at once.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const tableRef = useRef<HTMLDivElement | null>(null)

  // Restore the last used layout after mount (avoids a hydration mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY)
      // "list" was the old detailed card view; it now maps to the table.
      if (saved === "grid" || saved === "table") setViewMode(saved)
      else if (saved === "list") setViewMode("table")
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
  // Opens the parlay sheet when bumped (sidebar "My Predictor" card).
  const [predictorOpenSignal, setPredictorOpenSignal] = useState(0)

  // Restore My Predictor legs from this tab's session after mount, and open the
  // sheet when the sidebar card asks (directly, or via /analysis#predictor).
  useEffect(() => {
    const stored = getPredictorLegs()
    if (stored.length > 0) {
      setParlayState((prev) => (prev.legs.length > 0 ? prev : { ...prev, legs: stored, isVisible: true }))
      if (window.location.hash === "#predictor") setPredictorOpenSignal((n) => n + 1)
    }
    const open = () => setPredictorOpenSignal((n) => n + 1)
    window.addEventListener(OPEN_PREDICTOR_EVENT, open)
    return () => window.removeEventListener(OPEN_PREDICTOR_EVENT, open)
  }, [])

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
    // Narrow to the selected game on the client too. Selecting a game used to
    // leave every game's cards on screen until the matchup request returned
    // (seconds on a cold cache); filtering what's already loaded makes the
    // switch instant, and the server's fuller list replaces it when it lands.
    let list = [...props]
    if (selectedMatchup) {
      const teams = new Set(selectedMatchup.toUpperCase().split("-"))
      list = list.filter((p) => teams.has((p.team ?? "").toUpperCase()))
    }
    if (teamFilter !== "all") {
      list = list.filter((p) => (p.team ?? "").toUpperCase() === teamFilter)
    }
    if (positionFilter !== "all") {
      list = list.filter((p) => positionGroups(positionOf(p)).has(positionFilter))
    }
    const chanceOf = (p: EnhancedPropCardData) =>
      p.propValue?.chance ?? ((p as unknown as { probability?: number }).probability ?? 0)
    switch (sortBy) {
      case "chance":
        return list.sort((a, b) => chanceOf(b) - chanceOf(a))
      case "hitRate":
        return list.sort((a, b) => sideRecord(b).pct - sideRecord(a).pct || chanceOf(b) - chanceOf(a))
      case "multiplier":
        return list.sort((a, b) => (b.propValue?.multiplier ?? 0) - (a.propValue?.multiplier ?? 0))
      case "projection": {
        // Distance of the projection past the line on the shown side, relative to the line.
        const gap = (p: EnhancedPropCardData) => {
          const proj = projectionOf(p)
          if (proj == null || p.propLine <= 0) return -Infinity
          const diff = sideOf(p) === "over" ? proj - p.propLine : p.propLine - proj
          return diff / p.propLine
        }
        return list.sort((a, b) => gap(b) - gap(a))
      }
      case "name":
        return list.sort((a, b) => a.player.localeCompare(b.player))
      case "value":
      default:
        // Priced props by expected value; unpriced ones after, by chance.
        return list.sort((a, b) => {
          const va = a.propValue?.value ?? null
          const vb = b.propValue?.value ?? null
          if (va !== null && vb !== null && vb !== va) return vb - va
          if (va !== null && vb === null) return -1
          if (va === null && vb !== null) return 1
          return chanceOf(b) - chanceOf(a)
        })
    }
  }, [props, sortBy, selectedMatchup, teamFilter, positionFilter])

  const visibleBest = useMemo<BestPropsData | null>(() => {
    if (!best || sport !== "NBA") return null
    if (!selectedMatchup) return best
    const teams = new Set(selectedMatchup.toUpperCase().split("-"))
    const keep = (list: EnhancedPropCardData[]) => list.filter((p) => teams.has((p.team ?? "").toUpperCase()))
    return { top: keep(best.top), overs: keep(best.overs), unders: keep(best.unders) }
  }, [best, sport, selectedMatchup])

  /** Team abbreviation -> tonight's game, for the table's matchup column. */
  const gameByTeam = useMemo(() => {
    const map: Record<string, GameInfo> = {}
    for (const g of todayGames) {
      const info = { home: g.homeTeam.toUpperCase(), away: g.awayTeam.toUpperCase(), time: g.gameTime || null }
      map[info.home] = info
      map[info.away] = info
    }
    return map
  }, [todayGames])

  /** Team abbreviation -> its game's tip-off and status on this slate. */
  const gameClockByTeam = useMemo(() => {
    const map: Record<string, { startTime: string | null; status: string }> = {}
    for (const g of todayGames) {
      const clock = { startTime: g.gameTime || null, status: g.status }
      map[g.homeTeam.toUpperCase()] = clock
      map[g.awayTeam.toUpperCase()] = clock
    }
    return map
  }, [todayGames])

  /**
   * Why a prop is closed to predictions (null when open). NBA only: it is the
   * sport with per-game tip-off times and a dated slate. Until the response
   * says which slate it is, a non-today view stays locked.
   */
  const lockOf = useCallback(
    (prop: EnhancedPropCardData): LockReason | null => {
      if (!datedSport) return null
      if (!slateMeta) return isToday ? null : selectedDate < todayIso ? "past" : "future"
      return predictionLock(
        gameClockByTeam[(prop.team ?? "").toUpperCase()],
        slateMeta.date,
        slateMeta.today,
        nowMs
      )
    },
    [datedSport, slateMeta, isToday, selectedDate, todayIso, gameClockByTeam, nowMs]
  )

  const lockedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const p of props) if (lockOf(p)) ids.add(p.id)
    return ids
  }, [props, lockOf])

  // Ticked rows whose game has since tipped off can no longer be added.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (![...prev].some((id) => lockedIds.has(id))) return prev
      return new Set([...prev].filter((id) => !lockedIds.has(id)))
    })
  }, [lockedIds])

  const teamOptions = useMemo(() => {
    const set = new Set<string>()
    for (const g of todayGames) {
      set.add(g.awayTeam.toUpperCase())
      set.add(g.homeTeam.toUpperCase())
    }
    if (set.size === 0) for (const p of props) if (p.team) set.add(p.team.toUpperCase())
    return [...set].sort()
  }, [todayGames, props])

  // ─── Reset stat when sport changes ──────────────────────────────────────────
  // Runs on mount too; only a real sport change may clear the selected game,
  // otherwise the game restored from `?game=` would be wiped immediately.
  const lastSportRef = useRef(sport)
  useEffect(() => {
    const sportChanged = lastSportRef.current !== sport
    lastSportRef.current = sport
    setStat(DEFAULT_STATS[sport])
    if (sportChanged) setSelectedMatchup(null)
    setDirectionToggle("all")
    setNbaFilters({ minMinutes: 0, vsOpponent: false, withoutPlayer: "" })
    if (sportChanged) {
      setTeamFilter("all")
      setPositionFilter("all")
      setSelectedIds(new Set())
    }

    // Try to read cached data for the new sport to avoid skeleton flash
    const sportPropsCache = readCache<{ props?: EnhancedPropCardData[]; todayGames?: TodayGame[]; best?: BestPropsData }>(`/api/props?sport=${sport}&stat=all&direction=all`)
    setBest(sportPropsCache?.best ?? null)
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

    // Another day's slate. Today sends no date, so the server's own (ET) today
    // and the precomputed slate apply.
    if (datedSport && !isToday) {
      params.set("date", selectedDate)
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
      const data = await cachedFetch<{
        props?: EnhancedPropCardData[]
        best?: BestPropsData
        todayGames?: (TodayGame & { gameDate?: string })[]
        meta?: { date?: string; today?: string }
      }>(url, 120_000)

      // A newer request has started — discard this result rather than clobbering it.
      if (requestId !== propsRequestIdRef.current) return

      setProps(data.props ?? [])
      setBest(data.best ?? null)
      setSlateMeta(data.meta?.date && data.meta?.today ? { date: data.meta.date, today: data.meta.today } : null)
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
  }, [sport, stat, selectedMatchup, directionToggle, debouncedNbaFilters, datedSport, isToday, selectedDate])

  useEffect(() => {
    fetchProps()
  }, [fetchProps])

  // A new date is a different slate: drop the old one's game pick and ticked
  // rows, and show the skeleton rather than the previous day's props.
  const lastDateRef = useRef(selectedDate)
  useEffect(() => {
    if (lastDateRef.current === selectedDate) return
    lastDateRef.current = selectedDate
    if (!datedSport) return
    selectMatchup(null)
    setSelectedIds(new Set())
    setTeamFilter("all")
    setSlateMeta(null)
    setProps([])
    setBest(null)
    setTodayGames([])
    hasPropsRef.current = false
    setLoading(true)
  }, [selectedDate, datedSport, selectMatchup])

  // ─── Parlay handlers ────────────────────────────────────────────────────────

  // ─── Saved picks (bookmark) ─────────────────────────────────────────────────
  // key (player|sport|stat|line) → bet_tracker id, for the user's pending saves.
  // Loaded once so bookmarks render filled, and so a second tap can un-save.
  const [savedPicks, setSavedPicks] = useState<Map<string, string>>(() => new Map())
  const savingKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    fetch("/api/bets?limit=100")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { bets?: SavedBetRow[] } | null) => {
        if (cancelled || !data?.bets) return
        const map = new Map<string, string>()
        for (const bet of data.bets) {
          if (bet.status !== "pending") continue
          map.set(savedPickKey(bet.player_name, bet.sport, bet.stat_category, bet.prop_line), bet.id)
        }
        setSavedPicks(map)
      })
      .catch(() => {
        // Non-fatal: bookmarks just start unfilled.
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const savedPickIds = useMemo(() => {
    const ids = new Set<string>()
    for (const prop of props) {
      if (savedPicks.has(savedPickKey(prop.player, prop.sport ?? sport, prop.statCategory, prop.propLine))) {
        ids.add(prop.id)
      }
    }
    return ids
  }, [props, savedPicks, sport])

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
    const lock = lockOf(prop)
    if (lock) {
      setDuplicateToast(LOCK_LABEL[lock])
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
  }, [parlayState.legs, isAuthenticated, sport, lockOf])

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

  // Mirror legs into the shared predictor store (sidebar card + persistence).
  // Skips the first run so the empty initial state can't wipe stored legs
  // before the restore effect has loaded them.
  const predictorSyncReadyRef = useRef(false)
  useEffect(() => {
    if (!predictorSyncReadyRef.current) {
      predictorSyncReadyRef.current = true
      return
    }
    const byId = new Map(props.map((p) => [p.id, p]))
    const previous = new Map(getPredictorLegs().map((l) => [l.propId, l]))
    setPredictorLegs(
      parlayState.legs.map((leg) => {
        const prop = byId.get(leg.propId)
        const prev = previous.get(leg.propId)
        return {
          ...leg,
          headshotUrl: (prop ? headshotOf(prop) : prev?.headshotUrl) ?? null,
          team: prop?.team ?? prev?.team,
        }
      })
    )
  }, [parlayState.legs, props])

  /** Table "+" button: adds the prop on its side, or removes it if already added. */
  const handleTableAdd = useCallback(
    (prop: EnhancedPropCardData, direction: "over" | "under") => {
      if (parlayPropIds.has(prop.id)) {
        void handleRemoveLeg(prop.id)
        return
      }
      void handleAddToParlay(prop, direction)
    },
    [parlayPropIds, handleRemoveLeg, handleAddToParlay]
  )

  /** Adds every ticked row in one go (one parlay-stats request). */
  const handleAddSelected = useCallback(async () => {
    if (!isAuthenticated) {
      setShowAuthDialog(true)
      return
    }
    let legs = [...parlayState.legs]
    let skipped = 0
    for (const prop of sortedProps) {
      if (!selectedIds.has(prop.id) || legs.some((l) => l.propId === prop.id)) continue
      if (lockOf(prop)) {
        skipped++
        continue
      }
      const check = canAddToParlay(legs, prop.id, prop.player, prop.statCategory)
      if (!check.canAdd) {
        skipped++
        continue
      }
      const direction = sideOf(prop)
      legs = [
        ...legs,
        {
          propId: prop.id,
          player: prop.player,
          statCategory: prop.statCategory,
          propLine: prop.propLine,
          direction,
          l10HitRate: sideRecord(prop).pct,
          isWeakLink: false,
          sport: prop.sport ?? sport,
        },
      ]
    }
    setSelectedIds(new Set())
    if (skipped > 0) setDuplicateToast(`${skipped} prop${skipped === 1 ? "" : "s"} skipped (duplicate, game started or limit reached)`)
    setParlayState((prev) => ({ ...prev, legs, isVisible: legs.length > 0 }))
    if (legs.length < 2) return
    try {
      const res = await fetch("/api/props/parlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legs: legs.map((l) => ({ propId: l.propId, direction: l.direction })) }),
      })
      if (!res.ok) return
      const data = await res.json()
      setParlayState((prev) => ({
        ...prev,
        combinedHitRate: data.combinedHitRate,
        overlappingDates: data.overlappingDates ?? 0,
        legs: prev.legs.map((leg) => {
          const legData = data.legs?.find((l: { propId: string }) => l.propId === leg.propId)
          return legData
            ? { ...leg, l10HitRate: legData.l10HitRate ?? leg.l10HitRate, isWeakLink: legData.isWeakLink ?? false, correlationFlag: legData.correlationFlag }
            : leg
        }),
      }))
    } catch {
      // Keep the optimistic legs.
    }
  }, [isAuthenticated, parlayState.legs, sortedProps, selectedIds, sport, lockOf])

  const toggleSelect = useCallback((propId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(propId)) next.delete(propId)
      else next.add(propId)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(
    (select: boolean) =>
      setSelectedIds(select ? new Set(sortedProps.filter((p) => !lockedIds.has(p.id)).map((p) => p.id)) : new Set()),
    [sortedProps, lockedIds]
  )

  const showAllByValue = useCallback(() => {
    setSortBy("value")
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

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
    if (!prop || lockOf(prop)) return

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
  }, [isAuthenticated, props, lockOf])

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

    const key = savedPickKey(prop.player, prop.sport ?? sport, prop.statCategory, prop.propLine)
    // A second tap while the first request is in flight used to save twice.
    if (savingKeysRef.current.has(key)) return
    savingKeysRef.current.add(key)

    // Already saved → this tap un-saves it.
    const existingId = savedPicks.get(key)
    if (existingId) {
      try {
        const res = await fetch(`/api/bets/${existingId}`, { method: "DELETE" })
        if (!res.ok && res.status !== 404) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Failed to remove pick")
        }
        setSavedPicks((prev) => {
          const next = new Map(prev)
          next.delete(key)
          return next
        })
        setLogPickToast({ message: `Removed ${prop.player} from saved picks`, type: "success" })
      } catch (err) {
        setLogPickToast({ message: err instanceof Error ? err.message : "Failed to remove pick", type: "error" })
      } finally {
        savingKeysRef.current.delete(key)
      }
      return
    }

    // Un-saving stays allowed after tip-off; a new save does not.
    const lock = lockOf(prop)
    if (lock) {
      savingKeysRef.current.delete(key)
      setLogPickToast({ message: LOCK_LABEL[lock], type: "error" })
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
        throw new Error(body.error || "Failed to save pick")
      }

      const created = (await res.json().catch(() => null)) as { id?: string } | null
      if (created?.id) {
        const id = created.id
        setSavedPicks((prev) => new Map(prev).set(key, id))
      }

      const statLabel = STAT_LABELS[prop.statCategory] ?? prop.statCategory
      const direction = prop.direction ?? "over"
      setLogPickToast({
        message: `Saved: ${prop.player} ${direction} ${prop.propLine} ${statLabel} · see Predictions`,
        type: "success",
      })
    } catch (err) {
      setLogPickToast({ message: err instanceof Error ? err.message : "Failed to save pick", type: "error" })
    } finally {
      savingKeysRef.current.delete(key)
    }
  }, [isAuthenticated, sport, savedPicks, lockOf])

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

  const statFilters = sport === "NBA"
    ? NBA_STAT_FILTERS.map((f) => ({ ...f, label: f.key === "all" ? "All Props" : f.key === "tp" ? "Threes" : f.label }))
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
          games={
            /* Games for the selected date — also the per-game props filter on NBA/NFL */
            <GameStrip
              compact
              games={games}
              todayGames={sport === "NBA" || sport === "NFL" ? todayGames : []}
              loading={gamesLoading}
              selectedDate={selectedDate}
              todayIso={todayIso}
              selectedMatchup={selectedMatchup}
              onSelectMatchup={sport === "NBA" || sport === "NFL" ? selectMatchup : undefined}
            />
          }
        />

        {!isToday && (
          <p className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 px-3.5 py-2.5 text-xs text-[var(--color-text-muted)]">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-lime)]" />
            {datedSport
              ? selectedDate < todayIso
                ? "You're viewing a past slate: the props it had that morning, with each player's actual result. Predictions are closed."
                : "You're viewing an upcoming slate. Predictions open on game day."
              : "You're viewing another day's schedule. Props below are always generated for today's slate."}
          </p>
        )}

        {/* Stat chips */}
        <StatFilters filters={statFilters} activeStat={stat} onStatChange={setStat} visibleCount={10} />

        {/* Team / position / side / sort + layout + advanced filters */}
        <PropsToolbar
          teams={teamOptions}
          team={teamFilter}
          onTeamChange={setTeamFilter}
          position={sport === "NBA" ? positionFilter : undefined}
          onPositionChange={sport === "NBA" ? setPositionFilter : undefined}
          side={directionToggle}
          onSideChange={handleDirectionToggle}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        >
          {sport === "NBA" && <NBAFilters values={nbaFilters} onChange={setNbaFilters} />}
        </PropsToolbar>

        {initialSearch && (
          <div className="max-w-md">
            <PlayerSearch sport={sport} initialQuery={initialSearch} />
          </div>
        )}

        {/* Highest expected value on the slate (NBA, priced lines) */}
        {!loading && <TopValueProps best={visibleBest} onViewAll={showAllByValue} />}

        <div ref={tableRef} className="flex flex-col gap-3 scroll-mt-24">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {selectedMatchup ? "Selected Game" : "All Players"}
            </h2>
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-white"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSelected}
                    className="h-8 rounded-lg bg-[var(--color-lime)] px-3 text-[12px] font-bold text-black hover:brightness-110"
                  >
                    Add {selectedIds.size} to My Predictor
                  </button>
                </>
              )}
              {!loading && (
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] tabular-nums">
                  {sortedProps.length.toLocaleString()} {sortedProps.length === 1 ? "Prop" : "Props"}
                </p>
              )}
            </div>
          </div>

          {viewMode === "table" ? (
            <PropsTable
              props={sortedProps}
              loading={loading}
              gameByTeam={gameByTeam}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              addedIds={parlayPropIds}
              onAdd={handleTableAdd}
              addDisabled={parlayFull}
              lockOf={lockOf}
              emptyMessage={emptyMessage}
            />
          ) : (
            <PropCardGrid
              props={sortedProps}
              loading={loading}
              viewMode="grid"
              gameTimeByTeam={gameTimeByTeam}
              onAddToParlay={handleAddToParlay}
              onLogPick={handleLogPick}
              savedPropIds={savedPickIds}
              onShare={handleShare}
              onVote={handleVote}
              onAIExpand={handleAIExpand}
              onCorrelationTap={handleCorrelationTap}
              onAIRetry={handleAIRetry}
              onPropCardClick={handlePropCardClick}
              isAuthenticated={isAuthenticated}
              parlayPropIds={parlayPropIds}
              parlayFull={parlayFull}
              lockedPropIds={lockedIds}
              aiWriteups={aiWriteups}
              emptyMessage={emptyMessage}
            />
          )}
        </div>
      </div>

      {/* Parlay Builder Bottom Sheet */}
      <ParlayBuilder
        state={parlayState}
        onRemoveLeg={handleRemoveLeg}
        onClear={handleClearParlay}
        onDirectionToggle={handleParlayLegDirectionToggle}
        isAuthenticated={isAuthenticated}
        openSignal={predictorOpenSignal}
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
