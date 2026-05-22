"use client"

import Image from "next/image"
import { useState } from "react"

interface TeamLogoProps {
  team: string
  size?: number
}

/**
 * NBA team logo from ESPN CDN.
 * Uses the team abbreviation to construct the ESPN logo URL.
 * Falls back to text abbreviation on error.
 * Images are cached by the browser via Next.js Image + unoptimized (CDN handles optimization).
 */

const TEAM_ESPN_IDS: Record<string, string> = {
  ATL: "1",
  BOS: "2",
  BKN: "17",
  CHA: "30",
  CHI: "4",
  CLE: "5",
  DAL: "6",
  DEN: "7",
  DET: "8",
  GSW: "9",
  HOU: "10",
  IND: "11",
  LAC: "12",
  LAL: "13",
  MEM: "29",
  MIA: "14",
  MIL: "15",
  MIN: "16",
  NOP: "3",
  NYK: "18",
  OKC: "25",
  ORL: "19",
  PHI: "20",
  PHX: "21",
  POR: "22",
  SAC: "23",
  SAS: "24",
  TOR: "28",
  UTA: "26",
  WAS: "27",
}

function getTeamLogoUrl(team: string): string {
  const id = TEAM_ESPN_IDS[team.toUpperCase()]
  if (!id) return ""
  return `https://a.espncdn.com/i/teamlogos/nba/500/${team.toLowerCase()}.png`
}

export function TeamLogo({ team, size = 32 }: TeamLogoProps) {
  const [failed, setFailed] = useState(false)
  const url = getTeamLogoUrl(team)

  if (failed || !url) {
    return (
      <div
        className="rounded-full bg-[var(--color-surface-elevated)] flex items-center justify-center shrink-0 border border-[var(--color-border)]"
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{team}</span>
      </div>
    )
  }

  return (
    <div
      className="rounded-full overflow-hidden shrink-0 bg-[var(--color-surface-elevated)] flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Image
        src={url}
        alt={team}
        width={size}
        height={size}
        className="object-contain"
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  )
}
