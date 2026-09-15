"use client"

import { useEffect, useMemo, useState } from "react"
import { notFound } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { TierBadge } from "@/components/rankings/TierBadge"
import { RankMovement } from "@/components/rankings/RankMovement"
import { ScoreRadar } from "@/components/rankings/ScoreRadar"
import { PlayerDetailSkeleton } from "@/components/rankings/RankingsSkeleton"
import {
  HeadlineStat, TabBar, Panel, InfoRow, MetricCell, fmt,
} from "@/components/rankings/PlayerDetailParts"
import { getTeamLogoUrl } from "@/lib/constants/teams"

// ─── Types ───────────────────────────────────────────────────────────────────

type NflSeasonStats = {
  games: number
  passYds: number; passTd: number; passInt: number; passYdsPerG: number; completionPct: number | null
  rushYds: number; rushTd: number; rushAtt: number; rushYdsPerG: number; yardsPerCarry: number | null
  rec: number; recYds: number; recTd: number; targets: number; recYdsPerG: number
  catchPct: number | null; yardsPerRec: number | null
  tackles: number; sacks: number; defInt: number; tacklesPerG: number
} | null

type NflGameRow = {
  date: string | null; opponent: string; position: string | null
  passYds: number; passTd: number; passInt: number; passAtt: number; passComp: number
  rushYds: number; rushTd: number; rushAtt: number
  rec: number; recYds: number; recTd: number; targets: number
  tackles: number; sacks: number; defInt: number
}

type Tab = "overview" | "stats" | "gamelog"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Stats" },
  { id: "gamelog", label: "Game Log" },
]

type PosGroup = "QB" | "RB" | "WR" | "TE" | "DEF" | "FLEX"

