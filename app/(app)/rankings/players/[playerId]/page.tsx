"use client"

import { use, useEffect, useState } from "react"
import { notFound } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, ExternalLink } from "lucide-react"
import Link from "next/link"
import { TierBadge } from "@/components/rankings/TierBadge"
import { RankMovement } from "@/components/rankings/RankMovement"
import { ScoreRadar } from "@/components/rankings/ScoreRadar"
import { RankingTimeline } from "@/components/rankings/RankingTimeline"
import { PlayerDetailSkeleton } from "@/components/rankings/RankingsSkeleton"
import { getTeamLogoUrl } from "@/lib/constants/teams"

export default function PlayerRankingPage({ params, searchParams }: any) {
  const resolvedParams = use(params) as any
  const resolvedSearchParams = use(searchParams) as any
  const playerId = resolvedParams.playerId
  const season = resolvedSearchParams.season ?? "2026-27"

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPlayer() {
      try {
        const res = await fetch(`/api/rankings/players/${playerId}?season=${season}`)
        if (!res.ok) {
          if (res.status === 404) notFound()
          throw new Error("Failed to load player")
        }
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPlayer()
  }, [playerId, season])

  if (loading) return <PlayerDetailSkeleton />
  if (!data) return notFound()

  const isTeamChange = data.team !== data.historical_team && data.historical_team != null
  const logoUrl = getTeamLogoUrl(data.team ?? "", "nba")

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
        {/* Abstract background accent */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-[var(--color-lime)]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex-1 space-y-4 w-full">
          {/* Top meta */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-[var(--color-lime)] text-black font-black text-xl tabular-nums leading-none">
              #{data.overall_rank}
            </span>
            <TierBadge tier={data.tier} />
            {data.position && (
              <span className="text-xs font-bold text-white/50 bg-white/5 px-2 py-1 rounded">
                {data.position}
              </span>
            )}
            {data.age && (
              <span className="text-xs font-bold text-white/50 bg-white/5 px-2 py-1 rounded">
                Age {data.age}
              </span>
            )}
            <RankMovement change={data.rank_change} isNew={data.is_new} className="ml-2" />
          </div>

          {/* Name & Title */}
          <div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[var(--color-text-primary)]">
              {data.player_name}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-[var(--color-text-muted)]">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="w-5 h-5 object-contain" />
              )}
              <span className="font-medium text-sm md:text-base">
                {isTeamChange ? (
                  <>
                    <span className="line-through opacity-50 mr-2">{data.historical_team}</span>
                    <span className="text-[var(--color-lime)]">{data.team}</span>
                  </>
                ) : (
                  data.team ?? "Free Agent"
                )}
              </span>
            </div>
          </div>

          {/* Core Stats Row */}
          <div className="flex items-center gap-6 pt-2">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] mb-0.5">
                Overall Score
              </div>
              <div className="text-2xl font-black tabular-nums text-white">
                {data.overall_score?.toFixed(1) ?? "—"}
              </div>
            </div>
            {data.confidence != null && (
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] mb-0.5">
                  Confidence
                </div>
                <div className="text-2xl font-black tabular-nums text-white">
                  {data.confidence.toFixed(0)}%
                </div>
              </div>
            )}
            {data.low_confidence && (
              <div className="text-xs font-semibold px-2 py-1 rounded bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
                Small Sample Size
              </div>
            )}
          </div>
        </div>

        {/* Radar Chart */}
        <div className="w-full md:w-64 flex-shrink-0 flex items-center justify-center -m-4 md:m-0 z-10">
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
      </motion.div>

      {/* ── Explanation & Outlook ──────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4"
        >
          <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
            Analysis
          </h2>
          <p className="text-lg leading-relaxed text-[var(--color-text-primary)] font-medium">
            {data.explanation}
          </p>
          {data.outlook && (
            <p className="text-sm text-[var(--color-text-muted)] border-t border-white/10 pt-4 mt-2">
              {data.outlook}
            </p>
          )}

          {/* Strengths & Weaknesses */}
          <div className="pt-2 flex flex-col gap-2">
            {data.strengths?.map((s: string) => (
              <div key={s} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {s}
              </div>
            ))}
            {data.weaknesses?.map((w: string) => (
              <div key={w} className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400/50" />
                {w}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── History & Details ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-6"
        >
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <RankingTimeline data={data.ranking_history} height={160} />
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
            <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              Component Scores
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Offense", value: data.offense_score },
                { label: "Defense", value: data.defense_score },
                { label: "Scoring", value: data.scoring_score },
                { label: "Playmaking", value: data.playmaking_score },
                { label: "Rebounding", value: data.rebounding_score },
                { label: "Shooting", value: data.shooting_score },
                { label: "Two-Way", value: data.two_way_score },
                { label: "Availability", value: data.availability_score },
              ].map((comp) => (
                <div key={comp.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">{comp.label}</span>
                    <span className="font-semibold text-white">{comp.value?.toFixed(1) ?? "—"}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    {comp.value != null && (
                      <div
                        className="h-full bg-[var(--color-lime)] rounded-full"
                        style={{ width: `${comp.value}%` }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
