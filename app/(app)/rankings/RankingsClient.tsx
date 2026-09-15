"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Info } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  CategoryTabs,
  NBA_CATEGORIES,
  NFL_CATEGORIES,
} from "@/components/rankings/CategoryTabs"
import { RankCard } from "@/components/rankings/RankCard"
import { TeamRankCard } from "@/components/rankings/TeamRankCard"
import { RankingsSkeleton } from "@/components/rankings/RankingsSkeleton"
import { getTeamLogoUrl } from "@/lib/constants/teams"
import type { RankingListItem, TeamRankingListItem, RankingType } from "@/lib/rankings/types"

type ActiveCategory = RankingType | "teams"
type Sport = "NBA" | "NFL"

const SEASON_OPTIONS = [
  { season: "2026-27", mode: "projected", label: "2026-27 PROJECTED" },
  { season: "2025-26", mode: "historical", label: "2025-26 FINAL" },
]

/** NFL rankings are keyed by season year and regenerated daily. */
const NFL_SEASON = String(new Date().getUTCFullYear())

/** Default view rendered on first load — must match the initial state below so
 *  the server can prefetch exactly what the client shows before any interaction. */
export const DEFAULT_VIEW = {
  sport: "NBA" as Sport,
  category: "overall" as ActiveCategory,
  season: "2026-27",
  mode: "projected",
}

interface RankingsClientProps {
  /** Server-prefetched rankings for the default view (NBA · overall · projected).
   *  When present, the initial client fetch is skipped so the list paints from
   *  the first HTML instead of after a post-hydration round trip. */
  initialData?: {
    rankings: RankingListItem[]
    ranking_version: string | null
  } | null
}

