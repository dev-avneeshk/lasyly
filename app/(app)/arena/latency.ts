/**
 * Development-only latency instrumentation for the auction hot path.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 * "It feels laggy" is not actionable. This measures the four segments a bid
 * travels through so a real bottleneck can be seen instead of guessed at:
 *
 *   click ──▶ server (client→server)
 *   server processing (validate + mutate + broadcast)
 *   server ──▶ client (broadcast transit)
 *   total acknowledgement (click ──▶ this client sees the accepted bid)
 *
 * Everything here is a no-op in production: the functions early-return unless
 * `process.env.NODE_ENV !== "production"`, so there is zero runtime cost and no
 * timing data on the wire for real users. The server only stamps `sentAt` on a
 * broadcast in dev as well (see lib/realtime/arena.ts), so the transit number is
 * only ever computed against a value that exists in dev.
 *
 * This module holds NO authoritative state — it is pure measurement. It never
 * decides a bid, a winner, a price, or a deadline.
 */

const isDev = process.env.NODE_ENV !== "production"

/** Marks for a single in-flight bid initiated by THIS client. */
interface BidMarks {
  amount: number
  /** performance.now() when the user clicked Bid. */
  clickedAt: number
  /** Wall-clock Date.now() at click, to reconcile with the server's sentAt. */
  clickedWall: number
}

let pending: BidMarks | null = null

/** Call the instant the user clicks Bid, before the request leaves. */
export function markBidSent(amount: number): void {
  if (!isDev) return
  pending = { amount, clickedAt: performance.now(), clickedWall: Date.now() }
}

/**
 * Call when the bidder's OWN POST resolves (HTTP ack). Gives round-trip
 * (client→server→client over REST) independent of the broadcast path.
 */
export function recordActionAck(label: string): void {
  if (!isDev || !pending) return
  const rtt = performance.now() - pending.clickedAt
  console.info(
    `%c[arena-latency] ${label} HTTP ack: ${rtt.toFixed(0)}ms round-trip`,
    "color:#7aa2ff",
  )
}

/**
 * Call when a broadcast is received. If it carries the server's `sentAt` (dev
 * only) and it corresponds to our own in-flight bid, log the segment breakdown.
 * `sentAt` is wall-clock on the server; we compare it to the client's wall clock
 * for the server→client leg. Clock skew between two machines makes the absolute
 * transit number approximate — the RTT above is the skew-free figure — but on a
 * single dev machine (both tabs local) it is exact and still useful for spotting
 * a broadcast that is seconds behind the HTTP ack.
 */
export function recordBroadcastLatency(payload?: {
  sentAt?: number
  view?: unknown
}): void {
  if (!isDev || !payload?.view) return
  const now = Date.now()
  if (typeof payload.sentAt === "number") {
    const transit = now - payload.sentAt
    console.info(
      `%c[arena-latency] broadcast server→client: ~${transit.toFixed(0)}ms`,
      "color:#7ad19a",
    )
  }
  if (pending) {
    const total = now - pending.clickedWall
    console.info(
      `%c[arena-latency] total ack (click→see accepted bid): ~${total.toFixed(0)}ms`,
      "color:#d4ff00; font-weight:bold",
    )
    pending = null
  }
}
