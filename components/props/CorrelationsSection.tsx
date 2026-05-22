"use client"

import { CorrelatedProp } from "@/lib/analytics/types"

interface CorrelationsSectionProps {
  correlations: CorrelatedProp[]
  onCorrelationTap?: (propId: string) => void
}

export function CorrelationsSection({
  correlations,
  onCorrelationTap,
}: CorrelationsSectionProps) {
  if (!correlations || correlations.length === 0) {
    return null
  }

  const topCorrelations = correlations.slice(0, 3)

  function handleTap(propId: string) {
    if (onCorrelationTap) {
      onCorrelationTap(propId)
    }

    // Scroll to the correlated prop card and highlight it
    const targetElement = document.getElementById(`prop-card-${propId}`)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" })
      targetElement.classList.add("ring-2", "ring-[var(--color-lime)]", "ring-opacity-80")
      setTimeout(() => {
        targetElement.classList.remove("ring-2", "ring-[var(--color-lime)]", "ring-opacity-80")
      }, 2000)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-border)]/50">
      <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">
        Correlates with
      </p>
      <div className="flex flex-col gap-1.5">
        {topCorrelations.map((correlation) => (
          <button
            key={correlation.propId}
            type="button"
            onClick={() => handleTap(correlation.propId)}
            className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded-lg hover:bg-[var(--color-surface-elevated)]/50 transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-white truncate">
                {correlation.player}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {correlation.statCategory}
              </span>
            </div>
            <span className="text-xs font-semibold text-[var(--color-lime)] shrink-0 ml-2">
              {correlation.coefficient.toFixed(2)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