export default function RankingsClient({ initialData }: RankingsClientProps = {}) {
  const router = useRouter()

  const [sport, setSport] = useState<Sport>(DEFAULT_VIEW.sport)
  const [category, setCategory] = useState<ActiveCategory>(DEFAULT_VIEW.category)
  const [season, setSeason] = useState(DEFAULT_VIEW.season)
  const [mode, setMode] = useState(DEFAULT_VIEW.mode)
  const [searchQuery, setSearchQuery] = useState("")
  const [players, setPlayers] = useState<RankingListItem[]>(initialData?.rankings ?? [])
  const [teams, setTeams] = useState<TeamRankingListItem[]>([])
  // If the server already handed us the default view, we're not loading.
  const [loading, setLoading] = useState(!initialData)
  const [rankingVersion, setRankingVersion] = useState<string | null>(
    initialData?.ranking_version ?? null
  )
  const [empty, setEmpty] = useState(initialData ? !initialData.rankings.length : false)
  const [photos, setPhotos] = useState<Record<string, string>>({})
  // Tracks whether we've already satisfied the first render from server data,
  // so the mount effect below can skip the redundant initial fetch exactly once.
  const [hasSeededInitial, setHasSeededInitial] = useState(Boolean(initialData))

  // Fetch rankings when sport, category or season changes
  const fetchRankings = useCallback(
    async (sp: Sport, cat: ActiveCategory, s: string, m: string) => {
      setLoading(true)
      setEmpty(false)
      setSearchQuery("")

      try {
        if (sp === "NFL") {
          if (cat === "teams") {
            const res = await fetch(`/api/rankings/teams?sport=NFL&season=${NFL_SEASON}`)
            if (!res.ok) throw new Error("Failed to fetch NFL team rankings")
            const data = await res.json()
            setPlayers([])
            setTeams(data.rankings ?? [])
            setRankingVersion(data.ranking_version ?? null)
            setEmpty(!data.rankings?.length)
          } else {
            const res = await fetch(`/api/rankings?sport=NFL&season=${NFL_SEASON}&type=${cat}`)
            if (!res.ok) throw new Error("Failed to fetch NFL rankings")
            const data = await res.json()
            setTeams([])
            setPlayers(data.rankings ?? [])
            setRankingVersion(data.ranking_version ?? null)
            setEmpty(!data.rankings?.length)
          }
        } else if (cat === "teams") {
          const res = await fetch(`/api/rankings/teams?season=${s}&mode=${m}&published=false`)
          if (!res.ok) throw new Error("Failed to fetch team rankings")
          const data = await res.json()
          setTeams(data.rankings ?? [])
          setRankingVersion(data.ranking_version ?? null)
          setEmpty(!data.rankings?.length)
        } else {
          const res = await fetch(`/api/rankings?season=${s}&mode=${m}&type=${cat}&published=false`)
          if (!res.ok) throw new Error("Failed to fetch rankings")
          const data = await res.json()
          setPlayers(data.rankings ?? [])
          setRankingVersion(data.ranking_version ?? null)
          setEmpty(!data.rankings?.length)
        }
      } catch (err) {
        console.error("[rankings] fetch error:", err)
        setEmpty(true)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    // Skip exactly the first fetch when the server already prefetched the
    // default view. Any subsequent sport/category/season change falls through
    // to a normal client fetch.
    if (hasSeededInitial) {
      setHasSeededInitial(false)
      return
    }
    fetchRankings(sport, category, season, mode)
  }, [sport, category, season, mode, fetchRankings, hasSeededInitial])

  // Clear cached headshots when the sport changes so an NBA player's photo
  // never leaks onto a same-named NFL player (and vice versa).
  useEffect(() => {
    setPhotos({})
  }, [sport])

  // Batch-fetch player headshots whenever the player list changes. Repeated
  // parameters avoid comma-delimited names, and small chunks stay below common
  // proxy URL limits. v=5 bypasses empty responses cached during the route
  // migration from the legacy comma-delimited request shape.
  useEffect(() => {
    if (players.length === 0) return
    const names = players
      .map((player) => player.player_name)
      .filter((name) => !(name in photos))
    if (names.length === 0) return

    const controller = new AbortController()

    async function fetchHeadshots() {
      try {
        const batches: string[][] = []
        for (let index = 0; index < names.length; index += 40) {
          batches.push(names.slice(index, index + 40))
        }

        const responses = await Promise.all(
          batches.map(async (batch) => {
            const params = new URLSearchParams({ sport, v: "5" })
            for (const name of batch) params.append("name", name)

            // Let the browser reuse the response across visits/tab switches.
            // The endpoint already sends `Cache-Control: public, max-age=300,
            // s-maxage=3600`, so `force-cache` here turns a fresh network round
            // trip on every render into an instant memory/disk-cache hit for
            // the same batch of names. Previously this was `no-store`, which
            // threw that server + CDN caching away and re-fetched headshots on
            // every single page visit and every category switch.
            const response = await fetch(`/api/players/headshots?${params}`, {
              cache: "force-cache",
              signal: controller.signal,
            })
            if (!response.ok) {
              throw new Error(`Headshot request failed with ${response.status}`)
            }

            const data = await response.json()
            return data?.headshots as Record<string, string> | undefined
          })
        )

        if (controller.signal.aborted) return
        setPhotos((previous) => Object.assign({}, previous, ...responses.filter(Boolean)))
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[rankings] headshot fetch error:", error)
        }
      }
    }

    void fetchHeadshots()
    return () => controller.abort()
    // photos is intentionally omitted: players changing triggers a new lookup,
    // while adding photos here would retry unresolved names indefinitely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players])

  // Filter by search query
  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return players
    const q = searchQuery.toLowerCase()
    return players.filter(
      (p) =>
        p.player_name.toLowerCase().includes(q) ||
        (p.team ?? "").toLowerCase().includes(q) ||
        (p.position ?? "").toLowerCase().includes(q)
    )
  }, [players, searchQuery])

  const filteredTeams = useMemo(() => {
    if (!searchQuery) return teams
    const q = searchQuery.toLowerCase()
    return teams.filter(
      (t) =>
        t.team.toLowerCase().includes(q) ||
        (t.team_full_name ?? "").toLowerCase().includes(q)
    )
  }, [teams, searchQuery])

  const handlePlayerClick = (item: RankingListItem) => {
    const id = item.player_id ?? encodeURIComponent(item.player_name)
    if (sport === "NFL") {
      router.push(`/rankings/players/${id}?sport=NFL&season=${NFL_SEASON}`)
    } else {
      router.push(`/rankings/players/${id}?season=${season}&mode=${mode}`)
    }
  }

  const handleTeamClick = (item: TeamRankingListItem) => {
    if (sport === "NFL") {
      router.push(`/rankings/teams/${item.team}?sport=NFL&season=${NFL_SEASON}`)
    } else {
      router.push(`/rankings/teams/${item.team}?season=${season}&mode=${mode}`)
    }
  }

  return (
    <div className="min-h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[var(--color-background)]/95 backdrop-blur-xl border-b border-[var(--color-border)] px-4 md:px-6 pt-4 pb-3 space-y-3">
        {/* Title */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-lg md:text-xl font-black tracking-tight text-[var(--color-text-primary)]">
                {sport === "NFL"
                  ? `NFL ${NFL_SEASON} · LIVE`
                  : SEASON_OPTIONS.find((o) => o.season === season && o.mode === mode)?.label || season}
              </h1>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {sport === "NFL"
                ? "Live player rankings, updated daily from game stats"
                : "Algorithmic rankings across 8 dimensions"}
              {rankingVersion && rankingVersion !== "none" && (
                <span className="ml-2 opacity-50">· {rankingVersion}</span>
              )}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {/* Sport toggle (NBA / NFL) */}
            <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)] text-xs">
              {(["NBA", "NFL"] as const).map((sp) => (
                <button
                  key={sp}
                  id={`rankings-sport-${sp}`}
                  onClick={() => {
                    setSport(sp)
                    setCategory("overall")
                  }}
                  className={cn(
                    "px-3 py-1.5 font-semibold transition-colors whitespace-nowrap",
                    sport === sp
                      ? "bg-[var(--color-lime)] text-black"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5"
                  )}
                >
                  {sp}
                </button>
              ))}
            </div>

            {/* Season toggle — NBA only (NFL is a single live season) */}
            {sport === "NBA" && (
              <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)] text-xs">
                {SEASON_OPTIONS.map((opt) => (
                  <button
                    key={`${opt.season}-${opt.mode}`}
                    id={`rankings-season-${opt.season}`}
                    onClick={() => { setSeason(opt.season); setMode(opt.mode); }}
                    className={cn(
                      "px-3 py-1.5 font-semibold transition-colors whitespace-nowrap",
                      season === opt.season && mode === opt.mode
                        ? "bg-[var(--color-lime)] text-black"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <CategoryTabs
          active={category}
          onChange={setCategory}
          categories={sport === "NFL" ? NFL_CATEGORIES : NBA_CATEGORIES}
        />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            id="rankings-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={category === "teams" ? "Search teams..." : "Search players..."}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[var(--color-surface)]/60 border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-lime)]/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 py-4">
        {loading ? (
          <RankingsSkeleton />
        ) : empty ? (
          <EmptyState season={season} />
        ) : category === "teams" ? (
          /* Team Rankings */
          <AnimatePresence mode="wait">
            <motion.div
              key={`teams-${season}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {filteredTeams.map((item) => (
                <div key={item.team} onClick={() => handleTeamClick(item)}>
                  <TeamRankCard
                    item={item}
                    teamLogoUrl={getTeamLogoUrl(item.team, sport) ?? undefined}
                  />
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          /* Player Rankings */
          <AnimatePresence mode="wait">
            <motion.div
              key={`${category}-${season}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-1.5"
            >
              {/* Tier group headers + cards */}
              {renderWithTierGroups(filteredPlayers, handlePlayerClick, photos, sport)}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

// ─── Tier Group Rendering ─────────────────────────────────────────────────────

const TIER_ORDER = [
  "Ω — Apex", "X — Mythic", "S — Elite", "A — Dominant",
  "B — Impact", "C — Rotation", "D — Limited", "E — Fringe",
]

function renderWithTierGroups(
  players: RankingListItem[],
  onClick: (item: RankingListItem) => void,
  photos: Record<string, string>,
  league: Sport
) {
  if (players.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">
        No players match your search.
      </div>
    )
  }

  // Group by tier
  const groups = new Map<string, RankingListItem[]>()
  for (const tier of TIER_ORDER) groups.set(tier, [])
  for (const p of players) {
    const tier = p.tier ?? "Fringe"
    if (!groups.has(tier)) groups.set(tier, [])
    groups.get(tier)!.push(p)
  }

  const elements: React.ReactNode[] = []
  let cardIndex = 0

  for (const [tier, tierPlayers] of groups.entries()) {
    if (tierPlayers.length === 0) continue
    elements.push(
      <div key={`tier-${tier}`} className="pt-2 pb-0.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-muted)] px-2">
          {tier} · {tierPlayers.length}
        </span>
      </div>
    )
    for (const player of tierPlayers) {
      const delay = Math.min(cardIndex * 0.02, 0.4)
      elements.push(
        <motion.div
          key={player.player_name}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay }}
          onClick={() => onClick(player)}
        >
          <RankCard
            item={player}
            teamLogoUrl={getTeamLogoUrl(player.team ?? "", league) ?? undefined}
            photoUrl={photos[player.player_name] ?? null}
          />
        </motion.div>
      )
      cardIndex++
    }
  }

  return elements
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ season }: { season: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
        <Info className="w-8 h-8 text-[var(--color-text-muted)]" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
          Rankings not yet published
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-sm">
          {season === "2026-27"
            ? "The 2026-27 projection rankings will be published as we approach the season. Check back soon."
            : "No rankings data found for this season."}
        </p>
      </div>
    </div>
  )
}
