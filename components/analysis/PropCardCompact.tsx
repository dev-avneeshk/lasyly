"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowRight, Bookmark, Share2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { STAT_LABELS } from "@/lib/props/constants"
import { EnhancedPropCardData } from "@/lib/analytics/types"
import { getModelPrices } from "@/lib/props/odds"
import { formatGameDayTime } from "@/lib/props/dates"
import { resolveMatchup } from "@/lib/props/matchup"
import { PlayerPhoto } from "@/components/props/PlayerPhoto"
import { isTeamProp, propDetailHref } from "./playerHref"

interface PropCardCompactProps {
  prop: EnhancedPropCardData
  /** ISO kickoff/tip time for this player's game, when known. */
  gameTime?: string | null
  onAddToParlay?: (prop: EnhancedPropCardData, direction?: "over" | "under") => void
  onLogPick?: (prop: EnhancedPropCardData) => void
  onShare?: (prop: EnhancedPropCardData) => void
  parlayDisabled?: boolean
}

/** Number of recent games rendered in the sparkline. */
const SPARK_GAMES = 7

export function PropCardCompact({
  prop,
  gameTime,
  onAddToParlay,
  onLogPick,
  onShare,
  parlayDisabled,
}: PropCardCompactProps) {
  const router = useRouter()
  const href = propDetailHref(prop)
  const teamProp = isTeamProp(prop)

  const statLabel = STAT_LABELS[prop.statCategory] ?? prop.statCategory.toUpperCase()
  const prices = useMemo(() => getModelPrices(prop), [prop])
  const kickoff = formatGameDayTime(gameTime)
  const { opponent, prefix: venuePrefix } = useMemo(() => resolveMatchup(prop), [prop])

  // `lastGames` is most-recent-first; the sparkline reads left-to-right in time.
  const spark = useMemo(() => {
    const games = prop.lastGames ?? []
    return games.slice(0, SPARK_GAMES).reverse()
  }, [prop.lastGames])

  const sparkMax = useMemo(() => {
    const values = spark.map((g) => g.value)
    return Math.max(prop.propLine * 1.25, ...(values.length ? values : [prop.propLine]), 1)
  }, [spark, prop.propLine])

  const goToDetail = () => router.push(href)

  return (
    <article
      id={`prop-card-${prop.id}`}
      className="group h-full flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-4 transition-colors hover:border-[var(--color-lime)]/40 cursor-pointer"
      role="link"
      tabIndex={0}
      aria-label={`${prop.player} ${statLabel} ${prop.propLine} — view details`}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest("button") || target.closest("a")) return
        goToDetail()
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return
        const target = e.target as HTMLElement
        if (target.closest("button") || target.closest("a")) return
        e.preventDefault()
        goToDetail()
      }}
    >
      {/* Identity */}
      <div className="flex items-start gap-3">
        <PlayerPhoto
          playerName={prop.player}
          team={prop.team}
          sport={prop.sport}
          headshotUrl={
            (prop as unknown as { headshotUrl?: string | null; logoUrl?: string | null })[
              teamProp ? "logoUrl" : "headshotUrl"
            ] ?? null
          }
          size={40}
        />

        <div className="min-w-0 flex-1">
          <Link
            href={href}
            className="block truncate text-[15px] font-bold leading-tight text-[var(--color-text-primary)] hover:text-[var(--color-lime)] transition-colors"
          >
            {prop.player}
          </Link>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            <span>{prop.team}</span>
            {opponent && (
              <>
                <span className="text-[var(--color-text-muted)]/50 normal-case">
                  {venuePrefix ?? "·"}
                </span>
                <span>{opponent}</span>
              </>
            )}
          </p>
          {kickoff && (
            <p className="text-[11px] text-[var(--color-text-muted)]/70" suppressHydrationWarning>
              {kickoff}
            </p>
          )}
        </div>

        <div className="shrink-0 -mt-0.5 -mr-0.5 flex items-center">
          <button
            type="button"
            onClick={() => onLogPick?.(prop)}
            aria-label={`Log ${prop.player} ${statLabel} pick`}
            title="Log this pick"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-lime)] hover:bg-white/5 transition-colors"
          >
            <Bookmark className="w-4 h-4" />
          </button>
          {/* Share was previously only on the list-view card, so it was invisible
              in the default grid layout. */}
          <button
            type="button"
            onClick={() => onShare?.(prop)}
            aria-label={`Share ${prop.player} ${statLabel} prop`}
            title="Share this prop"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-lime)] hover:bg-white/5 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Line + prices */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[var(--color-text-muted)]">{statLabel}</p>
          <p className="text-[30px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-text-primary)] tabular-nums">
            {prop.propLine}
          </p>
        </div>

        <div className="flex items-stretch gap-2 shrink-0">
          {(["over", "under"] as const).map((direction) => {
            const isRecommended = prop.direction === direction
            const price = prices ? prices[direction] : null
            const Icon = direction === "over" ? ArrowUp : ArrowDown
            return (
              <button
                key={direction}
                type="button"
                disabled={parlayDisabled}
                onClick={() => onAddToParlay?.(prop, direction)}
                title={
                  price
                    ? `Add ${direction} to parlay — ${price} model-implied price (not a sportsbook line)`
                    : `Add ${direction} to parlay`
                }
                aria-label={`Add ${prop.player} ${direction} ${prop.propLine} ${statLabel} to parlay${price ? `, model-implied price ${price}` : ""}`}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-w-[62px] px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors",
                  parlayDisabled && "opacity-50 cursor-not-allowed",
                  isRecommended
                    ? "border-[var(--color-lime)]/40 bg-[var(--color-lime)]/10 text-[var(--color-lime)] hover:bg-[var(--color-lime)]/20"
                    : "border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-white/20"
                )}
              >
                <span className="flex items-center gap-1 leading-none">
                  <Icon className="w-3 h-3" />
                  {direction === "over" ? "Over" : "Under"}
                </span>
                <span className="text-[10px] font-semibold leading-none tabular-nums opacity-80">
                  {price ?? "—"}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Recent-form sparkline */}
      <div className="mt-4 flex items-end gap-3">
        <div className="flex-1 flex items-end gap-1.5 h-[30px]" aria-hidden>
          {spark.length === 0
            ? Array.from({ length: SPARK_GAMES }).map((_, i) => (
                <span key={i} className="flex-1 h-1.5 rounded-sm bg-white/8" />
              ))
            : spark.map((game, i) => (
                <span
                  key={`${game.date}-${i}`}
                  title={`${game.opponent}: ${game.value}`}
                  className={cn(
                    "flex-1 min-w-0 rounded-sm transition-colors",
                    game.overLine ? "bg-[var(--color-lime)]" : "bg-white/15"
                  )}
                  style={{
                    height: `${Math.max(12, Math.min(100, (game.value / sparkMax) * 100))}%`,
                  }}
                />
              ))}
        </div>
        <div className="shrink-0 text-right leading-tight">
          <p className="text-[11px] font-bold text-[var(--color-text-primary)] tabular-nums">
            {prop.propLine}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            O/U
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 flex items-center justify-between border-t border-[var(--color-border)]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Last {spark.length || SPARK_GAMES} Games
        </p>
        <Link
          href={href}
          className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-lime)] hover:gap-1.5 transition-all"
        >
          View Details
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </article>
  )
}
