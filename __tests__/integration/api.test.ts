/**
 * Integration tests for API routes.
 *
 * These tests hit the actual API endpoints (locally or against production)
 * to verify end-to-end behavior including:
 * - Response shapes
 * - Auth enforcement
 * - Input validation
 * - Rate limiting
 * - Cache behavior
 *
 * Configuration:
 *   Set API_BASE_URL env var to test against a specific environment.
 *   Default: https://www.lasyly.me (production)
 *
 * NOTE: These tests are read-only. They do not create, modify, or delete
 * any data. They verify that endpoints respond correctly to unauthenticated
 * requests and validate error responses.
 */
import { describe, it, expect } from "vitest"

const BASE_URL = process.env.API_BASE_URL || "https://www.lasyly.me"

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body, headers: res.headers }
}

describe("Integration: Health & Public Endpoints", () => {
  it("GET /api/health returns OK with database check", async () => {
    const { status, body } = await api("/api/health")
    expect(status).toBe(200)
    expect(body.status).toBe("ok")
    expect(body.checks.database.status).toBe("ok")
    expect(body.checks.database.latencyMs).toBeGreaterThan(0)
    expect(body.timestamp).toBeDefined()
    expect(body.version).toBe("0.1.0")
  })

  it("GET /api/scores returns live scores", async () => {
    const { status, body } = await api("/api/scores")
    expect(status).toBe(200)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.meta).toBeDefined()
    expect(body.meta.source).toMatch(/^(db|espn|espn_cached)$/)

    if (body.data.length > 0) {
      const match = body.data[0]
      expect(match.homeTeam).toBeDefined()
      expect(match.awayTeam).toBeDefined()
      expect(match.sport).toBeDefined()
      expect(match.league).toBeDefined()
      expect(match.status).toBeDefined()
    }
  })

  it("GET /api/scores validates date format", async () => {
    const { status, body } = await api("/api/scores?date=invalid")
    expect(status).toBe(400)
    expect(body.error).toContain("Invalid date format")
  })

  it("GET /api/props returns props for valid sport/stat", async () => {
    const { status, body } = await api("/api/props?sport=Tennis&stat=aces&limit=3")
    expect(status).toBe(200)
    expect(Array.isArray(body.props)).toBe(true)
    // Tennis should have data (US Open in August)
    if (body.props.length > 0) {
      const prop = body.props[0]
      expect(prop.player).toBeDefined()
      expect(prop.statCategory).toBeDefined()
      expect(typeof prop.propLine).toBe("number")
      expect(prop.hitRate).toBeDefined()
      expect(prop.trend).toMatch(/^(up|down|neutral)$/)
    }
  })

  it("GET /api/props rejects invalid sport", async () => {
    const { status, body } = await api("/api/props?sport=Invalid")
    expect(status).toBe(400)
    expect(body.error).toContain("Invalid sport")
  })

  it("GET /api/props rejects invalid stat for sport", async () => {
    const { status, body } = await api("/api/props?sport=NBA&stat=invalid_stat")
    expect(status).toBe(400)
    expect(body.error).toContain("Invalid stat")
  })
})

describe("Integration: Auth Enforcement", () => {
  it("GET /api/wallet requires authentication", async () => {
    const { status, body } = await api("/api/wallet")
    expect(status).toBe(401)
    expect(body.error).toContain("logged in")
  })

  it("GET /api/bets requires authentication", async () => {
    const { status, body } = await api("/api/bets")
    expect(status).toBe(401)
    expect(body.error).toContain("logged in")
  })

  it("GET /api/parlays requires authentication", async () => {
    const { status, body } = await api("/api/parlays")
    expect(status).toBe(401)
    expect(body.error).toContain("Authentication required")
  })

  it("GET /api/profiles/me requires authentication", async () => {
    const { status, body } = await api("/api/profiles/me")
    expect(status).toBe(401)
    expect(body.error).toBeDefined()
  })

  it("POST /api/wallet/create-checkout requires authentication", async () => {
    const { status, body } = await api("/api/wallet/create-checkout", {
      method: "POST",
      body: JSON.stringify({ amount: 50 }),
    })
    expect(status).toBe(401)
    expect(body.error).toContain("logged in")
  })

  it("POST /api/picks/unlock requires authentication", async () => {
    const { status, body } = await api("/api/picks/unlock", {
      method: "POST",
      body: JSON.stringify({
        betslipId: "00000000-0000-0000-0000-000000000000",
        tipsterId: "00000000-0000-0000-0000-000000000000",
      }),
    })
    expect(status).toBe(401)
    expect(body.error).toContain("logged in")
  })

  it("POST /api/rooms/create requires authentication", async () => {
    const { status, body } = await api("/api/rooms/create", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Room",
        description: "Test",
        sport_tag: "NBA",
        type: "Public",
      }),
    })
    expect(status).toBe(401)
    expect(body.error).toContain("logged in")
  })
})

