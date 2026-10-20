"use client"

import { usePathname, useRouter } from "next/navigation"
import { ArrowRight, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { PlayerPhoto } from "@/components/props/PlayerPhoto"
import { openPredictor, usePredictorLegs } from "@/lib/props/predictorStore"

/**
 * Sidebar summary of the props added to My Predictor on the Props page.
 * Hidden until something is added. Opens the predictor sheet in place on the
 * Props page, or navigates there first from anywhere else.
 */
export function PredictorCard({ collapsed }: { collapsed: boolean }) {
  const legs = usePredictorLegs()
  const pathname = usePathname()
  const router = useRouter()
  if (legs.length === 0) return null

  const open = () => {
    if (pathname.startsWith("/analysis") && !/^\/analysis\/[^/]+/.test(pathname)) {
      openPredictor()
      return
    }
    const sport = legs[0]?.sport ?? "NBA"
    router.push(`/analysis?sport=${encodeURIComponent(sport)}#predictor`)
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={open}
        title={`My Predictor: ${legs.length} prop${legs.length === 1 ? "" : "s"}`}
        aria-label={`Open My Predictor, ${legs.length} props added`}
        className="relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-lime)] hover:border-[var(--color-lime)]/40"
      >
        <Target className="h-5 w-5" />
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-lime)] px-1 text-[9px] font-black text-black">
          {legs.length}
        </span>
      </button>
    )
  }

  const shown = legs.slice(0, 3)
  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Open My Predictor, ${legs.length} props added`}
      className="group w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 p-3 text-left transition-colors hover:border-[var(--color-lime)]/40"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-bold text-[var(--color-text-primary)]">
          <Target className="h-4 w-4 text-[var(--color-lime)]" />
          My Predictor
        </span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--color-lime)] px-1.5 text-[11px] font-black text-black">
          {legs.length}
        </span>
      </div>
      <div className="mt-2.5 flex items-center -space-x-2">
        {shown.map((leg) => (
          <span key={leg.propId} className="rounded-full ring-2 ring-[var(--color-surface)]">
            <PlayerPhoto
              playerName={leg.player}
              team={leg.team ?? ""}
              sport={leg.sport}
              headshotUrl={leg.headshotUrl ?? null}
              size={28}
            />
          </span>
        ))}
        {legs.length > shown.length && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white ring-2 ring-[var(--color-surface)]">
            +{legs.length - shown.length}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
        <span>
          {legs.length} prop{legs.length === 1 ? "" : "s"} added
        </span>
        <ArrowRight className={cn("h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5")} />
      </div>
    </button>
  )
}
