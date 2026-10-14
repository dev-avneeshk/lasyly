/**
 * Shared timing for the global-match fallback. Numbers only, with no imports, so
 * client code (the waiting-room timer) and server code (the pair route's verdict)
 * read the same values without pulling either side's dependencies along.
 */

/** Minimum lobby age before an open public lobby may be paired with a practice opponent. Server-enforced. */
export const BOT_FALLBACK_WAIT_MS = 15_000

/** Client-only: uniform [0, 3000) ms added on top, so pairings don't land on an exact beat. Can only delay. */
export const BOT_FALLBACK_JITTER_MS = 3_000
