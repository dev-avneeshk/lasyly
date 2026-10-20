"use client"

import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatMultiplier } from "@/lib/props/prop-value"
import { formatValue, headshotOf, positionOf, shortName, sideOf, statAbbr } from "@/lib/props/display"
import type { EnhancedPropCardData } from "@/lib/analytics/types"
import { PlayerPhoto } from "@/components/props/PlayerPhoto"
import { propDetailHref } from "./playerHref"

export interface BestPropsData {
  top: EnhancedPropCardData[]
  overs: EnhancedPropCardData[]
  unders: EnhancedPropCardData[]
}

interface TopValuePropsProps {
  best: BestPropsData | null
  /** Cards shown in the strip. */
  count?: number
  onViewAll?: () => void
}

/**
 * Highest expected-value props on the slate (chance x multiplier - 1), ranked
 * by the multi-factor model in lib/props/prop-value. Renders nothing when no
 * priced prop clears the bar.
 */
export function TopValueProps({ best, count = 5, onViewAll }: TopValuePropsProps) {
  const list = best?.top.slice(0, count) ?? []
  if (list.length === 0) return null

  return (
    <section
      aria-labelledby="top-value-heading"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-lime)]/10 text-[var(--color-lime)]">
            <Star className="h-4 w-4 fill-current" />
          </span>
          <div className="leading-tight">
            <h2 id="top-value-heading" className="text-[14px] font-bold text-[var(--color-text-primary)]">
              Top Value Props
            </h2>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Highest projected value from our models
            </p>
          </div>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 text-[12px] font-bold text-[var(--color-lime)] hover:gap-1.5 transition-all"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {list.map((prop, i) => {
          const side = sideOf(prop)
          const v = prop.propValue
          const position = positionOf(prop)
          return (
            <li key={`${prop.id}-${i}`}>
              <Link
                href={propDetailHref(prop)}
                className="group flex h-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/40 p-3 transition-colors hover:border-[var(--color-lime)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/50"
                aria-label={`${i + 1}. ${prop.player} ${side} ${prop.propLine} ${statAbbr(prop.statCategory)}, value ${formatValue(v?.value)}, multiplier ${formatMultiplier(v?.multiplier)}`}
              >
                <span className="self-start flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] text-[10px] font-bold text-[var(--color-text-muted)]">
                  {i + 1}
                </span>
                <PlayerPhoto
                  playerName={prop.player}
                  team={prop.team}
                  sport={prop.sport}
                  headshotUrl={headshotOf(prop)}
                  size={44}
                />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[13px] font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-lime)] transition-colors">
                    {shortName(prop.player)}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {[position, prop.team].filter(Boolean).join(" • ")}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[12px] font-bold",
                      side === "over" ? "text-[var(--color-lime)]" : "text-[var(--color-danger)]"
                    )}
                  >
                    {side === "over" ? "Over" : "Under"} {prop.propLine}{" "}
                    <span className="text-[var(--color-text-primary)]">{statAbbr(prop.statCategory)}</span>
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span
                      className="text-[13px] font-extrabold tabular-nums text-emerald-400"
                      title="Expected return per unit: chance of hitting x multiplier - 1"
                    >
                      {formatValue(v?.value)}
                    </span>
                    <span className="rounded-md border border-[var(--color-lime)]/60 bg-[var(--color-lime)]/[0.08] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--color-lime)]">
                      {formatMultiplier(v?.multiplier)}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
