/**
 * Regression tests for client-IP extraction.
 *
 * The original implementation read `x-forwarded-for.split(",")[0]` — the
 * LEFTMOST entry of a header the client can send. On any platform that appends
 * to the chain rather than replacing it, that value is attacker-chosen, so every
 * IP-keyed rate limit could be bypassed by rotating a header:
 *
 *   for i in $(seq 1 10000); do curl -H "X-Forwarded-For: 1.2.3.$i" ...; done
 */
import { describe, expect, it } from "vitest"
import { UNKNOWN_IP, getClientIp, rateLimitIdentity } from "@/lib/security/clientIp"

function req(headers: Record<string, string>): Request {
  return new Request("https://example.test/api/thing", { headers })
}

describe("getClientIp", () => {
  it("prefers the platform-set x-vercel-forwarded-for over x-forwarded-for", () => {
    const ip = getClientIp(
      req({
        // What an attacker sends:
        "x-forwarded-for": "1.2.3.4",
        // What Vercel sets and the client cannot forge:
        "x-vercel-forwarded-for": "203.0.113.7",
      })
    )
    expect(ip).toBe("203.0.113.7")
  })

  it("prefers cf-connecting-ip and x-real-ip over x-forwarded-for", () => {
    expect(
      getClientIp(req({ "x-forwarded-for": "1.2.3.4", "cf-connecting-ip": "198.51.100.9" }))
    ).toBe("198.51.100.9")
    expect(getClientIp(req({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "198.51.100.10" }))).toBe(
      "198.51.100.10"
    )
  })

  it("takes the RIGHTMOST x-forwarded-for entry when that's all we have", () => {
    // A spoofed chain is PREPENDED, so the trailing hop is the one our own
    // infrastructure appended. The old code took "1.2.3.4" here.
    const ip = getClientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.7" }))
    expect(ip).toBe("203.0.113.7")
  })

  it("cannot be steered by a forged leftmost entry", () => {
    const a = getClientIp(req({ "x-forwarded-for": "10.0.0.1, 203.0.113.7" }))
    const b = getClientIp(req({ "x-forwarded-for": "10.0.0.2, 203.0.113.7" }))
    const c = getClientIp(req({ "x-forwarded-for": "10.0.0.3, 203.0.113.7" }))
    // All three rotations land in the SAME bucket.
    expect(new Set([a, b, c]).size).toBe(1)
  })

  it("handles padded and empty entries", () => {
    expect(getClientIp(req({ "x-forwarded-for": "  1.2.3.4 ,  203.0.113.7  " }))).toBe(
      "203.0.113.7"
    )
    expect(getClientIp(req({ "x-forwarded-for": "203.0.113.7, , " }))).toBe("203.0.113.7")
  })

  it("returns a visible sentinel when no address header is present", () => {
    expect(getClientIp(req({}))).toBe(UNKNOWN_IP)
    expect(getClientIp(req({ "x-forwarded-for": "" }))).toBe(UNKNOWN_IP)
  })
})

describe("rateLimitIdentity", () => {
  it("keys authenticated traffic on the user, not the address", () => {
    const identity = rateLimitIdentity(req({ "x-real-ip": "203.0.113.7" }), "user-123")
    expect(identity).toEqual({ key: "u:user-123", scope: "user" })
  })

  it("two users behind one NAT get separate buckets", () => {
    const shared = req({ "x-real-ip": "203.0.113.7" })
    const a = rateLimitIdentity(shared, "user-a")
    const b = rateLimitIdentity(shared, "user-b")
    expect(a.key).not.toBe(b.key)
  })

  it("falls back to the address for anonymous traffic", () => {
    expect(rateLimitIdentity(req({ "x-real-ip": "203.0.113.7" }), null)).toEqual({
      key: "ip:203.0.113.7",
      scope: "ip",
    })
  })
})
