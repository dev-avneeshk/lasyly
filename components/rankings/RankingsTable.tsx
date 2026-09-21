"use client"

import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { PlayerAvatar } from "./PlayerAvatar"
import type { RankingListItem } from "@/lib/rankings/types"

/** Column keys map to component scores on RankingListItem. */
type DimensionKey =
  | "offense_score"
  | "defense_score"
  | "scoring_score"
  | "playmaking_score"
  | "rebounding_score"
  | "shooting_score"
  | "two_way_score"

interface DimensionColumn {
  key: DimensionKey
  label: string
}

const NBA_DIMENSIONS: DimensionColumn[] = [
  { key: "offense_score", label: "OFF" },
  { key: "defense_score", label: "DEF" },
  { key: "scoring_score", label: "SCORE" },
  { key: "playmaking_score", label: "PLAY" },
  { key: "rebounding_score", label: "REB" },
  { key: "shooting_score", label: "SHOOT" },
  { key: "two_way_score", label: "2-WAY" },
]

const NFL_DIMENSIONS: DimensionColumn[] = [
  { key: "offense_score", label: "OFF" },
  { key: "defense_score", label: "DEF" },
  { key: "scoring_score", label: "YARDS" },
  { key: "playmaking_score", label: "TD" },
]

interface RankingsTableProps {
  items: RankingListItem[]
  photos: Record<string, string>
  teamLogo: (team: string) => string | undefined
  onSelect: (item: RankingListItem) => void
  sport: "NBA" | "NFL"
}

/**
 * Dense, sortable-looking stats table matching the rankings mockup. The APEX
 * column is the composite `score`; the remaining numeric columns are the
 * per-dimension component scores that already live on each ranking row. The
 * TREND cell renders a tiny sparkline whose slope is driven by `rank_change`
 * (an upward move draws a rising line, a drop draws a falling one).
 */
