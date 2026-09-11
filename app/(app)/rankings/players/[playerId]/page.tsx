"use client"

import { use, useEffect, useMemo, useState } from "react"
import { notFound } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Plus, ArrowLeftRight, ChevronRight, MoreHorizontal } from "lucide-react"
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
  fg: number; fga: number; tp: number; tpa: number; ft: number; fta: number; minutes?: number
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

    fetch(`/api/props/stats-reference?player=${encodeURIComponent(name)}&stat=pts`)
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

    fetch(`/api/players/headshot?name=${encodeURIComponent(name)}&team=${encodeURIComponent(team)}&sport=NBA`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.success && json.headshot) setHeadshot(json.headshot)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [data?.player_name, data?.team, data?.historical_team])

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
  const isPriorSeason = statsSeason !== season
  const statsSeasonLabel = statsSeason ? `${statsSeason} Season` : "—"

  if (loading) return <PlayerDetailSkeleton />
  if (!data) return notFound()

  const initials = data.player_name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2)

  return (
    <div className="min-h-full pb-20">
      {/* ── Back nav ─────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4">
        <Link
          href={`/rankings?season=${season}`}
          className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-lime)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Rankings
          <ChevronRight className="w-3.5 h-3.5 opacity-40" />
          <span className="text-[var(--color-text-primary)]">{data.player_name}</span>
        </Link>
      </div>

      {/* ── Cinematic hero ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto px-4 md:px-6 mt-3"
      >
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-black">
          {/* Full-bleed backdrop */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-surface-elevated)] via-black to-black" />
            {/* Big team-logo watermark, upper-left (like the reference) */}
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                aria-hidden
                className="pointer-events-none absolute left-2 top-2 w-40 h-40 object-contain opacity-[0.13]"
              />
            )}
            {/* Player initials watermark (right) */}
            <span className="absolute right-8 md:right-24 top-1/2 -translate-y-1/2 text-[130px] md:text-[190px] font-black leading-none text-white/[0.025] select-none pointer-events-none">
              {initials}
            </span>
          </div>

          <div className="relative flex flex-col md:flex-row items-stretch min-h-[230px]">
            {/* Left rail: vertical name + rank (like the reference) */}
            <div className="hidden lg:flex flex-col justify-end shrink-0 w-24 pl-5 pb-6 z-10">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]/50 leading-relaxed">
                {data.player_name?.split(" ").map((w: string) => (
                  <div key={w}>{w}</div>
                ))}
                <div className="mt-1.5">#{data.overall_rank ?? "—"}</div>
              </div>
            </div>

            {/* Headshot column */}
            <div className="relative w-full md:w-56 lg:w-64 shrink-0 flex items-end justify-center md:justify-start">
              {headshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={headshot}
                  alt={data.player_name}
                  className="h-52 md:h-[260px] w-auto object-contain object-bottom drop-shadow-2xl"
                />
              ) : (
                <div className="w-40 h-44 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-4xl font-black text-[var(--color-text-muted)]/40 mb-4">
                  {initials}
                </div>
              )}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0 px-6 md:px-4 pb-6 pt-4 md:pt-8 flex flex-col justify-center">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[14px] font-black text-[var(--color-text-primary)] tabular-nums bg-white/[0.06] border border-[var(--color-border)] px-2 py-0.5 rounded-md">
                  #{data.overall_rank ?? "—"}
                </span>
                <TierBadge tier={data.tier} />
                <RankMovement change={data.rank_change} isNew={data.is_new} />
              </div>

              <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mt-2 leading-[0.92]">
                {data.player_name}
              </h1>

              {/* Team row — logo + FULL name */}
              <div className="flex items-center gap-2.5 mt-3">
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="w-7 h-7 object-contain" />
                )}
                <span className="text-[15px] md:text-[17px] font-bold text-[var(--color-text-primary)]">{teamFullName}</span>
              </div>

              {/* Attribute row with separators */}
              <div className="flex items-center gap-2.5 flex-wrap mt-2 text-[13px] text-[var(--color-text-muted)]">
                {data.position && <span className="font-semibold text-[var(--color-text-primary)]">{data.position}</span>}
                {data.age != null && <><Sep />Age {data.age}</>}
                {data.games_played != null && <><Sep />{data.games_played} GP</>}
                {data.minutes_per_game != null && <><Sep />{fmt(data.minutes_per_game)} MPG</>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4">
                <button className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--color-lime)] text-black text-[13px] font-bold hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4" /> Add to Watchlist
                </button>
                <button className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-[var(--color-border)] text-[13px] font-semibold text-[var(--color-text-primary)] hover:bg-white/[0.1] transition-colors">
                  <ArrowLeftRight className="w-4 h-4" /> Compare
                </button>
                <button className="w-10 h-10 rounded-xl bg-white/[0.06] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:bg-white/[0.1] transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quote / signature block (right) */}
            {data.signature && (
              <div className="hidden lg:flex flex-col justify-center pr-10 max-w-[230px] z-10">
                <p className="text-[14px] italic text-[var(--color-text-primary)]/85 leading-snug">
                  &ldquo;{data.signature}&rdquo;
                </p>
                {data.player_class && (
                  <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mt-1.5">
                    — {data.player_class}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Stats-season caption */}
          <div className="relative flex items-center gap-2 border-t border-[var(--color-border)] bg-black/20 px-4 pt-2.5">
            <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              {statsSeasonLabel} Stats
            </span>
            {isPriorSeason && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
                LAST SEASON · {season} not started
              </span>
            )}
          </div>

          {/* Headline stat bar. Sub-ranks come from the ranking engine's
              per-dimension league ranks (scoring / rebounding / playmaking /
              shooting) — the closest real rank we have for each stat. */}
          <div className="relative flex items-stretch bg-black/30 border-t border-[var(--color-border)] overflow-x-auto scrollbar-hide">
            <HeadlineStat
              value={fmt(data.overall_score)}
              label="Overall Score"
              sub={data.overall_rank != null ? `#${data.overall_rank} in NBA` : null}
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
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="w-9 h-9 object-contain" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-[var(--color-text-primary)] truncate">{data.team ?? "Free Agent"}</div>
              <div className="text-[11px] text-[var(--color-text-muted)]">{statsSeasonLabel}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          </div>

          <Panel title="Player Info">
            <div className="px-4 py-1">
              <InfoRow label="Full Name" value={data.player_name} />
              <InfoRow label="Team" value={teamFullName} />
              <InfoRow label="Position" value={data.position} />
              <InfoRow label="Age" value={data.age} />
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
        <RecentGamesTable games={games?.slice(0, 5) ?? null} />
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
