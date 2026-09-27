"use client"

import { Loader2, RotateCcw, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AutoSimulateState } from "@/lib/hooks/useAutoSimulate"

// Note: `autoSim.stalled` only goes true AFTER a completed attempt that didn't
// advance the phase, so a healthy game never renders the button at all.

/**
 * The "Starting simulation…" strip on the locked-lineup screen.
 *
 * This is the one place in the whole auction flow where the player has nothing
 * to do but wait on an automatic transition, so it is also the one place where a
 * dropped transition used to be unrecoverable — a spinner with no button, no
 * error, and no timeout. It now escalates: spinner → spinner + manual button →
 * the actual failure reason. `useAutoSimulate` is still retrying underneath the
 * whole time; the button just lets an impatient player jump the backoff.
 */
export function SimHandoff({ autoSim, label = "Starting simulation…" }: { autoSim: AutoSimulateState; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-lime)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>

      {autoSim.error && (
        <p className="flex items-center gap-1.5 text-center text-xs font-semibold text-[var(--color-danger)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {autoSim.error}
        </p>
      )}

      {autoSim.stalled && (
        <div className="flex flex-col items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={autoSim.retryNow} disabled={autoSim.running}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {autoSim.running ? "Starting…" : "Start simulation"}
          </Button>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Taking longer than expected — retrying automatically.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Terminal fallback for a phase that says the game is running but carries no
 * result to show. Previously this state fell through to the auction renderer and
 * produced an empty board, which read as "the app is broken" with no next step.
 */
export function SimStalled({
  label,
  error,
  running,
  onRetry,
  onExit,
}: {
  label: string
  error: string | null
  running: boolean
  onRetry: () => void
  onExit: () => void
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--color-lime)]" />
      <p className="text-sm font-semibold text-[var(--color-text-muted)]">{label}</p>
      {error && <p className="text-xs font-semibold text-[var(--color-danger)]">{error}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onRetry} disabled={running}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          {running ? "Starting…" : "Retry"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onExit}>Back to options</Button>
      </div>
    </div>
  )
}
