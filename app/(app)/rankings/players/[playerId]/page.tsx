"use client"

import { use, useEffect, useMemo, useState } from "react"
import { notFound } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Plus, Check, ArrowLeftRight, ChevronRight, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { TierBadge } from "@/components/rankings/TierBadge"
import { RankMovement } from "@/components/rankings/RankMovement"
import { ScoreRadar } from "@/components/rankings/ScoreRadar"
import { RankingTimeline } from "@/components/rankings/RankingTimeline"
import { PlayerDetailSkeleton } from "@/components/rankings/RankingsSkeleton"
import {
  HeadlineStat, TabBar, Panel, InfoRow, AverageBar, MetricCell,
  fmt, fmtPct, fmtDecPct,
} from "@/components/rankings/PlayerDetailParts"
import { getTeamLogoUrl, getNbaTeamFullName } from "@/lib/constants/teams"

// ─── Types ────────────────────────────────────────────────────────────────

type SeasonStats = {
  ppg: number | null; apg: number | null; rpg: number | null; spg: number | null; bpg: number | null
  mpg: number | null; fgPct: number | null; fg3Pct: number | null; ftPct: number | null; efgPct: number | null
  tsPct: number | null; usgPct: number | null; astPct: number | null; per: number | null; ws: number | null
  bpm: number | null; obpm: number | null; dbpm: number | null; vorp: number | null
  offRtg: number | null; defRtg: number | null; tovPct: number | null; tovPerG: number | null
  wsPer48: number | null; ows: number | null; dws: number | null
  stlPct: number | null; blkPct: number | null; trbPct: number | null; orbPct: number | null; drbPct: number | null
} | null

type GameRow = {
  date: string | null; opponent: string; pts: number; trb: number; ast: number
  fg: number; fga: number; tp: number; tpa: number; ft: number; fta: number
  minutes?: string | number | null
}

type StatsRef = {
  seasonStats: SeasonStats
  gameBreakdown: GameRow[] | null
  statsSeason: string | null
} | null

