"use client"

import Link from "next/link"
import { ArrowDown, ArrowUp, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { STAT_LABELS } from "@/lib/props/constants"
import type { EnhancedPropCardData } from "@/lib/analytics/types"
import type { MarketEdge } from "@/lib/props/market-edge"
import { PlayerPhoto } from "@/components/props/PlayerPhoto"
import { propDetailHref } from "./playerHref"

export interface BestPropsData {
  hitRate: EnhancedPropCardData[]
  overs: EnhancedPropCardData[]
  unders: EnhancedPropCardData[]
}

interface BestPropsPanelProps {
  best: BestPropsData | null
}

function formatPrice(price: number): string {
  return price > 0 ? `+${price}` : `${price}`
}

function formatPct(p: number): string {
  return `${Math.round(p * 100)}%`
}

function formatEdge(edge: number): string {
  const pts = Math.round(edge * 100)
  return `${pts >= 0 ? "+" : ""}${pts}%`
}

/**
 * Top props scored against the real Novig line: best hit rate on either side,
 * and the biggest edges on the over and on the under (the player's shrunk hit
 * rate beats the no-vig price, and the projection agrees).
 *
 * Renders nothing when the slate has no market lines yet — the lists only mean
 * something against a real price.
 */
export function BestPropsPanel({ best }: BestPropsPanelProps) {
  if (!best) return null
  const total = best.hitRate.length + best.overs.length + best.unders.length
  if (total === 0) return null

  return (
    <section aria-labelledby="best-props-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="best-props-heading"
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
        >
          Best props vs the line
        </h2>
        <p className="hidden sm:block text-[11px] text-[var(--color-text-muted)]/70">
          Scored against Novig prices · last 10 games
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <BestList
          title="Best hit rate"
          subtitle="Beats the line most often"
          icon={<Target className="h-3.5 w-3.5" />}
          accent="lime"
          props={best.hitRate}
          metric="hitRate"
        />
        <BestList
          title="Best overs"
          subtitle="Biggest edge on the over"
          icon={<ArrowUp className="h-3.5 w-3.5" />}
          accent="lime"
          props={best.overs}
          metric="edge"
        />
        <BestList
          title="Best unders"
          subtitle="Biggest edge on the under"
          icon={<ArrowDown className="h-3.5 w-3.5" />}
          accent="danger"
          props={best.unders}
          metric="edge"
        />
      </div>
    </section>
  )
}

function BestList({
  title,
  subtitle,
  icon,
  accent,
  props,
  metric,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  accent: "lime" | "danger"
  props: EnhancedPropCardData[]
  metric: "hitRate" | "edge"
}) {
  const accentText = accent === "lime" ? "text-[var(--color-lime)]" : "text-[var(--color-danger)]"
  const accentBg = accent === "lime" ? "bg-[var(--color-lime)]/10" : "bg-[var(--color-danger)]/10"

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", accentBg, accentText)}>
          {icon}
        </span>
        <div className="leading-tight">
          <h3 className="text-[13px] font-bold text-[var(--color-text-primary)]">{title}</h3>
          <p className="text-[11px] text-[var(--color-text-muted)]">{subtitle}</p>
        </div>
      </div>

      {props.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
          No props clear the bar right now.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-[var(--color-border)]">
          {props.map((prop, i) => (
            <BestRow key={`${prop.id}-${i}`} prop={prop} rank={i + 1} metric={metric} accentText={accentText} />
          ))}
        </ol>
      )}
    </div>
  )
}

function BestRow({
  prop,
  rank,
  metric,
  accentText,
}: {
  prop: EnhancedPropCardData
  rank: number
  metric: "hitRate" | "edge"
  accentText: string
}) {
  const edge = prop.marketEdge as MarketEdge
  const statLabel = STAT_LABELS[prop.statCategory] ?? prop.statCategory
  const sideLabel = edge.side === "over" ? "Over" : "Under"
  const headshotUrl = (prop as unknown as { headshotUrl?: string | null }).headshotUrl ?? null

  return (
    <li>
      <Link
        href={propDetailHref(prop)}
        className="group flex items-center gap-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/50 rounded-lg"
        aria-label={`${rank}. ${prop.player} ${sideLabel} ${prop.propLine} ${statLabel}, hit ${edge.hits} of ${edge.games}, Novig ${formatPrice(edge.price)}, edge ${formatEdge(edge.edge)}`}
      >
        <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-[var(--color-text-muted)]">
          {rank}
        </span>
        <PlayerPhoto playerName={prop.player} team={prop.team} sport={prop.sport} headshotUrl={headshotUrl} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-lime)] transition-colors">
            {prop.player}
          </p>
          <p className="truncate text-[11px] text-[var(--color-text-muted)]">
            <span className={cn("font-bold", edge.side === "over" ? "text-[var(--color-lime)]" : "text-[var(--color-danger)]")}>
              {sideLabel} {prop.propLine}
            </span>{" "}
            {statLabel} · {formatPrice(edge.price)}
          </p>
        </div>
        <div className="shrink-0 text-right leading-tight">
          {metric === "hitRate" ? (
            <>
              <p className={cn("text-[13px] font-extrabold tabular-nums", accentText)}>
                {edge.hits}/{edge.games}
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                edge {formatEdge(edge.edge)}
              </p>
            </>
          ) : (
            <>
              <p className={cn("text-[13px] font-extrabold tabular-nums", accentText)}>{formatEdge(edge.edge)}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                {formatPct(edge.modelProb)} vs {formatPct(edge.marketProb)}
              </p>
            </>
          )}
        </div>
      </Link>
    </li>
  )
}
