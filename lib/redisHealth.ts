/**
 * Process-local "Redis is failing" flag for the callers that can run without
 * Redis: the response cache (lib/cache.ts) and the rate limiters
 * (lib/security/rateLimiterRedis.ts, lib/rateLimit.ts).
 *
 * Why it exists: on 2026-10-30 the Upstash database reached its Fixed-plan
 * bandwidth cap and Upstash started rejecting every command with "ERR This
 * database has reached current Fixed plan limits". The proxy awaited the
 * rate-limit call without handling errors, so every /api request threw and
 * returned 500 (props, player pages, guest sign-in, health) for about 30 hours.
 *
 * After a failure, these callers skip Redis for COOL_DOWN_MS and use their
 * in-memory fallbacks, so an outage costs one failed round trip per instance
 * per cool-down instead of one per call, and logs once per cool-down instead of
 * once per call.
 *
 * Do NOT consult this from code that needs Redis for correctness (the game
 * store and its locks, arena matchmaking, the job queue). Those must keep
 * surfacing Redis errors rather than silently switching to per-instance state.
 */

const COOL_DOWN_MS = 30_000

let downUntil = 0
let lastLoggedAt = Number.NEGATIVE_INFINITY

/** True while Redis is in a cool-down after a recent failure on this instance. */
export function redisCoolingDown(now: number = Date.now()): boolean {
  return now < downUntil
}

/** Record a failed Redis call and start (or extend) the cool-down. */
export function reportRedisFailure(source: string, error: unknown, now: number = Date.now()): void {
  downUntil = now + COOL_DOWN_MS
  if (now - lastLoggedAt >= COOL_DOWN_MS) {
    lastLoggedAt = now
    // Upstash errors end with ", command was: [...]", which carries the full
    // command: client IPs for rate-limit keys, whole cached payloads for SETs.
    // Log only the reason.
    const raw = error instanceof Error ? error.message : String(error)
    const reason = raw.split(", command was:")[0].slice(0, 200)
    console.error(
      `[redis] ${source} failed; using in-memory fallbacks for ${COOL_DOWN_MS / 1000}s: ${reason}`
    )
  }
}

/** Test helper: forget any recorded failure. */
export function _resetRedisHealth(): void {
  downUntil = 0
  lastLoggedAt = Number.NEGATIVE_INFINITY
}
