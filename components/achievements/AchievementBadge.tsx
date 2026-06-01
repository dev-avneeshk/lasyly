"use client"

import { useState } from "react"
import { ACHIEVEMENTS, type AchievementKey } from "@/lib/achievements"

type Props = {
  achievementKey: AchievementKey
  unlockedAt?: string
}

export default function AchievementBadge({ achievementKey, unlockedAt }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)
  const achievement = ACHIEVEMENTS[achievementKey]

  if (!achievement) return null

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-[var(--color-lime)]/30 transition-colors cursor-default">
        <span className="text-base" role="img" aria-label={achievement.name}>
          {achievement.icon}
        </span>
        <span className="text-[11px] font-medium text-white/80">{achievement.name}</span>
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[var(--color-border)] shadow-xl z-50 whitespace-nowrap">
          <p className="text-xs font-medium text-white">{achievement.name}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{achievement.description}</p>
          {unlockedAt && (
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              Unlocked {new Date(unlockedAt).toLocaleDateString()}
            </p>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-[#1a1a1a] border-r border-b border-[var(--color-border)]" />
        </div>
      )}
    </div>
  )
}
