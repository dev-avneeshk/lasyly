"use client"

import { use, useEffect, useState } from "react"
import { notFound, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { TierBadge } from "@/components/rankings/TierBadge"
import { RankMovement } from "@/components/rankings/RankMovement"
import { PlayerDetailSkeleton } from "@/components/rankings/RankingsSkeleton"
import { RankingTimeline } from "@/components/rankings/RankingTimeline"
import { getTeamLogoUrl } from "@/lib/constants/teams"

export default function TeamRankingPage({ params, searchParams }: any) {
  const router = useRouter()
  const resolvedParams = use(params) as any
  const resolvedSearchParams = use(searchParams) as any
  const team = resolvedParams.team
  const season = resolvedSearchParams.season ?? "2026-27"

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTeam() {
      try {
        const res = await fetch(`/api/rankings/teams/${team}?season=${season}`)
        if (!res.ok) {
          if (res.status === 404) notFound()
          throw new Error("Failed to load team")
        }
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchTeam()
  }, [team, season])

  if (loading) return <PlayerDetailSkeleton />
  if (!data) return notFound()

  const logoUrl = getTeamLogoUrl(data.team, "nba")

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-20 space-y-6">
      {/* ── Back Navigation ────────────────────────────────────────────────── */}
      <Link
        href={`/rankings?season=${season}`}
        className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-lime)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Rankings
      </Link>

      {/* ── Header Card ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 md:gap-10"
      >
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-[var(--color-lime)]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex-1 space-y-4 w-full">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--color-lime)] text-black font-black text-xl tabular-nums leading-none">
              #{data.rank}
            </span>
            {data.tier && <TierBadge tier={data.tier} />}
            <RankMovement change={data.rank_change} className="ml-2" />
          </div>

          <div>
            <div className="flex items-center gap-4">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="w-10 h-10 object-contain" />
              )}
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--color-text-primary)]">
                {data.team_full_name ?? data.team}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-8 pt-2">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] mb-0.5">
                Power Score
              </div>
              <div className="text-2xl font-black tabular-nums text-white">
                {data.power_score?.toFixed(1) ?? "—"}
              </div>
            </div>
            {data.projected_wins != null && (
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] mb-0.5">
                  Proj. Wins
                </div>
                <div className="text-2xl font-black tabular-nums text-[var(--color-lime)]">
                  {data.projected_wins}
                </div>
              </div>
            )}
            {data.returning_core_pct != null && (
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] mb-0.5">
                  Continuity
                </div>
                <div className="text-2xl font-black tabular-nums text-white">
                  {data.returning_core_pct}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Component Scores */}
        <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-3 z-10 p-4 rounded-xl bg-white/5 border border-white/5">
          {[
            { label: "Offense", value: data.offensive_score, color: "#D4FF00" },
            { label: "Defense", value: data.defensive_score, color: "#60A5FA" },
            { label: "Depth", value: data.depth_score, color: "#A78BFA" },
            { label: "Star Power", value: data.star_power_score, color: "#F59E0B" },
          ].map((comp) => (
            <div key={comp.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-text-muted)] font-semibold">{comp.label}</span>
                <span className="font-bold tabular-nums text-white/90">{comp.value?.toFixed(0) ?? "—"}</span>
              </div>
              <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                {comp.value != null && (
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${comp.value}%`, backgroundColor: comp.color }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Explanation ────────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4"
        >
          <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
            Outlook
          </h2>
          <p className="text-lg leading-relaxed text-[var(--color-text-primary)] font-medium">
            {data.explanation}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] border-t border-white/10 pt-4 mt-2">
            {data.why_ranked_here}
          </p>

          <div className="pt-2 flex flex-col gap-3">
            {data.key_additions?.length > 0 && (
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">Key Additions</span>
                <div className="text-sm text-white/80">{data.key_additions.join(", ")}</div>
              </div>
            )}
            {data.key_losses?.length > 0 && (
              <div>
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider block mb-1">Key Losses</span>
                <div className="text-sm text-white/80">{data.key_losses.join(", ")}</div>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 h-full flex flex-col">
            <RankingTimeline data={data.ranking_history} height={180} />
          </div>
        </motion.div>
      </div>

      {/* ── Projected Roster ───────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
      >
        <div className="p-4 md:p-6 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
            Projected Roster ({season})
          </h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {data.roster?.map((player: any, idx: number) => (
            <div
              key={player.player_name}
              onClick={() => router.push(`/rankings/players/${encodeURIComponent(player.player_name)}?season=${season}`)}
              className="px-4 py-3 md:px-6 md:py-4 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer group"
            >
              <div className="w-6 text-right font-bold text-[var(--color-text-muted)] group-hover:text-white transition-colors">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm md:text-base text-white group-hover:text-[var(--color-lime)] transition-colors">
                  {player.player_name}
                </div>
                {player.position && (
                  <div className="text-xs text-[var(--color-text-muted)]">{player.position}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="font-black tabular-nums text-white">
                  {player.score.toFixed(1)}
                </div>
                <TierBadge tier={player.tier} compact />
              </div>
            </div>
          ))}
          {(!data.roster || data.roster.length === 0) && (
            <div className="p-8 text-center text-[var(--color-text-muted)] text-sm">
              No roster data available.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
