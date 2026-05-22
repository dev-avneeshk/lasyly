"use client"

import { LiveMatch } from "@/types"
import { cn } from "@/lib/utils"
import { Clock } from "lucide-react"

interface ScoreCardProps {
  match: LiveMatch
  onClick?: () => void
}

function isLive(status: string): boolean {
  return (
    status === "In Progress" ||
    status === "Halftime" ||
    status === "First Half" ||
    status === "Second Half" ||
    status === "Q1" ||
    status === "Q2" ||
    status === "Q3" ||
    status === "Q4" ||
    status === "OT"
  )
}

function TeamLogo({ url, teamName, color }: { url?: string; teamName: string; color?: string }) {
  if (url) {
    return (
      <div className="relative h-7 w-7 shrink-0">
        <img
          src={url}
          alt={`${teamName} logo`}
          className="h-7 w-7 object-contain"
          loading="lazy"
        />
      </div>
    )
  }

  const abbr = teamName.slice(0, 3).toUpperCase()
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-black"
      style={{
        backgroundColor: color ? `#${color}22` : "rgba(255,255,255,0.08)",
        color: color ? `#${color}` : "rgba(255,255,255,0.4)",
      }}
    >
      {abbr}
    </div>
  )
}

export default function ScoreCard({ match, onClick }: ScoreCardProps) {
  const live = isLive(match.status)
  const finished = match.status === "Finished"
  const upcoming = match.status === "Not Started"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl p-3.5 border transition-all cursor-pointer active:scale-[0.98] relative overflow-hidden group",
        live
          ? "bg-gradient-to-br from-[#25d65f]/[0.04] to-transparent border-[#25d65f]/15 hover:border-[#25d65f]/30"
          : "bg-white/[0.02] border-white/[0.06] hover:border-[var(--color-primary)]/25 hover:bg-white/[0.04]"
      )}
    >
      {/* Team color accent */}
      {match.homeColor && (
        <div
          className="absolute top-0 left-0 w-20 h-20 rounded-full blur-3xl opacity-[0.05] pointer-events-none"
          style={{ backgroundColor: `#${match.homeColor}` }}
        />
      )}

      {/* Status indicator */}
      <div className="mb-2.5 flex items-center justify-between relative">
        {live && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#25d65f]/10 border border-[#25d65f]/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25d65f] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#25d65f]" />
            </span>
            <span className="text-[10px] font-bold text-[#25d65f]">
              {match.clock || "LIVE"}
            </span>
          </div>
        )}
        {finished && (
          <span className="text-[10px] font-bold text-white/40 bg-white/5 rounded-full px-2 py-0.5">
            FT
          </span>
        )}
        {upcoming && (
          <div className="flex items-center gap-1 text-white/35">
            <Clock className="h-3 w-3" />
            <span className="text-[10px] font-medium">{match.clock || "Scheduled"}</span>
          </div>
        )}
        {!live && !finished && !upcoming && (
          <span className="text-[10px] font-medium text-white/40">
            {match.status}
          </span>
        )}
        <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">
          {match.league}
        </span>
      </div>

      {/* Teams */}
      <div className="space-y-2 relative">
        {/* Home team */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <TeamLogo url={match.homeLogo} teamName={match.homeTeam} color={match.homeColor} />
            <span className={cn(
              "truncate text-sm font-semibold",
              finished && match.homeScore > match.awayScore ? "text-white" :
              live ? "text-white/90" : "text-white/70"
            )}>
              {match.homeTeam}
            </span>
          </div>
          <span className={cn(
            "text-lg font-black tabular-nums shrink-0",
            upcoming ? "text-white/20" :
            live ? "text-white" :
            match.homeScore > match.awayScore ? "text-white" : "text-white/50"
          )}>
            {upcoming ? "-" : match.homeScore}
          </span>
        </div>

        {/* Away team */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <TeamLogo url={match.awayLogo} teamName={match.awayTeam} color={match.awayColor} />
            <span className={cn(
              "truncate text-sm font-semibold",
              finished && match.awayScore > match.homeScore ? "text-white" :
              live ? "text-white/90" : "text-white/70"
            )}>
              {match.awayTeam}
            </span>
          </div>
          <span className={cn(
            "text-lg font-black tabular-nums shrink-0",
            upcoming ? "text-white/20" :
            live ? "text-white" :
            match.awayScore > match.homeScore ? "text-white" : "text-white/50"
          )}>
            {upcoming ? "-" : match.awayScore}
          </span>
        </div>
      </div>

      {/* Hover indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}
