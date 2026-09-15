/**
 * Shared circuit breaker for outbound third-party calls.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 * `fetchESPNScores()` fans out to 18 leagues in parallel, and `getScoresForDate`
 * calls it for three dates (requested / previous / next), so ONE uncached
 * /api/scores request produces 54 outbound requests to an unofficial, unSLA'd
 * API. Failures were swallowed by `Promise.allSettled` and the result was an
 * empty array, so from the outside a rate-limited or blocked upstream looked
 * exactly like "no games today" — silent, and self-perpetuating, because every
 * subsequent cache miss retried the full 54-request fan-out at the same rate.
 *
 * The breaker gives that failure a memory. After `FAILURE_THRESHOLD` consecutive
 * failures the circuit opens for `OPEN_MS` and calls short-circuit immediately,
 * so a struggling upstream gets a chance to recover instead of being hammered,
 * and we stop paying latency for calls that are going to fail.
 *
 * State lives in Redis so it is shared across serverless instances — the whole
 * point is that instance #37 benefits from what instance #12 just learned. With
 * no Redis it degrades to per-instance state, which is still better than nothing.
 */

import { getRedisClient } from "@/lib/redis"

/** Consecutive failures before the circuit opens. */
const FAILURE_THRESHOLD = 5

/** How long the circuit stays open before allowing a probe. */
const OPEN_MS = 60_000

/** How long the failure counter survives without new failures. */
const COUNTER_TTL_SECONDS = 300

interface LocalState {
  failures: number
  openUntil: number
}

const localState = new Map<string, LocalState>()

function local(name: string): LocalState {
  const existing = localState.get(name)
  if (existing) return existing
  const fresh: LocalState = { failures: 0, openUntil: 0 }
  localState.set(name, fresh)
  return fresh
}

/** Is the circuit currently open (i.e. should we skip the call)? */
export async function isCircuitOpen(name: string): Promise<boolean> {
  const redis = getRedisClient()
  if (!redis) return local(name).openUntil > Date.now()

  try {
    const openUntil = await redis.get<number>(`cb:${name}:open_until`)
    return typeof openUntil === "number" && openUntil > Date.now()
  } catch {
    // Can't tell → allow the call. A cache/breaker outage must not take the
    // feature down with it.
    return false
  }
}

/** Record a successful call, closing the circuit. */
export async function recordSuccess(name: string): Promise<void> {
  const state = local(name)
  state.failures = 0
  state.openUntil = 0

  const redis = getRedisClient()
  if (!redis) return
  try {
    await redis.pipeline().del(`cb:${name}:failures`).del(`cb:${name}:open_until`).exec()
  } catch {
    // Best-effort.
  }
}

/**
 * Record a failed call. Opens the circuit once the threshold is reached.
 * Returns true if this call opened it (useful for logging once, not per failure).
 */
export async function recordFailure(name: string): Promise<boolean> {
  const state = local(name)
  state.failures += 1
  if (state.failures >= FAILURE_THRESHOLD) {
    state.openUntil = Date.now() + OPEN_MS
  }

  const redis = getRedisClient()
  if (!redis) return state.openUntil > Date.now()

  try {
    const failures = await redis.incr(`cb:${name}:failures`)
    await redis.expire(`cb:${name}:failures`, COUNTER_TTL_SECONDS)
    if (failures >= FAILURE_THRESHOLD) {
      const openUntil = Date.now() + OPEN_MS
      await redis.set(`cb:${name}:open_until`, openUntil, { px: OPEN_MS })
      return true
    }
  } catch {
    // Best-effort.
  }
  return false
}

/**
 * Run `fn` behind the breaker.
 *
 * When the circuit is open, `fallback` is returned without calling `fn` at all.
 * `isFailure` decides what counts as a failure — for a fan-out that swallows
 * individual errors, "returned nothing at all" is the signal that matters, not
 * whether a promise rejected.
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  options: {
    fallback: T
    isFailure?: (result: T) => boolean
  }
): Promise<T> {
  if (await isCircuitOpen(name)) {
    console.warn(`[circuit:${name}] open — skipping upstream call`)
    return options.fallback
  }

  try {
    const result = await fn()
    if (options.isFailure?.(result)) {
      const opened = await recordFailure(name)
      if (opened) console.error(`[circuit:${name}] opened after repeated empty results`)
      return result
    }
    await recordSuccess(name)
    return result
  } catch (error) {
    const opened = await recordFailure(name)
    if (opened) console.error(`[circuit:${name}] opened after repeated failures:`, error)
    else console.warn(`[circuit:${name}] upstream call failed:`, error)
    return options.fallback
  }
}

/** Test-only: clear local breaker state. */
export function _resetCircuits(): void {
  localState.clear()
}
