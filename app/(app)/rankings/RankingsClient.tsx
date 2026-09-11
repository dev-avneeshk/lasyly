"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, Info } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { CategoryTabs } from "@/components/rankings/CategoryTabs"
import { RankCard } from "@/components/rankings/RankCard"
import { TeamRankCard } from "@/components/rankings/TeamRankCard"
import { RankingsSkeleton } from "@/components/rankings/RankingsSkeleton"
import { getTeamLogoUrl } from "@/lib/constants/teams"
import type { RankingListItem, TeamRankingListItem, RankingType } from "@/lib/rankings/types"

type ActiveCategory = RankingType | "teams"

const SEASON_OPTIONS = [
  { season: "2026-27", mode: "projected", label: "2026-27 PROJECTED" },
  { season: "2025-26", mode: "historical", label: "2025-26 FINAL" },
]

export default function RankingsClient() {
  const router = useRouter()

  const [category, setCategory] = useState<ActiveCategory>("overall")
  const [season, setSeason] = useState("2026-27")
  const [mode, setMode] = useState("projected")
  const [searchQuery, setSearchQuery] = useState("")
  const [players, setPlayers] = useState<RankingListItem[]>([])
  const [teams, setTeams] = useState<TeamRankingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [rankingVersion, setRankingVersion] = useState<string | null>(null)
  const [empty, setEmpty] = useState(false)
  const [photos, setPhotos] = useState<Record<string, string>>({})

  // Fetch rankings when category or season changes
  const fetchRankings = useCallback(async (cat: ActiveCategory, s: string, m: string) => {
    setLoading(true)
    setEmpty(false)
    setSearchQuery("")

    try {
      if (cat === "teams") {
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
  }, [])

  useEffect(() => {
    fetchRankings(category, season, mode)
  }, [category, season, mode, fetchRankings])

  // Batch-fetch player headshots whenever the player list changes.
  useEffect(() => {
    if (players.length === 0) return
    const names = players
      .map((p) => p.player_name)
      .filter((n) => !(n in photos))
    if (names.length === 0) return

    let cancelled = false
    const url = `/api/players/headshots?sport=NBA&names=${encodeURIComponent(names.join(","))}`
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.headshots) return
        setPhotos((prev) => ({ ...prev, ...data.headshots }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
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
    router.push(`/rankings/players/${id}?season=${season}&mode=${mode}`)
  }

  const handleTeamClick = (item: TeamRankingListItem) => {
    router.push(`/rankings/teams/${item.team}?season=${season}&mode=${mode}`)
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
                {SEASON_OPTIONS.find(o => o.season === season && o.mode === mode)?.label || season}
              </h1>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Algorithmic rankings across 8 dimensions
              {rankingVersion && (
                <span className="ml-2 opacity-50">· {rankingVersion}</span>
              )}
            </p>
          </div>
          {/* Season toggle */}
          <div className="flex-shrink-0">
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
          </div>
        </div>

        {/* Category tabs */}
        <CategoryTabs active={category} onChange={setCategory} />

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
                    teamLogoUrl={getTeamLogoUrl(item.team, "nba") ?? undefined}
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
              {renderWithTierGroups(filteredPlayers, handlePlayerClick, photos)}
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
  photos: Record<string, string>
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
            teamLogoUrl={getTeamLogoUrl(player.team ?? "", "nba") ?? undefined}
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