export function RankingsTable({ items, photos, teamLogo, onSelect, sport }: RankingsTableProps) {
  const dimensions = sport === "NFL" ? NFL_DIMENSIONS : NBA_DIMENSIONS

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/40">
      <table className="w-full min-w-[860px] border-collapse">
        <thead>
          <tr className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            <th className="text-left font-bold py-3 pl-4 pr-2 w-16">#</th>
            <th className="text-left font-bold py-3 px-2">Player</th>
            <th className="text-center font-bold py-3 px-2 w-14">Team</th>
            <th className="text-center font-bold py-3 px-2 w-16 bg-[var(--color-lime)]/[0.06]">Apex</th>
            {dimensions.map((d) => (
              <th key={d.key} className="text-center font-bold py-3 px-2 w-14">{d.label}</th>
            ))}
            <th className="text-center font-bold py-3 px-2 w-24">Trend</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <RankingsRow
              key={item.player_name}
              item={item}
              photoUrl={photos[item.player_name] ?? null}
              teamLogoUrl={item.team ? teamLogo(item.team) : undefined}
              dimensions={dimensions}
              onSelect={() => onSelect(item)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RankingsRow({
  item,
  photoUrl,
  teamLogoUrl,
  dimensions,
  onSelect,
}: {
  item: RankingListItem
  photoUrl: string | null
  teamLogoUrl?: string
  dimensions: DimensionColumn[]
  onSelect: () => void
}) {
  const isTop = item.rank <= 3
  const change = item.rank_change ?? 0
  const isTeamChange = item.team !== item.historical_team && item.historical_team != null

  return (
    <tr
      onClick={onSelect}
      className={cn(
        "group border-t border-[var(--color-border)] cursor-pointer transition-colors hover:bg-white/[0.03]",
        isTop && "bg-[var(--color-lime)]/[0.03]",
      )}
    >
      {/* Rank + movement */}
      <td className="py-3 pl-4 pr-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-black tabular-nums",
              item.rank === 1 ? "text-lg text-[var(--color-lime)]" : "text-base text-white/80",
            )}
          >
            {item.rank}
          </span>
          <TrendDelta change={change} isNew={item.is_new} compact />
        </div>
      </td>

      {/* Player */}
      <td className="py-3 px-2">
        <div className="flex items-center gap-3">
          <PlayerAvatar name={item.player_name} photoUrl={photoUrl} size={36} highlight={isTop} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-[var(--color-text-primary)] truncate">
                {item.player_name}
              </span>
              {item.position && (
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-white/10 text-white/50 shrink-0">
                  {item.position}
                </span>
              )}
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] truncate block">
              {isTeamChange ? `${item.historical_team} → ${item.team}` : item.team ?? "—"}
            </span>
          </div>
        </div>
      </td>

      {/* Team logo */}
      <td className="py-3 px-2">
        <div className="flex items-center justify-center">
          {teamLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teamLogoUrl} alt={item.team ?? ""} className="w-7 h-7 object-contain" loading="lazy" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold text-white/40">
              {(item.team ?? "—").slice(0, 3)}
            </div>
          )}
        </div>
      </td>

      {/* APEX */}
      <td className="py-3 px-2 bg-[var(--color-lime)]/[0.06]">
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center justify-center min-w-[44px] rounded-lg bg-[var(--color-lime)]/10 border border-[var(--color-lime)]/25 px-2 py-1 text-sm font-black tabular-nums text-[var(--color-lime)]">
            {item.score.toFixed(1)}
          </span>
        </div>
      </td>

      {/* Dimension scores */}
      {dimensions.map((d) => {
        const value = item[d.key]
        return (
          <td key={d.key} className="py-3 px-2 text-center">
            <span className="text-xs font-semibold tabular-nums text-white/70">
              {value != null ? value.toFixed(1) : "—"}
            </span>
          </td>
        )
      })}

      {/* Trend */}
      <td className="py-3 px-2">
        <div className="flex items-center justify-center gap-2">
          <TrendSparkline change={change} />
          <TrendDelta change={change} isNew={item.is_new} />
        </div>
      </td>

      {/* Chevron */}
      <td className="py-3 pr-3">
        <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-white/60 transition-colors" />
      </td>
    </tr>
  )
}

/** A tiny sparkline whose direction reflects the rank movement. */
function TrendSparkline({ change }: { change: number }) {
  const color =
    change > 0 ? "var(--color-lime)" : change < 0 ? "var(--color-danger)" : "rgba(255,255,255,0.3)"
  // Three canned shapes: rising, falling, flat-ish — enough to read at a glance.
  const path =
    change > 0
      ? "M1 13 L9 10 L17 11 L25 5 L33 3"
      : change < 0
        ? "M1 3 L9 6 L17 5 L25 10 L33 13"
        : "M1 8 L9 9 L17 7 L25 9 L33 8"
  return (
    <svg width="34" height="16" viewBox="0 0 34 16" fill="none" className="shrink-0">
      <path d={path} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** "▲ +1", "▼ -1", or "– 0" delta chip, matching the mockup's TREND column. */
function TrendDelta({ change, isNew, compact }: { change: number; isNew?: boolean; compact?: boolean }) {
  if (isNew) {
    return <span className="text-[10px] font-black text-[var(--color-lime)] tracking-tight">NEW</span>
  }
  if (change === 0) {
    return (
      <span className={cn("flex items-center gap-0.5 font-bold text-white/30", compact ? "text-[10px]" : "text-xs")}>
        – 0
      </span>
    )
  }
  const up = change > 0
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 font-bold tabular-nums",
        compact ? "text-[10px]" : "text-xs",
        up ? "text-emerald-400" : "text-red-400",
      )}
    >
      <svg viewBox="0 0 10 10" className={cn("w-2.5 h-2.5", up ? "fill-emerald-400" : "fill-red-400")}>
        {up ? <path d="M5 1l4 8H1z" /> : <path d="M5 9L1 1h8z" />}
      </svg>
      {up ? `+${change}` : `-${Math.abs(change)}`}
    </span>
  )
}
