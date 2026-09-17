"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { cachedFetch } from "@/lib/clientCache"

interface DefenseCell {
  key: string
  label: string
  perGame: number
  leagueAvg: number
  rank: number
  rankOf: number
  percentile: number
  offenseFriendly: boolean
}

interface DefenseResult {
  team: string
  position: string
  gamesFaced: number
  byStat: Record<string, DefenseCell>
}

/** Per-position summary stats, in display order. `[statKey, shortLabel]`. */
const SUMMARY_STATS: Record<string, [string, string][]> = {
  QB: [
    ["pass_yds", "YDS/G"],
    ["pass_td", "TD/G"],
    ["pass_int", "INT/G"],
  ],
  RB: [
    ["carries", "CAR/G"],
    ["rush_yds", "YDS/G"],
    ["rush_td", "TD/G"],
  ],
  WR: [
    ["receptions", "REC/G"],
    ["rec_yds", "YDS/G"],
    ["rec_td", "TD/G"],
  ],
  TE: [
    ["receptions", "REC/G"],
    ["rec_yds", "YDS/G"],
    ["rec_td", "TD/G"],
  ],
}

/** The stat whose rank represents the overall matchup for a position. */
const HEADLINE_STAT: Record<string, string> = {
  QB: "pass_yds",
  RB: "rush_yds",
  WR: "rec_yds",
  TE: "rec_yds",
}

/**
 * Rank 1 = softest defence (allows the most), so a low rank is *favourable* for
 * the player. Colour follows the same convention as the matchup panels.
 */
function favourabilityColor(percentile: number, offenseFriendly: boolean): string {
  const favourable = offenseFriendly ? percentile : 1 - percentile
  if (favourable >= 0.6) return "text-[var(--color-lime)]"
  if (favourable >= 0.35) return "text-amber-400"
  return "text-red-400"
}

interface OpponentSummaryRowProps {
  opponentAbbr: string
  opponentName: string | null
  opponentLogoUrl: string | null
  /** QB | RB | WR | TE */
  position: string
  /** Season year or "all". */
  season?: string
  /** Scrolls to the full matchup breakdown. */
  onViewMatchup?: () => void
}

/**
 * Condensed "what this defence allows to your position" strip, shown above the
 * full matchup panels. NFL only — it's backed by /api/props/nfl-defense.
 */
export function OpponentSummaryRow({
  opponentAbbr,
  opponentName,
  opponentLogoUrl,
  position,
  season = "2025",
  onViewMatchup,
}: OpponentSummaryRowProps) {
  const [defense, setDefense] = useState<DefenseResult | null>(null)
  const [loading, setLoading] = useState(true)

  const pos = useMemo(() => {
    const upper = (position || "").toUpperCase()
    return upper in SUMMARY_STATS ? upper : "RB"
  }, [position])

  useEffect(() => {
    if (!opponentAbbr) return
    let cancelled = false
    setLoading(true)
    cachedFetch<DefenseResult>(
      `/api/props/nfl-defense?team=${encodeURIComponent(opponentAbbr)}&position=${pos}&season=${season}`,
      300_000
    )
      .then((data) => {
        if (!cancelled) setDefense(data)
      })
      .catch(() => {
        if (!cancelled) setDefense(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [opponentAbbr, pos, season])

  if (loading) {
    return <div className="h-[76px] animate-pulse rounded-2xl bg-white/[0.04]" />
  }
  if (!defense) return null

  const cells = SUMMARY_STATS[pos]
    .map(([key, label]) => {
      const cell = defense.byStat[key]
      return cell ? { ...cell, shortLabel: label } : null
    })
    .filter((c): c is DefenseCell & { shortLabel: string } => c !== null)

  const headline = defense.byStat[HEADLINE_STAT[pos]] ?? null

  return (
    <section
      className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      aria-label={`${opponentAbbr} defence versus ${pos}`}
    >
      {/* Opponent identity */}
      <div className="flex items-center gap-3 min-w-0">
        {opponentLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={opponentLogoUrl} alt="" className="w-9 h-9 shrink-0 object-contain" />
        ) : (
          <span className="w-9 h-9 shrink-0 rounded-lg bg-white/10 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-white/50" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-tight text-white">{opponentAbbr}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] truncate">
            Defense vs {pos}
            {defense.gamesFaced > 0 && ` · ${defense.gamesFaced} g`}
          </p>
        </div>
      </div>

      {/* Allowed per game */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {cells.map((cell) => (
          <div key={cell.key} className="leading-tight" title={`League average ${cell.leagueAvg}`}>
            <p className="text-[15px] font-black text-white tabular-nums">{cell.perGame}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {cell.shortLabel}
            </p>
          </div>
        ))}

        {headline && (
          <div className="leading-tight" title="Rank 1 = allows the most (softest matchup)">
            <p
              className={cn(
                "text-[15px] font-black tabular-nums",
                favourabilityColor(headline.percentile, headline.offenseFriendly)
              )}
            >
              #{headline.rank}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Rank vs {pos}
            </p>
          </div>
        )}
      </div>

      {onViewMatchup && (
        <button
          type="button"
          onClick={onViewMatchup}
          className="ml-auto flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[11px] font-bold text-white hover:border-[var(--color-lime)]/40 hover:text-[var(--color-lime)] transition-colors"
        >
          View Matchup
          <ArrowRight className="w-3 h-3" />
        </button>
      )}

      <p className="sr-only">
        {opponentName ?? opponentAbbr} allows these per-game averages to {pos}s. Rank 1 means the
        defence allows the most in the league.
      </p>
    </section>
  )
}
