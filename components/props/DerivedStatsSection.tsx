"use client"

import type { DerivedStatsData } from "@/lib/analytics/derived-stats"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DerivedStatsSectionProps {
  derivedStats: DerivedStatsData
  /** When PGA per game is 0, we show N/A for PGA conversion rate */
  pgaPerGameIsZero?: boolean
}

// ─── Human-readable labels for each derived stat key ────────────────────────

const STAT_LABELS: Record<keyof DerivedStatsData, string> = {
  midRangeAttemptsPerGame: "Mid-Range Attempts / Game",
  rimAttemptsPerGame: "Rim Attempts / Game",
  ePPS: "Expected Points Per Shot (ePPS)",
  selfCreatedFGAPerGame: "Self-Created FGA / Game",
  astTovRatio: "AST / TOV Ratio",
  pgaConversionRate: "PGA Conversion Rate",
  projectedReboundsPerGame: "Projected Rebounds / Game",
  stocksPerGame: "Stocks (STL + BLK) / Game",
  foulsDrawnPerGame: "Fouls Drawn / Game",
}

// ─── Missing input labels for each derived stat ─────────────────────────────

const MISSING_INPUT_LABELS: Record<keyof DerivedStatsData, string> = {
  midRangeAttemptsPerGame: "mid-range FGA %",
  rimAttemptsPerGame: "rim FGA % (0-3 ft)",
  ePPS: "FGA or FTA",
  selfCreatedFGAPerGame: "assisted FG percentages",
  astTovRatio: "turnovers",
  pgaConversionRate: "PGA",
  projectedReboundsPerGame: "TRB% or team rebounds",
  stocksPerGame: "STL or BLK",
  foulsDrawnPerGame: "FTA",
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DerivedStatsSection({
  derivedStats,
  pgaPerGameIsZero = false,
}: DerivedStatsSectionProps) {
  const statKeys = Object.keys(STAT_LABELS) as (keyof DerivedStatsData)[]

  return (
    <div className="space-y-1">
      {statKeys.map((key) => {
        const stat = derivedStats[key]

        // Special case: PGA conversion rate when PGA is 0
        if (key === "pgaConversionRate" && pgaPerGameIsZero && stat === null) {
          return (
            <DerivedStatRow
              key={key}
              label={STAT_LABELS[key]}
              displayValue="N/A"
              subtitle="PGA is 0 — cannot compute conversion rate"
            />
          )
        }

        // Stat is null → missing inputs, show insufficient data message
        if (stat === null) {
          return (
            <DerivedStatRow
              key={key}
              label={STAT_LABELS[key]}
              displayValue="—"
              subtitle={`Insufficient data — missing ${MISSING_INPUT_LABELS[key]}`}
              isMissing
            />
          )
        }

        // Stat has missingInputs populated (shouldn't happen with current logic, but handle gracefully)
        if (stat.missingInputs.length > 0) {
          return (
            <DerivedStatRow
              key={key}
              label={STAT_LABELS[key]}
              displayValue="—"
              subtitle={`Insufficient data — missing ${stat.missingInputs.join(", ")}`}
              isMissing
            />
          )
        }

        // Normal display with formula
        return (
          <DerivedStatRow
            key={key}
            label={STAT_LABELS[key]}
            displayValue={String(stat.value)}
            formula={stat.formula}
            formulaResult={stat.formulaResult}
          />
        )
      })}
    </div>
  )
}

// ─── Row Component ──────────────────────────────────────────────────────────

interface DerivedStatRowProps {
  label: string
  displayValue: string
  formula?: string
  formulaResult?: string
  subtitle?: string
  isMissing?: boolean
}

function DerivedStatRow({
  label,
  displayValue,
  formula,
  formulaResult,
  subtitle,
  isMissing = false,
}: DerivedStatRowProps) {
  return (
    <div className="rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors">
      {/* Top row: label + value */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--color-text-muted)] truncate">
          {label}
        </span>
        <span
          className={`font-mono text-sm font-bold shrink-0 ${
            isMissing
              ? "text-[var(--color-text-muted)]"
              : displayValue === "N/A"
                ? "text-[var(--color-warning)]"
                : "text-white"
          }`}
        >
          {displayValue}
        </span>
      </div>

      {/* Formula breakdown */}
      {formula && formulaResult && (
        <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]/70 truncate">
          {formula} {formulaResult}
        </p>
      )}

      {/* Subtitle for missing data or N/A explanation */}
      {subtitle && !formula && (
        <p
          className={`mt-1 text-[11px] ${
            isMissing
              ? "text-[var(--color-warning)]/80"
              : "text-[var(--color-text-muted)]/70"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
