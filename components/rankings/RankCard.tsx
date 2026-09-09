"use client"

import { cn } from "@/lib/utils"
import { RankMovement } from "./RankMovement"
import { TierBadge } from "./TierBadge"
import type { RankingListItem } from "@/lib/rankings/types"

interface RankCardProps {
  item: RankingListItem
  teamLogoUrl?: string
  isNew?: boolean
  className?: string
}

export function RankCard({ item, teamLogoUrl, className }: RankCardProps) {
  const isTeamChange = item.team !== item.historical_team && item.historical_team != null

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 md:gap-5 px-4 py-3.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 backdrop-blur-sm transition-all duration-200 hover:border-[var(--color-lime)]/30 hover:bg-[var(--color-surface-elevated)]/80 hover:z-50 cursor-pointer",
        item.low_confidence && "opacity-80",
        className
      )}
    >
      {/* Rank Number */}
      <div className="flex-shrink-0 w-12 md:w-14 text-right">
        <span
          className={cn(
            "font-black tabular-nums leading-none",
            item.rank === 1 ? "text-3xl md:text-4xl text-[var(--color-lime)]" :
            item.rank <= 5 ? "text-2xl md:text-3xl text-white/90" :
            item.rank <= 25 ? "text-xl md:text-2xl text-white/70" :
            "text-lg md:text-xl text-white/50"
          )}
        >
          {item.rank}
        </span>
      </div>

      {/* Movement */}
      <div className="flex-shrink-0 w-10 flex items-center justify-center">
        <RankMovement change={item.rank_change} isNew={item.is_new} />
      </div>

      {/* Team Logo */}
      {teamLogoUrl && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={teamLogoUrl}
            alt={item.team ?? ""}
            className="w-full h-full object-contain p-0.5"
            loading="lazy"
          />
        </div>
      )}

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm md:text-base text-[var(--color-text-primary)] truncate">
            {item.player_name}
          </span>
          {item.position && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/50 flex-shrink-0">
              {item.position}
            </span>
          )}
          {isTeamChange && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex-shrink-0">
              NEW TEAM
            </span>
          )}
          {item.is_new && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-lime)]/20 text-[var(--color-lime)] flex-shrink-0">
              NEW
            </span>
          )}
          {item.low_confidence && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--color-warning)]/15 text-[var(--color-warning)] flex-shrink-0">
              Low confidence
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-[var(--color-text-muted)]">
            {isTeamChange
              ? `${item.historical_team} → ${item.team}`
              : item.team ?? "—"
            }
          </span>
        </div>
      </div>

      {/* Score + Tier */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <div className="flex items-baseline gap-1">
          <span className="text-lg md:text-xl font-black tabular-nums text-[var(--color-text-primary)]">
            {item.score.toFixed(1)}
          </span>
        </div>
        <TierBadge tier={item.tier} compact />
      </div>

      {/* Component score bars — visible on hover (desktop only) */}
      <div className="hidden group-hover:flex absolute right-4 top-full mt-1 z-20 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-3 shadow-xl w-56 flex-col gap-1.5">
        {[
          { label: "Offense", value: item.offense_score },
          { label: "Defense", value: item.defense_score },
          { label: "Scoring", value: item.scoring_score },
          { label: "Playmaking", value: item.playmaking_score },
          { label: "Rebounding", value: item.rebounding_score },
          { label: "Shooting", value: item.shooting_score },
        ].map(({ label, value }) =>
          value != null ? (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--color-text-muted)] w-20 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-lime)] transition-all"
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-white/70 w-8 text-right tabular-nums">
                {value.toFixed(0)}
              </span>
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}
