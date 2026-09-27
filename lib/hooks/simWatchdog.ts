/**
 * simWatchdog — the retry engine behind useAutoSimulate, kept free of React so
 * it can be tested directly with fake timers.
 *
 * Contract: while the watchdog is running it keeps invoking `run` until the
 * caller stops it. "Success" is therefore defined by the OWNER stopping the
 * watchdog (because the game phase advanced), not by `run` resolving. That is
 * deliberate — the server path can return 200 while the authoritative phase
 * still hasn't moved, and a resolved promise is not evidence the game started.
 */

/** Beat before the first attempt, so the "Rosters set" screen is readable. */
export const AUTO_SIM_FIRST_DELAY_MS = 1400

/**
 * Backoff between retries, in ms. Capped rather than unbounded: the server
 * simulate route shares a 60-actions/minute budget, and a player staring at a
 * stuck screen deserves a fast second try.
 */
export const AUTO_SIM_RETRY_DELAYS_MS = [2500, 4000, 7000, 12000, 20000] as const

/** Retry delay for retry number `n` (0-based), clamped to the last entry. */
export function autoSimRetryDelay(n: number): number {
  const i = Math.max(0, Math.min(n, AUTO_SIM_RETRY_DELAYS_MS.length - 1))
  return AUTO_SIM_RETRY_DELAYS_MS[i]
}

export interface SimWatchdogStatus {
  /** Attempts made since this watchdog started. */
  attempts: number
  /** An attempt is in flight. */
  running: boolean
  /** At least one attempt has completed without the caller stopping us. */
  stalled: boolean
  /** Message from the most recent failed attempt. */
  error: string | null
}

export interface SimWatchdog {
  /** Fire an attempt immediately, skipping the remaining backoff. */
  retryNow: () => Promise<void>
  /** Cancel all pending work. Idempotent. */
  stop: () => void
  /** Current status (also pushed to `onStatus`). */
  status: () => SimWatchdogStatus
}

export function startSimWatchdog({
  run,
  onStatus,
  firstDelayMs = AUTO_SIM_FIRST_DELAY_MS,
}: {
  run: () => void | Promise<unknown>
  onStatus: (status: SimWatchdogStatus) => void
  firstDelayMs?: number
}): SimWatchdog {
  let stopped = false
  let inFlight = false
  let retries = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const status: SimWatchdogStatus = { attempts: 0, running: false, stalled: false, error: null }

  const push = () => {
    if (!stopped) onStatus({ ...status })
  }

  const attempt = async (): Promise<void> => {
    // Guards the manual button racing the scheduled attempt, which on the server
    // path would mean two concurrent POSTs.
    if (stopped || inFlight) return
    inFlight = true
    status.attempts += 1
    status.running = true
    push()
    try {
      await run()
      status.error = null
    } catch (e) {
      status.error =
        e instanceof Error && e.message ? e.message : "We couldn't start the simulation."
    } finally {
      inFlight = false
      status.running = false
      push()
    }
  }

  const schedule = (delay: number) => {
    if (stopped) return
    timer = setTimeout(async () => {
      timer = null
      if (stopped) return
      await attempt()
      if (stopped) return
      // We're still running, so whoever owns us never saw the phase advance:
      // that attempt didn't take. Expose the manual escape hatch and back off.
      status.stalled = true
      push()
      schedule(autoSimRetryDelay(retries++))
    }, delay)
  }

  schedule(firstDelayMs)

  return {
    retryNow: attempt,
    stop: () => {
      stopped = true
      if (timer) clearTimeout(timer)
      timer = null
    },
    status: () => ({ ...status }),
  }
}
