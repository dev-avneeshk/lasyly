"use client"

import { cn } from "@/lib/utils"
import { getColorCode, roundTo } from "@/lib/analytics/derived-stats"
import { CollapsibleSection } from "./CollapsibleSection"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RawStatsSectionProps {
  rawStats: {
    shooting: {
      fgaPerGame: number
      ftaPerGame: number
      ftmPerGame: number
      ftPct: number
      tpaPerGame: number
      tpmPerGame: number
      tpPct: number
      ptsPerGame: number
    }
    shotDistribution: {
      fgaPct0_3ft: number | null
      fgaPct3_10ft: number | null
      fgaPct10_16ft: number | null
      fgaPct16_3pt: number | null
      fgaPct3pt: number | null
      pct2pAssisted: number | null
      pct3pAssisted: number | null
    }
    rebounding: {
      trbPct: number | null
      orbPct: number | null
      drbPct: number | null
    }
    playmaking: {
      astPct: number | null
      astPerGame: number
      tovPerGame: number
      astTovRatio: number | null
      pgaPerGame: number | null
    }
    defense: {
      stlPerGame: number
      blkPerGame: number
    }
  }
  leagueAverages: Record<string, number | null>
}

// ─── Stat Row Helpers ───────────────────────────────────────────────────────

interface StatRowProps {
  label: string
  value: number | null
  leagueAvg: number | null | undefined
  decimals?: number
  suffix?: string
  description?: string
}

const COLOR_MAP = {
  green: "text-[var(--color-lime)]",
  red: "text-[var(--color-danger)]",
  default: "text-white",
} as const