function posGroup(position: string | null | undefined): PosGroup {
  const p = (position ?? "").toUpperCase()
  if (p === "QB") return "QB"
  if (p === "RB" || p === "FB" || p === "HB") return "RB"
  if (p === "WR") return "WR"
  if (p === "TE") return "TE"
  if (p === "DEF" || ["DE","DT","LB","CB","S","DB","EDGE","NT","OLB","ILB","MLB","SS","FS"].includes(p)) return "DEF"
  return "FLEX"
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NflPlayerDetail({ playerId, season }: { playerId: string; season: string }) {
  const [data, setData] = useState<any>(null)
  const [stats, setStats] = useState<{ seasonStats: NflSeasonStats; gameBreakdown: NflGameRow[] | null; statsSeason: string | null } | null>(null)
  const [headshot, setHeadshot] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("overview")

  // 1. Ranking detail
  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await fetch(`/api/rankings/players/${playerId}?sport=NFL&season=${season}`)
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
    run()
    return () => { cancelled = true }
  }, [playerId, season])

  // 2. Box scores + headshot, keyed on resolved name
  useEffect(() => {
    if (!data?.player_name) return
    let cancelled = false
    const name = data.player_name as string
    const team = (data.team ?? "") as string
    setHeadshot(data.headshot_url ?? null)

    fetch(`/api/rankings/nfl-player-stats?player=${encodeURIComponent(name)}`, { cache: "no-store" })
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

    fetch(`/api/players/headshot?name=${encodeURIComponent(name)}&team=${encodeURIComponent(team)}&sport=NFL`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.success && json.headshot) setHeadshot(json.headshot)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [data?.player_name, data?.team, data?.headshot_url])

  const logoUrl = useMemo(() => getTeamLogoUrl(data?.team ?? "", "NFL"), [data?.team])
  const group = posGroup(data?.position)
  const s = stats?.seasonStats ?? null
  const statsSeason = stats?.statsSeason ?? season

  if (loading) return <PlayerDetailSkeleton />
  if (!data) return notFound()

  const initials = data.player_name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2)
  const nameParts: string[] = (data.player_name ?? "").split(" ").filter(Boolean)
  const nameLines: string[] = nameParts.length <= 1 ? nameParts : [nameParts[0], nameParts.slice(1).join(" ")]

  // Position-appropriate headline stats.
  const headline = buildHeadline(group, s, data)

  return (
    <div className="min-h-full pb-20">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto px-4 md:px-6 pt-3">
        <div className="relative overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#050607]">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(95%_130%_at_19%_100%,#20242b_0%,#0b0d11_43%,#050607_78%)]" />
            <div className="absolute -left-16 -bottom-24 h-64 w-64 rounded-full bg-[var(--color-lime)]/[0.04] blur-3xl" />
          </div>

          <nav aria-label="breadcrumb" className="absolute left-4 right-4 top-3 z-30 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            <Link href={`/rankings?sport=NFL`} className="inline-flex shrink-0 items-center gap-1.5 transition-colors hover:text-[var(--color-lime)]">
              <ArrowLeft className="h-3.5 w-3.5" /> NFL Rankings
            </Link>
            <ChevronRight aria-hidden className="h-3 w-3 shrink-0 opacity-40" />
            <span aria-current="page" className="min-w-0 truncate text-[var(--color-text-primary)]">{data.player_name}</span>
          </nav>

          <div className="relative flex min-h-[250px] flex-col pt-10 md:grid md:grid-cols-[250px_minmax(0,1fr)] md:pt-9">
            <div className="relative min-h-[238px] overflow-hidden md:min-h-0">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" aria-hidden className="pointer-events-none absolute left-4 top-4 h-28 w-28 object-contain opacity-[0.11]" />
              )}
              {headshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={headshot} alt={data.player_name} className="absolute bottom-0 left-1/2 z-10 h-[272px] w-auto -translate-x-[38%] object-contain object-bottom drop-shadow-[0_22px_36px_rgba(0,0,0,0.55)] md:left-auto md:right-[-10px] md:translate-x-0" />
              ) : (
                <div className="absolute bottom-4 right-5 flex h-48 w-36 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-4xl font-black text-white/20">{initials}</div>
              )}
            </div>

            <div className="relative z-20 flex min-w-0 flex-col justify-center px-5 pb-6 pt-3 md:px-5 md:pb-5 md:pt-5 lg:pr-16">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-white/[0.08] bg-white/[0.06] px-2 py-0.5 text-[12px] font-black tabular-nums text-white">#{data.overall_rank ?? "—"}</span>
                <TierBadge tier={data.tier} />
                <RankMovement change={data.rank_change} isNew={data.is_new} />
              </div>

              <h1 className="mt-2 font-black uppercase leading-[0.84] tracking-[-0.05em] text-white [font-size:clamp(36px,4.35vw,66px)]">
                {nameLines.map((line, i) => (<span key={i} className="block">{line}</span>))}
              </h1>

              <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    {logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="" className="h-7 w-7 object-contain" />
                    )}
                    <span className="truncate text-[14px] font-bold tracking-tight text-white">{data.team ?? "Free Agent"}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    {data.position && <span className="text-[var(--color-text-primary)]">{data.position}</span>}
                    {data.games_played != null && <><Sep />{data.games_played} GP</>}
                  </div>
                </div>

                {data.signature && (
                  <blockquote className="max-w-[230px] border-l border-white/10 pl-3 lg:max-w-[210px] lg:pl-4">
                    <p className="font-serif text-[12px] italic leading-snug text-white/70 lg:text-[13px]">&ldquo;{data.signature}&rdquo;</p>
                  </blockquote>
                )}
              </div>
            </div>
          </div>

          {/* Headline stat bar */}
          <div className="relative flex items-stretch bg-black/30 border-t border-white/[0.06] overflow-x-auto scrollbar-hide">
            <HeadlineStat value={fmt(data.overall_score)} label="Overall Score" sub={data.overall_rank != null ? `#${data.overall_rank} IN NFL` : null} highlight />
            {headline.map((h) => (
              <HeadlineStat key={h.label} value={h.value} label={h.label} />
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 mt-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5 min-w-0">
          <TabBar tabs={TABS} active={tab} onChange={setTab} />
          {tab === "overview" && <NflOverview data={data} games={stats?.gameBreakdown ?? null} group={group} />}
          {tab === "stats" && <NflSeasonStatsTable s={s} group={group} />}
          {tab === "gamelog" && <NflGameLog games={stats?.gameBreakdown ?? null} group={group} />}
        </div>

        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[var(--color-surface)] px-4 py-3.5">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="w-9 h-9 object-contain" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-white truncate">{data.team ?? "Free Agent"}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{statsSeason} Season</div>
            </div>
          </div>

          <Panel title="Player Info">
            <div className="px-4 py-1">
              <InfoRow label="Full Name" value={data.player_name} />
              <InfoRow label="Team" value={data.team} />
              <InfoRow label="Position" value={data.position} />
              <InfoRow label="Games Played" value={data.games_played} />
              <InfoRow label="Tier" value={data.tier} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Sep() { return <span className="text-[var(--color-text-muted)]/40">·</span> }

// ─── Headline builder ──────────────────────────────────────────────────────

function buildHeadline(group: PosGroup, s: NflSeasonStats, data: any): { value: string; label: string }[] {
  if (!s) return []
  switch (group) {
    case "QB":
      return [
        { value: String(s.passYds), label: "PASS YDS" },
        { value: String(s.passTd), label: "PASS TD" },
        { value: String(s.passInt), label: "INT" },
        { value: s.completionPct != null ? `${s.completionPct}%` : "—", label: "COMP%" },
        { value: String(s.rushYds), label: "RUSH YDS" },
      ]
    case "RB":
      return [
        { value: String(s.rushYds), label: "RUSH YDS" },
        { value: s.yardsPerCarry != null ? String(s.yardsPerCarry) : "—", label: "YPC" },
        { value: String(s.rushTd + s.recTd), label: "TOTAL TD" },
        { value: String(s.rec), label: "REC" },
        { value: String(s.recYds), label: "REC YDS" },
      ]
    case "WR":
    case "TE":
    case "FLEX":
      return [
        { value: String(s.rec), label: "REC" },
        { value: String(s.recYds), label: "REC YDS" },
        { value: String(s.recTd), label: "REC TD" },
        { value: s.catchPct != null ? `${s.catchPct}%` : "—", label: "CATCH%" },
        { value: s.yardsPerRec != null ? String(s.yardsPerRec) : "—", label: "YDS/REC" },
      ]
    case "DEF":
      return [
        { value: String(s.tackles), label: "TACKLES" },
        { value: String(s.sacks), label: "SACKS" },
        { value: String(s.defInt), label: "INT" },
        { value: fmt(s.tacklesPerG), label: "TKL/G" },
      ]
  }
}

// ─── Overview ────────────────────────────────────────────────────────────────

function NflOverview({ data, games, group }: { data: any; games: NflGameRow[] | null; group: PosGroup }) {
  return (
    <div className="space-y-5">
      <Panel title="Recent Games">
        <NflGamesTable games={games ? games.slice(-5).reverse() : null} group={group} />
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel title="Analysis">
          <div className="p-4 space-y-3">
            {data.explanation && <p className="text-[14px] leading-relaxed text-[var(--color-text-primary)]">{data.explanation}</p>}
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
              rebounding={data.shooting_score /* efficiency */}
              shooting={data.two_way_score}
            />
          </div>
        </Panel>
      </div>
    </div>
  )
}

// ─── Season stats ──────────────────────────────────────────────────────────

function NflSeasonStatsTable({ s, group }: { s: NflSeasonStats; group: PosGroup }) {
  if (!s) return <Panel title="Season Stats"><p className="p-4 text-[13px] text-[var(--color-text-muted)]">No stats available.</p></Panel>

  const rows = seasonRows(group, s)
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

function seasonRows(group: PosGroup, s: NflSeasonStats): { label: string; value: string }[] {
  if (!s) return []
  const common = [{ label: "Games Played", value: String(s.games) }]
  switch (group) {
    case "QB":
      return [
        ...common,
        { label: "Passing Yards", value: String(s.passYds) },
        { label: "Passing TD", value: String(s.passTd) },
        { label: "Interceptions", value: String(s.passInt) },
        { label: "Completion %", value: s.completionPct != null ? `${s.completionPct}%` : "—" },
        { label: "Pass Yds / Game", value: fmt(s.passYdsPerG) },
        { label: "Rushing Yards", value: String(s.rushYds) },
        { label: "Rushing TD", value: String(s.rushTd) },
      ]
    case "RB":
      return [
        ...common,
        { label: "Rushing Yards", value: String(s.rushYds) },
        { label: "Carries", value: String(s.rushAtt) },
        { label: "Yards / Carry", value: s.yardsPerCarry != null ? String(s.yardsPerCarry) : "—" },
        { label: "Rushing TD", value: String(s.rushTd) },
        { label: "Receptions", value: String(s.rec) },
        { label: "Receiving Yards", value: String(s.recYds) },
        { label: "Receiving TD", value: String(s.recTd) },
      ]
    case "WR":
    case "TE":
    case "FLEX":
      return [
        ...common,
        { label: "Receptions", value: String(s.rec) },
        { label: "Targets", value: String(s.targets) },
        { label: "Catch %", value: s.catchPct != null ? `${s.catchPct}%` : "—" },
        { label: "Receiving Yards", value: String(s.recYds) },
        { label: "Yards / Reception", value: s.yardsPerRec != null ? String(s.yardsPerRec) : "—" },
        { label: "Receiving TD", value: String(s.recTd) },
        { label: "Rec Yds / Game", value: fmt(s.recYdsPerG) },
      ]
    case "DEF":
      return [
        ...common,
        { label: "Total Tackles", value: String(s.tackles) },
        { label: "Sacks", value: String(s.sacks) },
        { label: "Interceptions", value: String(s.defInt) },
        { label: "Tackles / Game", value: fmt(s.tacklesPerG) },
      ]
  }
}

// ─── Game log ────────────────────────────────────────────────────────────────

function NflGamesTable({ games, group }: { games: NflGameRow[] | null; group: PosGroup }) {
  if (!games || games.length === 0) return <p className="p-4 text-[13px] text-[var(--color-text-muted)]">No recent games.</p>
  const cols = logColumns(group)
  return (
    <div className="overflow-x-auto scrollbar-hide">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
            <th className="text-left font-semibold px-4 py-2.5">Date</th>
            <th className="text-left font-semibold px-2 py-2.5">Opp</th>
            {cols.map((c) => (<th key={c.label} className="text-right font-semibold px-2 py-2.5">{c.label}</th>))}
          </tr>
        </thead>
        <tbody>
          {games.map((g, i) => (
            <tr key={i} className="border-t border-[var(--color-border)] hover:bg-white/[0.02]">
              <td className="px-4 py-2.5 text-[var(--color-text-muted)] whitespace-nowrap">{fmtDate(g.date)}</td>
              <td className="px-2 py-2.5 font-medium text-[var(--color-text-primary)]">{g.opponent}</td>
              {cols.map((c) => (<td key={c.label} className="px-2 py-2.5 text-right tabular-nums text-[var(--color-text-primary)]">{c.get(g)}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NflGameLog({ games, group }: { games: NflGameRow[] | null; group: PosGroup }) {
  if (!games || games.length === 0) return <Panel title="Game Log"><p className="p-4 text-[13px] text-[var(--color-text-muted)]">No game log available.</p></Panel>
  return (
    <Panel title="Game Log">
      <NflGamesTable games={games.slice().reverse()} group={group} />
    </Panel>
  )
}

function logColumns(group: PosGroup): { label: string; get: (g: NflGameRow) => number | string }[] {
  switch (group) {
    case "QB":
      return [
        { label: "C/A", get: (g) => `${g.passComp}/${g.passAtt}` },
        { label: "YDS", get: (g) => g.passYds },
        { label: "TD", get: (g) => g.passTd },
        { label: "INT", get: (g) => g.passInt },
        { label: "RUSH", get: (g) => g.rushYds },
      ]
    case "RB":
      return [
        { label: "CAR", get: (g) => g.rushAtt },
        { label: "YDS", get: (g) => g.rushYds },
        { label: "TD", get: (g) => g.rushTd },
        { label: "REC", get: (g) => g.rec },
        { label: "REC YDS", get: (g) => g.recYds },
      ]
    case "WR":
    case "TE":
    case "FLEX":
      return [
        { label: "REC", get: (g) => g.rec },
        { label: "TGT", get: (g) => g.targets },
        { label: "YDS", get: (g) => g.recYds },
        { label: "TD", get: (g) => g.recTd },
      ]
    case "DEF":
      return [
        { label: "TKL", get: (g) => g.tackles },
        { label: "SACK", get: (g) => g.sacks },
        { label: "INT", get: (g) => g.defInt },
      ]
  }
}

function fmtDate(date: string | null): string {
  if (!date) return "—"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