type Tab = "overview" | "stats" | "gamelog" | "advanced"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Stats" },
  { id: "gamelog", label: "Game Log" },
  { id: "advanced", label: "Advanced" },
]

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PlayerRankingPage({ params, searchParams }: any) {
  const resolvedParams = use(params) as any
  const resolvedSearchParams = use(searchParams) as any
  const playerId = resolvedParams.playerId
  const season = resolvedSearchParams.season ?? "2026-27"

  const [data, setData] = useState<any>(null)
  const [stats, setStats] = useState<StatsRef>(null)
  const [headshot, setHeadshot] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("overview")
  const [isWatchlisted, setIsWatchlisted] = useState(false)

  // 1. Ranking data (rank, tier, radar, narrative)
  useEffect(() => {
    let cancelled = false
    async function fetchPlayer() {
      try {
        const res = await fetch(`/api/rankings/players/${playerId}?season=${season}`)
        if (!res.ok) {
          if (res.status === 404 && !cancelled) notFound()
          throw new Error("Failed to load player")
        }
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchPlayer()
    return () => { cancelled = true }
  }, [playerId, season])

  // 2. Box-score stats + headshot, keyed on the resolved player name
  useEffect(() => {
    if (!data?.player_name) return
    let cancelled = false
    const name = data.player_name as string
    const team = (data.team ?? data.historical_team ?? "") as string

    // Clear a previous player's portrait immediately during client-side
    // navigation, then show the persisted image while the provider refreshes.
    setHeadshot(data.headshot_url ?? null)

    fetch(`/api/props/stats-reference?player=${encodeURIComponent(name)}&stat=pts`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json) return
        setStats({
          seasonStats: json.seasonStats ?? null,
          gameBreakdown: json.gameBreakdown ?? null,
          statsSeason: json.statsSeason ?? null,
        })
      })
      .catch(() => {})

    const headshotEndpoint = `/api/players/headshot?name=${encodeURIComponent(name)}&team=${encodeURIComponent(team)}&sport=NBA&resolver=accent-v2`
    fetch(headshotEndpoint, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.success && json.headshot) setHeadshot(json.headshot)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [data?.player_name, data?.team, data?.historical_team, data?.headshot_url])

  // NOTE: getTeamLogoUrl matches sport case-sensitively ("NBA", not "nba").
  const logoUrl = useMemo(() => getTeamLogoUrl(data?.team ?? "", "NBA"), [data?.team])
  const teamFullName = useMemo(() => getNbaTeamFullName(data?.team) ?? "Free Agent", [data?.team])

  /** Per-dimension league ranks from the ranking engine, for stat-bar sublabels. */
  const byType = useMemo(() => {
    const r = data?.rankings_by_type ?? {}
    const rank = (k: string): number | null => r?.[k]?.rank ?? null
    return {
      scoring: rank("scoring"),
      rebounding: rank("rebounding"),
      playmaking: rank("playmaking"),
      shooting: rank("shooting"),
    }
  }, [data?.rankings_by_type])
  const s = stats?.seasonStats ?? null

  // Which season the DISPLAYED box-score stats belong to. Falls back to the
  // ranking season until stats have loaded. When viewing a projected ranking
  // (e.g. 2026-27) before that season has games, this will be the prior season
  // (2025-26) — and auto-advances to 2026-27 once those games are scraped.
  const statsSeason = stats?.statsSeason ?? season
  const statsSeasonLabel = statsSeason ? `${statsSeason} Season` : "—"

  if (loading) return <PlayerDetailSkeleton />
  if (!data) return notFound()

  const initials = data.player_name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2)

  // Editorial name wrap: first name on line 1, the remainder (surname, which
  // may itself be hyphenated like "Gilgeous-Alexander") on line 2. Single-word
  // names stay on one line.
  const nameParts: string[] = (data.player_name ?? "").split(" ").filter(Boolean)
  const nameLines: string[] =
    nameParts.length <= 1 ? nameParts : [nameParts[0], nameParts.slice(1).join(" ")]

  // Bio formatting: height stored as "6-6" → 6'6", weight as "195" → "195 lbs".
  const heightDisplay = fmtHeight(data.height)
  const weightDisplay = data.weight ? `${data.weight} lbs` : null
  const birthDisplay = fmtBirthDate(data.birth_date)

  return (
    <div className="min-h-full pb-20">
      {/* ── Cinematic hero ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto px-4 md:px-6 pt-3"
      >
        <div className="relative overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#050607]">
          {/* Atmospheric backdrop */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(95%_130%_at_19%_100%,#20242b_0%,#0b0d11_43%,#050607_78%)]" />
            <div className="absolute left-16 bottom-0 h-64 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08)_0%,transparent_70%)] blur-2xl" />
            <div className="absolute -left-16 -bottom-24 h-64 w-64 rounded-full bg-[var(--color-lime)]/[0.04] blur-3xl" />
            <span aria-hidden="true" className="pointer-events-none absolute right-6 top-16 hidden select-none text-[9px] font-bold uppercase leading-[1.8] tracking-[0.28em] text-white/[0.08] xl:block">
              Discipline<br />Creates<br />Freedom.
            </span>
          </div>

          {/* Breadcrumb belongs to the banner, not a separate page row. */}
          <nav
            aria-label="Player ranking breadcrumb"
            className="absolute left-4 right-4 top-3 z-30 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]"
          >
            <Link
              href={`/rankings?season=${season}`}
              className="inline-flex shrink-0 items-center gap-1.5 transition-colors hover:text-[var(--color-lime)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Rankings
            </Link>
            <ChevronRight aria-hidden className="h-3 w-3 shrink-0 opacity-40" />
            <span aria-current="page" className="min-w-0 truncate text-[var(--color-text-primary)]">
              {data.player_name}
            </span>
          </nav>

          <div className="relative flex min-h-[250px] flex-col pt-10 md:grid md:grid-cols-[250px_minmax(0,1fr)] md:pt-9">
            {/* Portrait art zone: watermark, autograph, vertical name, and player share one compact column. */}
            <div className="relative min-h-[238px] overflow-hidden md:min-h-0">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-4 h-28 w-28 object-contain opacity-[0.11]"
                />
              )}

              <span
                aria-hidden
                className="pointer-events-none absolute left-4 top-[74px] z-20 -rotate-6 select-none text-[43px] italic leading-none text-white/45"
                style={{ fontFamily: '"Brush Script MT", "Segoe Script", cursive' }}
              >
                {nameParts[0] ?? initials}
              </span>

              <div aria-hidden="true" className="pointer-events-none absolute bottom-5 left-4 z-20 hidden w-16 select-none md:block">
                <div className="text-[8px] font-bold uppercase leading-[1.45] tracking-[0.2em] text-white/35">
                  {data.player_name?.split(" ").map((word: string) => (
                    <span key={word} className="block">{word}</span>
                  ))}
                  <span className="mt-1 block">#{data.overall_rank ?? "—"}</span>
                </div>
              </div>

              {headshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={headshot}
                  alt={data.player_name}
                  className="absolute bottom-0 left-1/2 z-10 h-[272px] w-auto -translate-x-[38%] object-contain object-bottom drop-shadow-[0_22px_36px_rgba(0,0,0,0.55)] md:left-auto md:right-[-10px] md:translate-x-0"
                />
              ) : (
                <div className="absolute bottom-4 right-5 flex h-48 w-36 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-4xl font-black text-white/20">
                  {initials}
                </div>
              )}
            </div>

            {/* Identity begins immediately after the portrait, with no empty rail. */}
            <div className="relative z-20 flex min-w-0 flex-col justify-center px-5 pb-6 pt-3 md:px-5 md:pb-5 md:pt-5 lg:pr-16">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-white/[0.08] bg-white/[0.06] px-2 py-0.5 text-[12px] font-black tabular-nums text-white">
                  #{data.overall_rank ?? "—"}
                </span>
                <TierBadge tier={data.tier} />
                <RankMovement change={data.rank_change} isNew={data.is_new} />
              </div>

              <h1 className="mt-2 font-black uppercase leading-[0.84] tracking-[-0.05em] text-white [font-size:clamp(36px,4.35vw,66px)]">
                {nameLines.map((line, i) => (
                  <span key={i} className="block">{line}</span>
                ))}
              </h1>

              <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    {logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="" className="h-7 w-7 object-contain" />
                    )}
                    <span className="truncate text-[14px] font-bold tracking-tight text-white">{teamFullName}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {data.position && <span className="text-[var(--color-text-primary)]">{data.position}</span>}
                    {data.age != null && <><Sep />{data.age} Yrs</>}
                    {heightDisplay && <><Sep />{heightDisplay}</>}
                    {weightDisplay && <><Sep />{weightDisplay.toUpperCase()}</>}
                  </div>
                </div>

                {data.signature && (
                  <blockquote className="max-w-[230px] border-l border-white/10 pl-3 lg:max-w-[210px] lg:pl-4">
                    <p className="font-serif text-[12px] italic leading-snug text-white/70 lg:text-[13px]">
                      &ldquo;{data.signature}&rdquo;
                    </p>
                    {data.player_class && (
                      <cite className="mt-1 block text-[8px] not-italic uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                        {data.player_class}
                      </cite>
                    )}
                  </blockquote>
                )}
              </div>

              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_40px] gap-2 sm:flex sm:items-center">
                <button
                  type="button"
                  aria-pressed={isWatchlisted}
                  onClick={() => setIsWatchlisted((current) => !current)}
                  className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-lime)] px-4 text-[12px] font-bold text-black shadow-[0_8px_22px_-10px_rgba(212,255,0,0.55)] transition-all hover:-translate-y-px hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/60 sm:col-auto"
                >
                  {isWatchlisted ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {isWatchlisted ? "In Watchlist" : "Add to Watchlist"}
                </button>
                <button
                  type="button"
                  disabled
                  title="Player comparison is coming soon"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-4 text-[12px] font-semibold text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:text-[var(--color-text-muted)]"
                >
                  <ArrowLeftRight className="h-4 w-4" /> Compare
                </button>
                <button
                  type="button"
                  disabled
                  title="More player actions are coming soon"
                  aria-label="More player actions are coming soon"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-[var(--color-text-muted)] disabled:cursor-not-allowed"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Headline stat bar — broadcast-style. The Overall Score module is
              deliberately distinct; the rest read cleaner. Sub-ranks come from
              the ranking engine's per-dimension league ranks. */}
          <div className="relative flex items-stretch bg-black/30 border-t border-white/[0.06] overflow-x-auto scrollbar-hide">
            <HeadlineStat
              value={fmt(data.overall_score)}
              label="Overall Score"
              sub={data.overall_rank != null ? `#${data.overall_rank} IN NBA` : null}
              highlight
            />
            <HeadlineStat value={fmt(s?.ppg)} label="PPG" rank={byType.scoring} />
            <HeadlineStat value={fmt(s?.rpg)} label="RPG" rank={byType.rebounding} />
            <HeadlineStat value={fmt(s?.apg)} label="APG" rank={byType.playmaking} />
            <HeadlineStat value={fmtDecPct(s?.fgPct)} label="FG%" rank={byType.shooting} />
            <HeadlineStat value={fmtDecPct(s?.fg3Pct)} label="3P%" rank={byType.shooting} />
            <HeadlineStat value={fmtDecPct(s?.ftPct)} label="FT%" />
          </div>
        </div>
      </motion.div>

      {/* ── Body: main + sidebar ─────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 mt-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Main column */}
        <div className="space-y-5 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab} />

          {tab === "overview" && (
            <OverviewTab data={data} games={stats?.gameBreakdown ?? null} s={s} />
          )}
          {tab === "stats" && <SeasonStatsTable s={s} />}
          {tab === "gamelog" && <GameLog games={stats?.gameBreakdown ?? null} />}
          {tab === "advanced" && <AdvancedMetrics s={s} />}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Team card */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[var(--color-surface)] px-4 py-3.5">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="w-9 h-9 object-contain" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-white truncate">{teamFullName}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{statsSeasonLabel}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          </div>

          <Panel title="Player Info">
            <div className="px-4 py-1">
              <InfoRow label="Full Name" value={data.player_name} />
              <InfoRow label="Team" value={teamFullName} />
              <InfoRow label="Position" value={data.position} />
              <InfoRow label="Age" value={data.age} />
              <InfoRow label="Height" value={heightDisplay} />
              <InfoRow label="Weight" value={weightDisplay} />
              <InfoRow label="Born" value={birthDisplay} />
              <InfoRow label="Games Played" value={data.games_played} />
              <InfoRow label="Min / Game" value={data.minutes_per_game != null ? fmt(data.minutes_per_game) : null} />
              <InfoRow label="Tier" value={data.tier} />
            </div>
          </Panel>

          <Panel title="Season Averages" action={<span className="text-[11px] text-[var(--color-text-muted)]">{statsSeason}</span>}>
            <div className="px-4 py-2">
              <AverageBar label="Points" value={s?.ppg} max={35} />
              <AverageBar label="Rebounds" value={s?.rpg} max={15} />
              <AverageBar label="Assists" value={s?.apg} max={12} />
              <AverageBar label="Steals" value={s?.spg} max={3} />
              <AverageBar label="Blocks" value={s?.bpg} max={3} />
              <AverageBar label="Turnovers" value={s?.tovPerG} max={5} />
              <p className="text-[10px] text-[var(--color-text-muted)] pt-2">All stats per game</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

/** Thin bullet separator between hero attributes. */
function Sep() {
  return <span className="text-[var(--color-text-muted)]/40">·</span>
}

// ─── Overview tab ────────────────────────────────────────────────────────

function OverviewTab({ data, games, s }: { data: any; games: GameRow[] | null; s: SeasonStats }) {
  return (
    <div className="space-y-5">
      <Panel title="Recent Games">
        <RecentGamesTable games={games ? games.slice(-5).reverse() : null} />
      </Panel>

      {/* Advanced metrics on overview */}
      <AdvancedMetrics s={s} />

      {/* Ranking analysis + radar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel title="Analysis">
          <div className="p-4 space-y-3">
            {data.explanation && (
              <p className="text-[14px] leading-relaxed text-[var(--color-text-primary)]">{data.explanation}</p>
            )}
            {data.outlook && (
              <p className="text-[13px] text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-3">{data.outlook}</p>
            )}
            <div className="flex flex-col gap-1.5 pt-1">
              {data.strengths?.map((x: string) => (
                <div key={x} className="flex items-center gap-2 text-[13px] text-[var(--color-text-primary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {x}
                </div>
              ))}
              {data.weaknesses?.map((x: string) => (
                <div key={x} className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/50" /> {x}
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Skill Profile">
          <div className="p-4 flex items-center justify-center">
            <ScoreRadar
              size={220}
              offense={data.offense_score}
              defense={data.defense_score}
              scoring={data.scoring_score}
              playmaking={data.playmaking_score}
              rebounding={data.rebounding_score}
              shooting={data.shooting_score}
            />
          </div>
        </Panel>
      </div>

      {data.ranking_history?.length > 0 && (
        <Panel title="Ranking History">
          <div className="p-4">
            <RankingTimeline data={data.ranking_history} height={160} />
          </div>
        </Panel>
      )}
    </div>
  )
}

// ─── Recent games (compact, overview) ──────────────────────────────────────

function RecentGamesTable({ games }: { games: GameRow[] | null }) {
  if (!games || games.length === 0) {
    return <p className="p-4 text-[13px] text-[var(--color-text-muted)]">No recent games.</p>
  }
  return (
    <div className="overflow-x-auto scrollbar-hide">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            <th className="text-left font-semibold px-4 py-2.5">Date</th>
            <th className="text-left font-semibold px-2 py-2.5">Opp</th>
            <th className="text-right font-semibold px-2 py-2.5">Min</th>
            <th className="text-right font-semibold px-2 py-2.5">PTS</th>
            <th className="text-right font-semibold px-2 py-2.5">REB</th>
            <th className="text-right font-semibold px-2 py-2.5">AST</th>
            <th className="text-right font-semibold px-4 py-2.5">FG</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g, i) => (
            <tr key={i} className="border-t border-[var(--color-border)] hover:bg-white/[0.02]">
              <td className="px-4 py-2.5 text-[var(--color-text-muted)] whitespace-nowrap">{fmtDate(g.date)}</td>
              <td className="px-2 py-2.5 font-medium text-[var(--color-text-primary)]">{g.opponent}</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-[var(--color-text-muted)]">{g.minutes ?? "—"}</td>
              <td className="px-2 py-2.5 text-right font-bold tabular-nums text-[var(--color-text-primary)]">{g.pts}</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-[var(--color-text-primary)]">{g.trb}</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-[var(--color-text-primary)]">{g.ast}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-[var(--color-text-muted)]">{g.fg}-{g.fga}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Full game log ─────────────────────────────────────────────────────────

function GameLog({ games }: { games: GameRow[] | null }) {
  if (!games || games.length === 0) {
    return <Panel title="Game Log"><p className="p-4 text-[13px] text-[var(--color-text-muted)]">No game log available.</p></Panel>
  }
  return (
    <Panel title="Game Log">
      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              {["Date", "Opp", "Min", "PTS", "REB", "AST", "FG", "3P", "FT"].map((h) => (
                <th key={h} className={`font-semibold py-2.5 px-2 ${h === "Date" ? "text-left pl-4" : h === "Opp" ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {games.map((g, i) => (
              <tr key={i} className="border-t border-[var(--color-border)] hover:bg-white/[0.02]">
                <td className="py-2.5 px-4 text-[var(--color-text-muted)] whitespace-nowrap">{fmtDate(g.date)}</td>
                <td className="py-2.5 px-2 font-medium text-[var(--color-text-primary)]">{g.opponent}</td>
                <td className="py-2.5 px-2 text-right tabular-nums text-[var(--color-text-muted)]">{g.minutes ?? "—"}</td>
                <td className="py-2.5 px-2 text-right font-bold tabular-nums text-[var(--color-text-primary)]">{g.pts}</td>
                <td className="py-2.5 px-2 text-right tabular-nums">{g.trb}</td>
                <td className="py-2.5 px-2 text-right tabular-nums">{g.ast}</td>
                <td className="py-2.5 px-2 text-right tabular-nums text-[var(--color-text-muted)]">{g.fg}-{g.fga}</td>
                <td className="py-2.5 px-2 text-right tabular-nums text-[var(--color-text-muted)]">{g.tp}-{g.tpa}</td>
                <td className="py-2.5 px-2 text-right tabular-nums text-[var(--color-text-muted)]">{g.ft}-{g.fta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

// ─── Season stats table ────────────────────────────────────────────────────

function SeasonStatsTable({ s }: { s: SeasonStats }) {
  const rows: { label: string; value: string }[] = [
    { label: "Points", value: fmt(s?.ppg) },
    { label: "Rebounds", value: fmt(s?.rpg) },
    { label: "Assists", value: fmt(s?.apg) },
    { label: "Steals", value: fmt(s?.spg) },
    { label: "Blocks", value: fmt(s?.bpg) },
    { label: "Minutes", value: fmt(s?.mpg) },
    { label: "Field Goal %", value: fmtDecPct(s?.fgPct) },
    { label: "Three Point %", value: fmtDecPct(s?.fg3Pct) },
    { label: "Free Throw %", value: fmtDecPct(s?.ftPct) },
    { label: "Effective FG %", value: fmtDecPct(s?.efgPct) },
  ]
  return (
    <Panel title="Season Stats">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {rows.map((r, i) => (
          <div key={r.label} className={`flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] ${i % 2 === 0 ? "sm:border-r" : ""}`}>
            <span className="text-[13px] text-[var(--color-text-muted)]">{r.label}</span>
            <span className="text-[13px] font-bold tabular-nums text-[var(--color-text-primary)]">{r.value}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ─── Advanced metrics grid ─────────────────────────────────────────────────

function AdvancedMetrics({ s }: { s: SeasonStats }) {
  const cells: { value: string; label: string }[] = [
    { value: fmt(s?.per), label: "PER" },
    { value: fmt(s?.ws), label: "WS" },
    { value: fmt(s?.wsPer48, 3), label: "WS/48" },
    { value: fmtPct(s?.usgPct), label: "USG%" },
    { value: fmtDecPct(s?.tsPct), label: "TS%" },
    { value: fmt(s?.bpm), label: "BPM" },
    { value: fmt(s?.obpm), label: "OBPM" },
    { value: fmt(s?.dbpm), label: "DBPM" },
    { value: fmt(s?.vorp), label: "VORP" },
    { value: fmt(s?.offRtg, 0), label: "OffRtg" },
    { value: fmt(s?.defRtg, 0), label: "DefRtg" },
    { value: fmtPct(s?.astPct), label: "AST%" },
    { value: fmtPct(s?.trbPct), label: "REB%" },
    { value: fmtPct(s?.stlPct), label: "STL%" },
    { value: fmtPct(s?.blkPct), label: "BLK%" },
    { value: fmtPct(s?.tovPct), label: "TOV%" },
  ]
  return (
    <Panel title="Advanced Metrics">
      <div className="grid grid-cols-3 sm:grid-cols-4 [&>*:nth-last-child(-n+4)]:border-b-0">
        {cells.map((c) => (
          <MetricCell key={c.label} value={c.value} label={c.label} />
        ))}
      </div>
    </Panel>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(date: string | null): string {
  if (!date) return "—"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/** Convert a Basketball-Reference height ("6-6") to display form (6'6"). */
function fmtHeight(height: string | null | undefined): string | null {
  if (!height) return null
  const m = /^(\d)-(\d{1,2})$/.exec(height.trim())
  if (!m) return height
  return `${m[1]}'${m[2]}"`
}

/** Format a birth date (ISO) as "Mon D, YYYY". */
function fmtBirthDate(date: string | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}
