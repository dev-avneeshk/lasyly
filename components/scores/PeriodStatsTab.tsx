"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { MatchSummary } from "@/types"

type PeriodStats = NonNullable<MatchSummary["periodStats"]>
type PeriodId = PeriodStats[number]["period"]

interface PeriodStatsTabProps {
  /** Ordered FT / 1H / 2H, empty periods already dropped (lib/scores/soccerMatchStats). */
  periods: PeriodStats
  homeTeam: string
  awayTeam: string
  homeLogo?: string
  awayLogo?: string
  homeColor?: string
  awayColor?: string
}

/**
 * Big-5 soccer match stats from our DB: a Full time / 1st half / 2nd half
 * toggle and grouped dual-bar rows. Display text is pre-formatted server side
 * and rendered verbatim.
 */
export default function PeriodStatsTab({
  periods,
  homeTeam,
  awayTeam,
  homeLogo,
  awayLogo,
  homeColor,
  awayColor,
}: PeriodStatsTabProps) {
  const [period, setPeriod] = useState<PeriodId>(periods[0]?.period ?? "FT")

  // A newly opened match starts on its first period. Rendering never depends
  // on this sync: `current` falls back to periods[0] below.
  useEffect(() => {
    setPeriod(periods[0]?.period ?? "FT")
  }, [periods])

  if (periods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-white/40">Detailed stats aren&apos;t available for this match</p>
      </div>
    )
  }

  const current = periods.find((p) => p.period === period) ?? periods[0]

  // Each team's brand color, with sensible on-brand fallbacks.
  const homeHex = homeColor ? `#${homeColor}` : "var(--color-primary)"
  const awayHex = awayColor ? `#${awayColor}` : "var(--color-secondary)"

  return (
    <div className="space-y-4">
      {/* Period toggle — segmented control */}
      {periods.length >= 2 && (
        <div role="group" aria-label="Match period" className="flex gap-1 rounded-xl bg-white/[0.04] p-1">
          {periods.map((p) => (
            <button
              key={p.period}
              type="button"
              aria-pressed={current.period === p.period}
              onClick={() => setPeriod(p.period)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-all duration-150",
                current.period === p.period
                  ? "bg-[var(--color-primary)] text-white shadow-[0_2px_10px_-2px_var(--color-primary)]"
                  : "text-white/45 hover:text-white/75 hover:bg-white/[0.04]"
              )}
            >
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Team header with color chips */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {homeLogo
            ? <img src={homeLogo} alt="" className="h-5 w-5 object-contain shrink-0" />
            : <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: homeHex }} />}
          <span className="text-xs font-bold text-white/85 truncate">{homeTeam}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span className="text-xs font-bold text-white/85 truncate">{awayTeam}</span>
          {awayLogo
            ? <img src={awayLogo} alt="" className="h-5 w-5 object-contain shrink-0" />
            : <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: awayHex }} />}
        </div>
      </div>

      {current.groups.map((group) => (
        <section key={group.group} className="space-y-3.5">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/45">{group.group}</h4>
          {/* Stat bars — dual, colored by each team, leader gets full opacity */}
          {group.stats.map((stat) => {
            const homeVal = stat.homeValue ?? 0
            const awayVal = stat.awayValue ?? 0
            const total = homeVal + awayVal || 1
            const homePercent = (homeVal / total) * 100
            const awayPercent = (awayVal / total) * 100
            const homeLeads = homeVal > awayVal
            const awayLeads = awayVal > homeVal

            return (
              <div key={stat.label}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className={cn(
                    "text-sm font-black tabular-nums transition-colors",
                    homeLeads ? "text-white" : "text-white/45"
                  )}>
                    {stat.home}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 text-center px-2">{stat.label}</span>
                  <span className={cn(
                    "text-sm font-black tabular-nums transition-colors",
                    awayLeads ? "text-white" : "text-white/45"
                  )}>
                    {stat.away}
                  </span>
                </div>
                {/* Two bars growing from the center outward */}
                <div className="flex items-center gap-1" aria-hidden="true">
                  <div className="flex-1 flex justify-end h-2 rounded-l-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full rounded-l-full transition-all duration-500 ease-out"
                      style={{
                        width: `${homePercent}%`,
                        backgroundColor: homeHex,
                        opacity: homeLeads ? 1 : 0.4,
                      }}
                    />
                  </div>
                  <div className="flex-1 flex justify-start h-2 rounded-r-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full rounded-r-full transition-all duration-500 ease-out"
                      style={{
                        width: `${awayPercent}%`,
                        backgroundColor: awayHex,
                        opacity: awayLeads ? 1 : 0.4,
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