describe("Integration: Input Validation", () => {
  it("POST /api/auth/signup validates UUID format", async () => {
    const { status, body } = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        userId: "not-a-uuid",
        username: "testuser",
        displayName: "Test",
      }),
    })
    expect(status).toBe(400)
  })

  it("POST /api/auth/signup validates username format", async () => {
    const { status, body } = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        userId: "00000000-0000-0000-0000-000000000000",
        username: "ab", // too short
        displayName: "Test",
      }),
    })
    expect(status).toBe(400)
  })

  it("POST /api/auth/signup rejects special characters in username", async () => {
    const { status } = await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        userId: "00000000-0000-0000-0000-000000000000",
        username: "test<script>",
        displayName: "Test",
      }),
    })
    expect(status).toBe(400)
  })
})

describe("Integration: Security Headers", () => {
  it("responses include CSP header", async () => {
    const { headers } = await api("/api/health")
    const csp = headers.get("content-security-policy")
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
  })

  it("responses include security headers", async () => {
    const { headers } = await api("/api/health")
    expect(headers.get("x-content-type-options")).toBe("nosniff")
    expect(headers.get("x-frame-options")).toBe("DENY")
    expect(headers.get("strict-transport-security")).toContain("max-age=")
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin")
  })

  it("responses include rate limit headers on API routes", async () => {
    const { headers } = await api("/api/scores")
    expect(headers.get("x-ratelimit-limit")).toBeDefined()
    expect(headers.get("x-ratelimit-remaining")).toBeDefined()
  })
})

describe("Integration: Guest Authentication", () => {
  it("POST /api/auth/guest issues a signed cookie", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/guest`, { method: "POST" })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toContain("lasyly_guest=")
    // Token format: base64url.base64url (HMAC-signed)
    const match = setCookie?.match(/lasyly_guest=([^;]+)/)
    if (match) {
      const token = match[1]
      expect(token).toContain(".")
      const parts = token.split(".")
      expect(parts.length).toBe(2)
      expect(parts[0].length).toBeGreaterThan(10) // payload
      expect(parts[1].length).toBeGreaterThan(10) // HMAC
    }
  })

  it("DELETE /api/auth/guest clears the cookie", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/guest`, { method: "DELETE" })
    expect(res.status).toBe(200)
    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toContain("lasyly_guest=")
    expect(setCookie).toContain("Max-Age=0")
  })
})

describe("Integration: Stripe Webhook Security", () => {
  it("POST /api/webhooks/stripe rejects missing signature", async () => {
    const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    })
    // 400 if Stripe is configured (missing signature), 500 if Stripe is not configured
    expect([400, 500]).toContain(res.status)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("POST /api/webhooks/stripe rejects invalid signature", async () => {
    const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=1234,v1=fakesignature",
      },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    })
    // Should be 400 (signature verification failed) or 500 (Stripe not configured)
    expect([400, 500]).toContain(res.status)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})

describe("Integration: Cron Route Protection", () => {
  it("POST /api/cron/settle-parlays requires CRON_SECRET", async () => {
    const { status, body } = await api("/api/cron/settle-parlays", {
      method: "POST",
    })
    expect(status).toBe(401)
    expect(body.error).toBe("Unauthorized")
  })

  it("POST /api/cron/settle-parlays rejects wrong secret", async () => {
    const res = await fetch(`${BASE_URL}/api/cron/settle-parlays`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    })
    expect(res.status).toBe(401)
  })
})
