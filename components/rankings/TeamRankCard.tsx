"use client"

import { cn } from "@/lib/utils"
import { RankMovement } from "./RankMovement"
import { TierBadge } from "./TierBadge"
import type { TeamRankingListItem } from "@/lib/rankings/types"

interface TeamRankCardProps {
  item: TeamRankingListItem
  teamLogoUrl?: string
  className?: string
}

function ScoreBar({ label, value, color = "var(--color-lime)" }: { label: string; value: number | null; color?: string }) {
  if (value == null) return null
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--color-text-muted)] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-semibold text-white/70 w-7 text-right tabular-nums">
        {value.toFixed(0)}
      </span>
    </div>
  )
}

export function TeamRankCard({ item, teamLogoUrl, className }: TeamRankCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 px-4 py-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 backdrop-blur-sm transition-all duration-200 hover:border-[var(--color-lime)]/20 hover:bg-[var(--color-surface-elevated)]/70 cursor-pointer",
        className
      )}
    >
      {/* Top row: rank + logo + name */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-12 text-right">
          <span
            className={cn(
              "font-black tabular-nums",
              item.rank === 1 ? "text-3xl text-[var(--color-lime)]" :
              item.rank <= 5 ? "text-2xl text-white/90" :
              item.rank <= 15 ? "text-xl text-white/70" :
              "text-lg text-white/50"
            )}
          >
            {item.rank}
          </span>
        </div>
        <div className="flex-shrink-0 w-6">
          <RankMovement change={item.rank_change} />
        </div>
        {teamLogoUrl && (
          <div className="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={teamLogoUrl} alt={item.team} className="w-full h-full object-contain p-0.5" loading="lazy" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-[var(--color-text-primary)] truncate">
            {item.team_full_name ?? item.team}
          </div>
          {item.tier && <TierBadge tier={item.tier} compact />}
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-xl font-black tabular-nums text-[var(--color-text-primary)]">
            {item.power_score.toFixed(1)}
          </div>
          {item.projected_wins != null && (
            <div className="text-xs text-[var(--color-text-muted)]">
              ~{item.projected_wins}W
            </div>
          )}
        </div>
      </div>

      {/* Score bars */}
      <div className="flex flex-col gap-1.5 px-1">
        <ScoreBar label="Offense" value={item.offensive_score} color="#D4FF00" />
        <ScoreBar label="Defense" value={item.defensive_score} color="#60A5FA" />
        <ScoreBar label="Depth" value={item.depth_score} color="#A78BFA" />
        <ScoreBar label="Stars" value={item.star_power_score} color="#F59E0B" />
      </div>

      {/* Key additions/losses */}
      {((item.key_additions?.length ?? 0) > 0 || (item.key_losses?.length ?? 0) > 0) && (
        <div className="flex gap-3 flex-wrap text-[10px]">
          {(item.key_additions?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-emerald-400">
              <span className="font-bold">IN:</span>
              <span>{item.key_additions!.slice(0, 2).join(", ")}</span>
            </div>
          )}
          {(item.key_losses?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-red-400">
              <span className="font-bold">OUT:</span>
              <span>{item.key_losses!.slice(0, 2).join(", ")}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