function StatRow({
  label,
  value,
  leagueAvg,
  decimals = 1,
  suffix = "",
  description,
}: StatRowProps) {
  const displayValue =
    value !== null && value !== undefined
      ? `${roundTo(value, decimals)}${suffix}`
      : "N/A"

  const displayLeagueAvg =
    leagueAvg !== null && leagueAvg !== undefined
      ? `${roundTo(leagueAvg, decimals)}${suffix}`
      : "—"

  // Determine color-coding
  let colorClass: (typeof COLOR_MAP)[keyof typeof COLOR_MAP] = COLOR_MAP.default
  if (
    value !== null &&
    value !== undefined &&
    leagueAvg !== null &&
    leagueAvg !== undefined
  ) {
    const code = getColorCode(value, leagueAvg)
    colorClass = COLOR_MAP[code]
  }

  return (
    <div className="flex items-center justify-between py-1.5 gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
        {description && (
          <p className="text-[10px] text-[var(--color-text-muted)]/70 mt-0.5 leading-tight">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={cn("text-xs font-mono font-medium", colorClass)}>
          {displayValue}
        </span>
        <span className="text-[10px] font-mono text-[var(--color-text-muted)] w-12 text-right">
          {displayLeagueAvg}
        </span>
      </div>
    </div>
  )
}

// ─── Section Header ─────────────────────────────────────────────────────────

function SectionSubHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-[var(--color-border)]/30">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {title}
      </span>
      <div className="flex items-center gap-3 text-[9px] text-[var(--color-text-muted)]">
        <span>Player</span>
        <span className="w-12 text-right">Lg Avg</span>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function RawStatsSection({
  rawStats,
  leagueAverages,
}: RawStatsSectionProps) {
  const { shooting, shotDistribution, rebounding, playmaking } = rawStats

  // Compute mid-range % as sum of mid-range zones (3-10ft + 10-16ft + 16-3pt)
  const midRangePct =
    shotDistribution.fgaPct3_10ft !== null &&
    shotDistribution.fgaPct10_16ft !== null &&
    shotDistribution.fgaPct16_3pt !== null
      ? shotDistribution.fgaPct3_10ft +
        shotDistribution.fgaPct10_16ft +
        shotDistribution.fgaPct16_3pt
      : null

  // Compute AST/TOV from raw values if not provided
  const astTovRatio =
    playmaking.astTovRatio !== null
      ? playmaking.astTovRatio
      : playmaking.tovPerGame > 0
        ? playmaking.astPerGame / playmaking.tovPerGame
        : null

  return (
    <CollapsibleSection title="Raw Stats" defaultExpanded={true}>
      <div className="space-y-4">
        {/* Shooting Volume & Efficiency */}
        <div>
          <SectionSubHeader title="Shooting Volume & Efficiency" />
          <div className="divide-y divide-[var(--color-border)]/20">
            <StatRow
              label="FGA/g"
              value={shooting.fgaPerGame}
              leagueAvg={leagueAverages["fgaPerGame"]}
            />
            <StatRow
              label="FTA/g"
              value={shooting.ftaPerGame}
              leagueAvg={leagueAverages["ftaPerGame"]}
            />
            <StatRow
              label="FTM/g"
              value={shooting.ftmPerGame}
              leagueAvg={leagueAverages["ftmPerGame"]}
            />
            <StatRow
              label="FT%"
              value={shooting.ftPct}
              leagueAvg={leagueAverages["ftPct"]}
              suffix="%"
            />
            <StatRow
              label="3PA/g"
              value={shooting.tpaPerGame}
              leagueAvg={leagueAverages["tpaPerGame"]}
            />
            <StatRow
              label="3PM/g"
              value={shooting.tpmPerGame}
              leagueAvg={leagueAverages["tpmPerGame"]}
            />
            <StatRow
              label="3P%"
              value={shooting.tpPct}
              leagueAvg={leagueAverages["tpPct"]}
              suffix="%"
            />
            {/* Shot Distribution */}
            <StatRow
              label="Rim %"
              value={shotDistribution.fgaPct0_3ft}
              leagueAvg={leagueAverages["fgaPct0_3ft"]}
              suffix="%"
            />
            <StatRow
              label="Mid-Range %"
              value={midRangePct}
              leagueAvg={leagueAverages["midRangePct"]}
              suffix="%"
            />
            <StatRow
              label="2P Assisted %"
              value={shotDistribution.pct2pAssisted}
              leagueAvg={leagueAverages["pct2pAssisted"]}
              suffix="%"
            />
            <StatRow
              label="3P Assisted %"
              value={shotDistribution.pct3pAssisted}
              leagueAvg={leagueAverages["pct3pAssisted"]}
              suffix="%"
            />
          </div>
        </div>

        {/* Rebounding */}
        <div>
          <SectionSubHeader title="Rebounding" />
          <div className="divide-y divide-[var(--color-border)]/20">
            <StatRow
              label="TRB%"
              value={rebounding.trbPct}
              leagueAvg={leagueAverages["trbPct"]}
              suffix="%"
              description="Pct of available rebounds grabbed while on court"
            />
            <StatRow
              label="ORB%"
              value={rebounding.orbPct}
              leagueAvg={leagueAverages["orbPct"]}
              suffix="%"
              description="Pct of available offensive rebounds grabbed while on court"
            />
            <StatRow
              label="DRB%"
              value={rebounding.drbPct}
              leagueAvg={leagueAverages["drbPct"]}
              suffix="%"
              description="Pct of available defensive rebounds grabbed while on court"
            />
          </div>
        </div>

        {/* Playmaking */}
        <div>
          <SectionSubHeader title="Playmaking" />
          <div className="divide-y divide-[var(--color-border)]/20">
            <StatRow
              label="AST%"
              value={playmaking.astPct}
              leagueAvg={leagueAverages["astPct"]}
              suffix="%"
              description="Pct of teammate FGs assisted while on court"
            />
            <StatRow
              label="AST/TOV"
              value={astTovRatio}
              leagueAvg={leagueAverages["astTovRatio"]}
              decimals={2}
              description="Assist-to-turnover ratio — higher is better ball security"
            />
            <StatRow
              label="PGA/g"
              value={playmaking.pgaPerGame}
              leagueAvg={leagueAverages["pgaPerGame"]}
              description="Potential game assists — passes leading to shot attempts"
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}
