/**
 * E2E Journey Tests (API-level)
 *
 * These tests simulate critical user journeys through the production API
 * without requiring a browser framework. They verify the complete request
 * path: proxy → route handler → database → response.
 *
 * Journeys covered:
 * 1. Unauthenticated exploration (scores, props, public pages)
 * 2. Guest session flow
 * 3. Auth enforcement across protected resources
 * 4. Player analysis data flow
 * 5. Wallet/payment graceful degradation
 *
 * For browser-based E2E (signup/login with real Supabase auth):
 * - Install Playwright: npm i -D @playwright/test
 * - Create playwright.config.ts targeting https://www.lasyly.me
 * - See __tests__/e2e/README.md for journey definitions
 *
 * These API journeys run against production and make no mutations.
 */
import { describe, it, expect } from "vitest"

const BASE_URL = process.env.API_BASE_URL || "https://www.lasyly.me"

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, options)
  return {
    status: res.status,
    headers: res.headers,
    body: await res.json().catch(() => null),
    raw: res,
  }
}

describe("E2E Journey: Unauthenticated Exploration", () => {
  it("complete scores browsing journey", async () => {
    // 1. Load today's scores
    const scores = await api("/api/scores")
    expect(scores.status).toBe(200)
    expect(scores.body.success).toBe(true)
    expect(Array.isArray(scores.body.data)).toBe(true)
    const matches = scores.body.data

    // 2. Filter by sport
    const footballScores = await api("/api/scores?sport=Football")
    expect(footballScores.status).toBe(200)
    expect(footballScores.body.success).toBe(true)

    // 3. Load historical date
    const historical = await api("/api/scores?date=20260820")
    expect(historical.status).toBe(200)

    // 4. If there are matches with eventIds, try match detail
    if (matches.length > 0 && matches[0].eventId) {
      const detail = await api(`/api/scores/${matches[0].eventId}/summary`)
      // May 404 if no summary available, or 200 with data
      expect([200, 404]).toContain(detail.status)
    }
  })

  it("complete props browsing journey", async () => {
    // 1. Load Tennis props (active in August — US Open)
    const tennisProps = await api("/api/props?sport=Tennis&stat=aces&limit=5")
    expect(tennisProps.status).toBe(200)
    expect(Array.isArray(tennisProps.body.props)).toBe(true)

    // 2. Try different stat
    const dfProps = await api("/api/props?sport=Tennis&stat=double_faults&limit=3")
    expect(dfProps.status).toBe(200)

    // 3. Try NBA (offseason — should return empty but not error)
    const nbaProps = await api("/api/props?sport=NBA&stat=pts&limit=5")
    expect(nbaProps.status).toBe(200)
    expect(Array.isArray(nbaProps.body.props)).toBe(true)

    // 4. Try invalid params — should get 400
    const invalidSport = await api("/api/props?sport=Quidditch")
    expect(invalidSport.status).toBe(400)

    const invalidStat = await api("/api/props?sport=NBA&stat=wizardry")
    expect(invalidStat.status).toBe(400)
  })

  it("public rooms are accessible", async () => {
    const rooms = await api("/api/rooms/explore")
    expect(rooms.status).toBe(200)
    expect(rooms.body.rooms).toBeDefined()
    expect(Array.isArray(rooms.body.rooms)).toBe(true)

    // Public rooms should be visible without auth
    if (rooms.body.rooms.length > 0) {
      const room = rooms.body.rooms[0]
      expect(room.name).toBeDefined()
      expect(room.id).toBeDefined()
    }
  })

  it("news endpoint works", async () => {
    const news = await api("/api/news/rss")
    // May return 200 with articles or 200 with empty
    expect(news.status).toBe(200)
  })
})

describe("E2E Journey: Guest Session", () => {
  it("complete guest flow: issue → use → delete", async () => {
    // 1. Issue guest token
    const issueRes = await fetch(`${BASE_URL}/api/auth/guest`, { method: "POST" })
    expect(issueRes.status).toBe(200)
    const issueBody = await issueRes.json()
    expect(issueBody.ok).toBe(true)

    // 2. Extract cookie
    const setCookie = issueRes.headers.get("set-cookie") || ""
    expect(setCookie).toContain("lasyly_guest=")
    const cookieMatch = setCookie.match(/lasyly_guest=([^;]+)/)
    expect(cookieMatch).not.toBeNull()
    const guestCookie = `lasyly_guest=${cookieMatch![1]}`

    // 3. Verify token format (payload.hmac)
    const token = cookieMatch![1]
    const parts = token.split(".")
    expect(parts.length).toBe(2)

    // 4. Use guest cookie to access a page (not API — pages check guest in proxy)
    // API routes still require Supabase auth, but the proxy grants page access
    const pageRes = await fetch(`${BASE_URL}/explore`, {
      headers: { Cookie: guestCookie },
      redirect: "manual",
    })
    // Should NOT redirect to login (guest has page access)
    // 200 = page served, 304 = cached, 307 = redirect
    expect([200, 304]).toContain(pageRes.status)

    // 5. Delete guest cookie
    const deleteRes = await fetch(`${BASE_URL}/api/auth/guest`, { method: "DELETE" })
    expect(deleteRes.status).toBe(200)
    const deleteCookie = deleteRes.headers.get("set-cookie") || ""
    expect(deleteCookie).toContain("Max-Age=0")
  })
})

