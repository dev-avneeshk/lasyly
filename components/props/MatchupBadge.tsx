"use client"

import { Grade } from "@/lib/analytics/types"
import { TeamLogo } from "./TeamLogo"

export interface MatchupBadgeProps {
  grade: Grade | null
  opponent: string
  /** Opponent team abbreviation for logo display */
  opponentTeam?: string
}

/** Map full team names to abbreviations for logo lookup */
const TEAM_NAME_TO_ABBR: Record<string, string> = {
  "atlanta hawks": "ATL",
  "boston celtics": "BOS",
  "brooklyn nets": "BKN",
  "charlotte hornets": "CHA",
  "chicago bulls": "CHI",
  "cleveland cavaliers": "CLE",
  "dallas mavericks": "DAL",
  "denver nuggets": "DEN",
  "detroit pistons": "DET",
  "golden state warriors": "GSW",
  "houston rockets": "HOU",
  "indiana pacers": "IND",
  "los angeles clippers": "LAC",
  "la clippers": "LAC",
  "los angeles lakers": "LAL",
  "la lakers": "LAL",
  "memphis grizzlies": "MEM",
  "miami heat": "MIA",
  "milwaukee bucks": "MIL",
  "minnesota timberwolves": "MIN",
  "new orleans pelicans": "NOP",
  "new york knicks": "NYK",
  "oklahoma city thunder": "OKC",
  "orlando magic": "ORL",
  "philadelphia 76ers": "PHI",
  "phoenix suns": "PHX",
  "portland trail blazers": "POR",
  "sacramento kings": "SAC",
  "san antonio spurs": "SAS",
  "toronto raptors": "TOR",
  "utah jazz": "UTA",
  "washington wizards": "WAS",
}

/** Known abbreviations */
const KNOWN_ABBRS = new Set([
  "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
  "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
  "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
])

function resolveTeamAbbr(opponent: string): string | null {
  const upper = opponent.trim().toUpperCase()
  if (KNOWN_ABBRS.has(upper)) return upper
  const lower = opponent.trim().toLowerCase()
  return TEAM_NAME_TO_ABBR[lower] ?? null
}

export function getGradeColors(grade: Grade): string {
  switch (grade) {
    case "A":
    case "B":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    case "C":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30"
    case "D":
    case "F":
      return "bg-red-500/20 text-red-400 border-red-500/30"
  }
}

export function MatchupBadge({ grade, opponent, opponentTeam }: MatchupBadgeProps) {
  // Don't render if no opponent info
  if (!opponent) return null

  // Resolve team abbreviation for logo: prefer explicit prop, fallback to parsing opponent string
  const teamAbbr = opponentTeam ?? resolveTeamAbbr(opponent)

  return (
    <div className="flex items-center gap-2">
      {teamAbbr && <TeamLogo team={teamAbbr} size={18} />}
      <span className="text-xs text-[var(--color-text-muted)]">
        vs {opponent}
      </span>
    </div>
  )
}
