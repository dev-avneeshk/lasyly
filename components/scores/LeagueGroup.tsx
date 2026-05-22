"use client"

import { LiveMatch } from "@/types"
import ScoreCard from "./ScoreCard"

interface LeagueGroupProps {
  league: string
  matches: LiveMatch[]
  onMatchClick: (match: LiveMatch) => void
}

export default function LeagueGroup({ league, matches, onMatchClick }: LeagueGroupProps) {
  if (matches.length === 0) return null

  const hasLive = matches.some(
    (m) =>
      m.status === "In Progress" ||
      m.status === "Halftime" ||
      m.status === "First Half" ||
      m.status === "Second Half" ||
      m.status === "Q1" ||
      m.status === "Q2" ||
      m.status === "Q3" ||
      m.status === "Q4" ||
      m.status === "OT"
  )

  return (
    <div className="space-y-3">
      {/* League header */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-white/90">
          {league}
        </h3>
        {hasLive && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25d65f] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#25d65f]" />
          </span>
        )}
        <div className="h-px flex-1 bg-white/5" />
        <span className="text-[10px] font-medium text-white/30 bg-white/5 rounded-full px-2.5 py-0.5">
          {matches.length} {matches.length === 1 ? "match" : "matches"}
        </span>
      </div>

      {/* Match cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matches.map((match) => (
          <ScoreCard
            key={match.id}
            match={match}
            onClick={() => onMatchClick(match)}
          />
        ))}
      </div>
    </div>
  )
}
