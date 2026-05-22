"use client"

import { useState, useRef, useEffect } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { ConfidenceBreakdown } from "@/lib/analytics/types"

interface ConfidenceStarsProps {
  breakdown: ConfidenceBreakdown | null
  onTap?: () => void
}

/** Factor labels and weights for the breakdown tooltip */
const FACTORS: { key: keyof Pick<ConfidenceBreakdown, "l5HitRate" | "l10HitRate" | "matchupGrade" | "sampleSize">; label: string; weight: number }[] = [
  { key: "l5HitRate", label: "L5 Hit Rate", weight: 0.30 },
  { key: "l10HitRate", label: "L10 Hit Rate", weight: 0.20 },
  { key: "matchupGrade", label: "Matchup Grade", weight: 0.25 },
  { key: "sampleSize", label: "Sample Size", weight: 0.25 },
]

export function ConfidenceStars({ breakdown, onTap }: ConfidenceStarsProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!showTooltip) return

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowTooltip(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showTooltip])

  // Null breakdown = insufficient data
  if (!breakdown) {
    return (
      <span className="text-xs text-[var(--color-text-muted)] italic">
        Not enough data
      </span>
    )
  }

  const { stars } = breakdown

  function handleTap() {
    setShowTooltip((prev) => !prev)
    onTap?.()
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Stars */}
      <button
        type="button"
        onClick={handleTap}
        className="flex items-center gap-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-lime)]/50 rounded"
        aria-label={`Confidence: ${stars} out of 5 stars. Tap for breakdown.`}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              "w-4 h-4 transition-colors",
              i < stars
                ? "fill-[var(--color-lime)] text-[var(--color-lime)]"
                : "fill-none text-[var(--color-text-muted)]/40"
            )}
          />
        ))}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-3 shadow-lg">
          <p className="text-xs font-semibold text-white mb-2">
            Confidence Breakdown
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--color-text-muted)]">
                <th className="text-left font-medium pb-1">Factor</th>
                <th className="text-right font-medium pb-1">Value</th>
                <th className="text-right font-medium pb-1">Contrib.</th>
              </tr>
            </thead>
            <tbody>
              {FACTORS.map(({ key, label, weight }) => {
                const normalized = breakdown[key]
                const contribution = normalized * weight
                return (
                  <tr key={key} className="text-white/80">
                    <td className="py-0.5">{label}</td>
                    <td className="text-right py-0.5">
                      {Math.round(normalized * 100)}%
                    </td>
                    <td className="text-right py-0.5 text-[var(--color-lime)]">
                      {(contribution * 100).toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="mt-2 pt-2 border-t border-[var(--color-border)]/50 flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Final Score</span>
            <span className="text-white font-semibold">
              {Math.round(breakdown.finalScore * 100)}% → {stars}★
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
