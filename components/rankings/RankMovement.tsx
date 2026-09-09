"use client"

import { cn } from "@/lib/utils"

interface RankMovementProps {
  change: number | null
  isNew?: boolean
  className?: string
}

export function RankMovement({ change, isNew, className }: RankMovementProps) {
  if (isNew) {
    return (
      <span className={cn("text-[10px] font-black text-[var(--color-lime)] tracking-tight", className)}>
        NEW
      </span>
    )
  }

  if (change === null || change === 0) {
    return (
      <span className={cn("text-sm text-white/30 font-semibold", className)}>—</span>
    )
  }

  if (change > 0) {
    return (
      <span className={cn("flex items-center gap-0.5 text-xs font-black text-emerald-400", className)}>
        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-emerald-400">
          <path d="M5 1l4 8H1z" />
        </svg>
        {change}
      </span>
    )
  }

  return (
    <span className={cn("flex items-center gap-0.5 text-xs font-black text-red-400", className)}>
      <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-red-400">
        <path d="M5 9L1 1h8z" />
      </svg>
      {Math.abs(change)}
    </span>
  )
}
