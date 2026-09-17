"use client"

import { CalendarDays, MapPin } from "lucide-react"
import { formatGameDayTime } from "@/lib/props/dates"
import type { NextGame, TeamMeta } from "@/lib/analytics/player-profile"

interface MatchupBannerProps {
  /** The player's team. */
  team: TeamMeta
  opponent: TeamMeta | null
  nextGame: NextGame | null
}

/** `2-0`, `1-1-1`, or null when the standings feed has nothing. */
function formatRecord(team: TeamMeta): string | null {
  const record = team.record
  if (!record) return null
  const base = `${record.wins}-${record.losses}`
  return record.ties ? `${base}-${record.ties}` : base
}

function initialsOf(abbr: string): string {
  return abbr.slice(0, 3).toUpperCase()
}

function TeamSide({
  team,
  align,
}: {
  team: TeamMeta
  align: "left" | "right"
}) {
  const record = formatRecord(team)
  return (
    <div
      className={
        align === "left"
          ? "flex items-center gap-3 min-w-0"
          : "flex flex-row-reverse items-center gap-3 min-w-0 text-right"
      }
    >
      {team.logoUrl ? (
        // Crests are small and come from multiple ESPN CDN hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" className="w-11 h-11 shrink-0 object-contain" />
      ) : (
        <span className="w-11 h-11 shrink-0 rounded-lg bg-white/10 text-[11px] font-black text-white/70 flex items-center justify-center">
          {initialsOf(team.abbr)}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[17px] font-black leading-none text-white">{team.abbr}</p>
        <p className="mt-1 text-[11px] text-white/60 truncate">{team.name ?? team.abbr}</p>
        {record && (
          <p
            className={
              align === "left"
                ? "flex items-center gap-1.5"
                : "flex flex-row-reverse items-center gap-1.5"
            }
          >
            <span className="text-[11px] font-bold text-white/80 tabular-nums">{record}</span>
            {team.record?.streak && (
              <span
                title="Current streak"
                className="text-[9px] font-bold uppercase tracking-wider text-white/45"
              >
                {team.record.streak}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Split-gradient banner for the upcoming game, tinted with each team's real
 * brand colour. Renders nothing when we don't even know the opponent — a banner
 * with one team and no fixture tells the user nothing.
 */
export function MatchupBanner({ team, opponent, nextGame }: MatchupBannerProps) {
  if (!opponent) return null

  const homeSide = nextGame?.isHome
  const leftTint = team.color ? `#${team.color}` : "#2a2f3a"
  const rightTint = opponent.color ? `#${opponent.color}` : "#1f2430"

  const kickoff = formatGameDayTime(nextGame?.startTime ?? nextGame?.gameDate ?? null)
  const hasClock = !!nextGame?.startTime

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[var(--color-border)]"
      aria-label={`Upcoming matchup: ${team.abbr} versus ${opponent.abbr}`}
    >
      {/* Two-sided brand wash */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(100deg, ${leftTint} 0%, ${leftTint}cc 26%, #0d0f14 50%, ${rightTint}cc 74%, ${rightTint} 100%)`,
        }}
      />
      <div aria-hidden className="absolute inset-0 bg-black/35" />

      <div className="relative flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex flex-1 items-center justify-between gap-4">
          <TeamSide team={team} align="left" />

          <div className="flex flex-col items-center shrink-0 px-2">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50">
              {homeSide === false ? "at" : "vs"}
            </span>
            {nextGame?.week != null && (
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/35">
                Week {nextGame.week}
              </span>
            )}
          </div>

          <TeamSide team={opponent} align="right" />
        </div>

        {/* Fixture details — only rendered when the schedule feed gave us some. */}
        {(kickoff || nextGame?.venue) && (
          <div className="shrink-0 rounded-xl border border-white/10 bg-black/35 px-4 py-3 lg:min-w-[190px] backdrop-blur-sm">
            {kickoff && (
              <p
                className="flex items-center gap-1.5 text-[12px] font-bold text-white"
                suppressHydrationWarning
              >
                <CalendarDays aria-hidden className="w-3.5 h-3.5 text-white/40 shrink-0" />
                {kickoff}
              </p>
            )}
            {kickoff && !hasClock && (
              <p className="mt-0.5 text-[10px] text-white/40">Kickoff time TBD</p>
            )}
            {nextGame?.venue && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-white/55">
                <MapPin aria-hidden className="w-3.5 h-3.5 mt-px text-white/30 shrink-0" />
                <span className="min-w-0">{nextGame.venue}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