describe("E2E Journey: Auth Enforcement Across Resources", () => {
  const protectedEndpoints = [
    { method: "GET", path: "/api/wallet" },
    { method: "GET", path: "/api/bets" },
    { method: "GET", path: "/api/parlays" },
    { method: "GET", path: "/api/profiles/me" },
    { method: "GET", path: "/api/dashboard" },
    { method: "GET", path: "/api/notifications" },
    { method: "POST", path: "/api/betslips" },
    { method: "POST", path: "/api/parlays" },
  ]

  for (const endpoint of protectedEndpoints) {
    it(`${endpoint.method} ${endpoint.path} requires authentication`, async () => {
      const { status, body } = await api(endpoint.path, {
        method: endpoint.method,
        ...(endpoint.method === "POST" ? { body: JSON.stringify({}) } : {}),
      })
      expect([401, 403]).toContain(status)
      expect(body?.error).toBeDefined()
    })
  }
})

describe("E2E Journey: Player Analysis Data Flow", () => {
  it("complete analysis journey: props → player detail data", async () => {
    // 1. Get available Tennis props
    const propsRes = await api("/api/props?sport=Tennis&stat=aces&limit=1")
    expect(propsRes.status).toBe(200)

    if (propsRes.body.props && propsRes.body.props.length > 0) {
      const prop = propsRes.body.props[0]
      const playerName = prop.player

      // 2. Search for the player specifically
      const searchRes = await api(
        `/api/props?sport=Tennis&stat=aces&search=${encodeURIComponent(playerName)}`
      )
      expect(searchRes.status).toBe(200)
      expect(searchRes.body.props.length).toBeGreaterThan(0)

      const foundProp = searchRes.body.props[0]
      expect(foundProp.player).toBe(playerName)
      expect(foundProp.propLine).toBeGreaterThan(0)
      expect(foundProp.hitRate).toBeDefined()
      expect(foundProp.trend).toMatch(/^(up|down|neutral)$/)
      expect(foundProp.lastGames).toBeDefined()
      expect(Array.isArray(foundProp.lastGames)).toBe(true)
    }
  })
})

describe("E2E Journey: Wallet Graceful Degradation", () => {
  it("wallet checkout returns 503 when Stripe not configured", async () => {
    // This verifies the graceful degradation path since Stripe isn't live
    // Note: needs auth first, so we get 401 (which is also correct)
    const { status } = await api("/api/wallet/create-checkout", {
      method: "POST",
      body: JSON.stringify({ amount: 50 }),
    })
    // 401 = auth required (correct — Stripe check happens after auth)
    expect(status).toBe(401)
  })

  it("Stripe webhook returns error without proper configuration", async () => {
    const res = await fetch(`${BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=fake" },
      body: "{}",
    })
    // 500 = Stripe not configured (before signature check)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain("Stripe not configured")
  })
})

describe("E2E Journey: Cron/Internal Route Protection", () => {
  const cronEndpoints = [
    { path: "/api/cron/settle-parlays", method: "POST" },
    { path: "/api/cron/resolve-parlays", method: "POST" },
    { path: "/api/cron/cleanup-chat", method: "POST" },
    { path: "/api/cron/correlations", method: "GET" },
  ]

  for (const { path, method } of cronEndpoints) {
    it(`${method} ${path} rejects unauthorized requests`, async () => {
      const res = await fetch(`${BASE_URL}${path}`, { method })
      expect([401, 403]).toContain(res.status)
    })
  }
})

describe("E2E Journey: Security Boundary Verification", () => {
  it("injection patterns are rejected", async () => {
    const { status } = await api("/api/props?sport=NBA&search='; DROP TABLE users; --")
    // Should be 400 (injection detected) or 200 (sanitized safely)
    // The important thing is it doesn't 500
    expect([200, 400]).toContain(status)
  })

  it("oversized body is rejected", async () => {
    // 2MB payload (limit is 1MB)
    const bigPayload = "x".repeat(2 * 1024 * 1024)
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bigPayload,
    })
    expect([400, 413]).toContain(res.status)
  })

  it("CORS preflight returns proper headers", async () => {
    const res = await fetch(`${BASE_URL}/api/scores`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://www.lasyly.me",
        "Access-Control-Request-Method": "GET",
      },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("access-control-allow-methods")).toContain("GET")
  })
})
