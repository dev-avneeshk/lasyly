"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  startSimWatchdog,
  AUTO_SIM_FIRST_DELAY_MS,
  type SimWatchdog,
  type SimWatchdogStatus,
} from "./simWatchdog"

export { AUTO_SIM_FIRST_DELAY_MS, AUTO_SIM_RETRY_DELAYS_MS, autoSimRetryDelay } from "./simWatchdog"

/**
 * useAutoSimulate — drives the `lineup → simulation` handoff so it cannot be lost.
 *
 * ## Why this exists
 *
 * Every auction mode (NBA local, NBA server 1v1, NFL local) inlined the same
 * effect:
 *
 * ```ts
 * const fired = useRef(false)
 * useEffect(() => {
 *   if (status === "lineup" && !fired.current) {
 *     fired.current = true                             // ① guard set when ARMED
 *     const t = setTimeout(() => simulate(), 1400)
 *     return () => clearTimeout(t)                     // ② cleanup cancels it
 *   }
 *   if (status !== "lineup") fired.current = false
 * }, [status, game])                                   // ③ unstable dependency
 * ```
 *
 * Those three lines interact badly. `game` is a fresh object on every render, so
 * ③ re-ran the effect on renders that had nothing to do with the phase; ② then
 * cancelled the pending timer; and because ① had already flipped the guard, the
 * re-run refused to schedule a replacement. The simulation was dropped and the
 * UI sat on "Starting simulation…" forever — no retry, no error, no button.
 *
 * Narrowing ③ to `[status]` shrinks the window but does not close it: the guard
 * is still set before the work happens, so anything that re-runs the effect
 * inside the 1400 ms beat still loses the transition permanently — a Fast
 * Refresh, StrictMode's mount→cleanup→mount, or a component whose FIRST render
 * already has the phase at "lineup" (refresh mid-lineup, or a server view that
 * arrives late). On the server path a single failed POST was equally terminal,
 * because the response was applied through a guard that silently drops error
 * bodies and the GET poll path reports "no work to do" once the result is cached.
 *
 * ## What this does instead
 *
 * - No fire-once guard. While `active` is true a self-rescheduling chain keeps
 *   trying, so a cancelled or failed attempt is always replaced.
 * - Attempts are awaited and their failures captured, then retried on a backoff.
 * - The chain lives in a watchdog keyed ONLY on `active`, with `run` reached
 *   through a ref, so unrelated re-renders cannot tear it down.
 * - Remounting re-arms from scratch; there is no sticky ref to get wedged.
 * - `stalled` / `error` let the UI offer a manual "Start simulation" button, so
 *   even total failure of the automatic path stays recoverable by the player.
 *
 * Stopping is the caller's job, and it happens implicitly: advancing the phase
 * flips `active` to false. Success is "the state machine moved on", not "the
 * promise resolved" — which is the right test for the server path, where a 200
 * can still leave the authoritative phase behind.
 */

export interface AutoSimulateState extends SimWatchdogStatus {
  /** Fire an attempt right now, bypassing the backoff. */
  retryNow: () => void
}

const IDLE: SimWatchdogStatus = { attempts: 0, running: false, stalled: false, error: null }

export function useAutoSimulate({
  active,
  run,
  firstDelayMs = AUTO_SIM_FIRST_DELAY_MS,
}: {
  /** True while the game is parked at "lineup" waiting to tip off. */
  active: boolean
  /**
   * Starts the simulation. May be sync (local engine) or async (server POST).
   * Throw — or reject — to report failure; the watchdog retries either way.
   */
  run: () => void | Promise<unknown>
  /** Override the opening beat (used to stagger a second client). */
  firstDelayMs?: number
}): AutoSimulateState {
  const runRef = useRef(run)
  useEffect(() => {
    runRef.current = run
  })

  const [status, setStatus] = useState<SimWatchdogStatus>(IDLE)
  const dogRef = useRef<SimWatchdog | null>(null)

  useEffect(() => {
    if (!active) {
      // Phase moved on (or hasn't arrived). Reset so a rematch starts clean.
      dogRef.current = null
      setStatus(IDLE)
      return
    }
    const dog = startSimWatchdog({
      run: () => runRef.current(),
      onStatus: setStatus,
      firstDelayMs,
    })
    dogRef.current = dog
    return () => {
      dogRef.current = null
      dog.stop()
    }
    // Both deps are primitives, so this runs exactly once per lineup window and
    // CANNOT be torn down by an unrelated re-render — the bug it replaces.
  }, [active, firstDelayMs])

  const retryNow = useCallback(() => {
    void dogRef.current?.retryNow()
  }, [])

  return { ...status, retryNow }
}
