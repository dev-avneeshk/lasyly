"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface PlayerAvatarProps {
  name: string
  photoUrl?: string | null
  teamLogoUrl?: string | null
  /** Overall avatar diameter in px. Team logo scales relative to this. */
  size?: number
  /** Accent ring for top-ranked players. */
  highlight?: boolean
  className?: string
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/**
 * Circular player headshot with a small team-logo badge overlaid at the
 * bottom-right. Falls back to the player's initials if no photo is available
 * or the image fails to load.
 */
export function PlayerAvatar({
  name,
  photoUrl,
  teamLogoUrl,
  size = 48,
  highlight = false,
  className,
}: PlayerAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const showPhoto = photoUrl && !imgFailed
  const badge = Math.round(size * 0.42)

  return (
    <div
      className={cn("relative flex-shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <div
        className={cn(
          "w-full h-full rounded-full overflow-hidden flex items-center justify-center",
          "bg-gradient-to-b from-white/[0.08] to-white/[0.02] border",
          highlight
            ? "border-[var(--color-lime)]/60 ring-2 ring-[var(--color-lime)]/20"
            : "border-[var(--color-border)]"
        )}
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl!}
            alt={name}
            className="w-full h-full object-cover object-top scale-105"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span
            className="font-black text-white/40 tabular-nums select-none"
            style={{ fontSize: Math.max(11, size * 0.32) }}
          >
            {initials(name)}
          </span>
        )}
      </div>

      {teamLogoUrl && (
        <div
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] p-0.5 flex items-center justify-center shadow-sm"
          style={{ width: badge, height: badge }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={teamLogoUrl}
            alt=""
            className="w-full h-full object-contain"
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}
