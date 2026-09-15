/**
 * Trustworthy client-IP extraction.
 *
 * The naive version of this — `x-forwarded-for.split(",")[0]` — reads the
 * LEFTMOST entry of a header the client itself can send. On any platform that
 * appends to `x-forwarded-for` rather than replacing it, that leftmost value is
 * attacker-controlled, which means every IP-keyed rate limit can be bypassed by
 * rotating a header value:
 *
 *   curl -H 'X-Forwarded-For: 1.2.3.4' ...   # fresh bucket per request
 *
 * Vercel sets `x-vercel-forwarded-for` itself and does not let clients forge it,
 * so we prefer that. `x-real-ip` is the next most trustworthy (also set by the
 * platform). Only as a last resort do we look at `x-forwarded-for`, and there we
 * take the RIGHTMOST entry, because a spoofed chain is prepended — the trailing
 * entries are the ones appended by infrastructure we control.
 *
 * When nothing usable is present we return a distinct sentinel rather than
 * "unknown", so it is visible in metrics that the key space has collapsed.
 */

/** Headers in descending order of trust. */
const TRUSTED_IP_HEADERS = [
  "x-vercel-forwarded-for", // set by Vercel's edge; not client-forgeable
  "cf-connecting-ip", // Cloudflare
  "x-real-ip", // set by most reverse proxies
] as const

export const UNKNOWN_IP = "ip-unavailable"

function firstValid(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Extract the client IP from a request, preferring platform-set headers over
 * the client-influenced `x-forwarded-for`.
 */
export function getClientIp(request: Request | { headers: Headers }): string {
  const headers = request.headers

  for (const name of TRUSTED_IP_HEADERS) {
    const value = firstValid(headers.get(name))
    // These headers can still be comma-separated; the first entry is the client.
    if (value) {
      const first = firstValid(value.split(",")[0])
      if (first) return first
    }
  }

  // Fallback: x-forwarded-for. Take the LAST entry — a client-supplied chain is
  // prepended, so the rightmost hop is the one our own infrastructure added.
  const xff = firstValid(headers.get("x-forwarded-for"))
  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    if (parts.length > 0) return parts[parts.length - 1]
  }

  return UNKNOWN_IP
}

/**
 * Build a rate-limit identity for a request.
 *
 * Authenticated traffic is keyed on the user id, which is the only dimension
 * that actually describes "one actor". Keying everything on IP means users
 * behind CGNAT (mobile carriers) or a corporate NAT share a single bucket — at
 * a 60 req/min cap that is roughly 15 users before an entire carrier starts
 * seeing 429s. It also means a signed-in abuser can reset their bucket by
 * changing networks.
 *
 * Anonymous traffic still falls back to IP, because that is all we have.
 */
export function rateLimitIdentity(
  request: Request | { headers: Headers },
  userId?: string | null
): { key: string; scope: "user" | "ip" } {
  if (userId) return { key: `u:${userId}`, scope: "user" }
  return { key: `ip:${getClientIp(request)}`, scope: "ip" }
}
