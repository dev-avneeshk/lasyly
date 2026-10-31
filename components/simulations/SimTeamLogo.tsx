"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { teamLogoUrl } from "@/lib/simulations/format"
import type { SimTeam } from "@/lib/simulations/types"

/** ESPN team logo; falls back to the abbreviation if the image fails. */
export function SimTeamLogo({ team, size = 32, className }: { team: SimTeam; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[10px] font-bold text-[var(--color-text-muted)]",
          className
        )}
        style={{ width: size, height: size }}
      >
        {team.abbr}
      </span>
    )
  }
  return (
    // ESPN logos are small static PNGs; a plain img keeps this cheap (same approach as GameStrip).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={teamLogoUrl(team)}
      alt={team.name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  )
}
