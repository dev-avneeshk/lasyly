import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import {
  checkIPBlock,
  trackIPRequest,
  applyRateLimitHeaders,
} from "@/lib/security/rateLimiter"
import { checkRateLimitDistributed } from "@/lib/security/rateLimiterRedis"
import {
  GUEST_COOKIE_NAME,
  verifyGuestToken,
} from "@/lib/security/guestCookie"

// ─── Configuration ───────────────────────────────────────────────────────────

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/onboarding",
  "/privacy",
  "/terms",
]

const AUTH_ROUTES = ["/login", "/signup"]

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
].filter(Boolean)

const CORS_OPTIONS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
}

// Auth routes that should be tightly limited (login attempts, guest creation,
// logout). These are matched as exact prefixes against the request pathname.
const AUTH_API_PREFIXES = ["/api/auth/", "/api/webhooks/stripe"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Best-effort client IP extraction from common proxy headers, falling back to
 * a string sentinel so the rate-limit key space never collapses to a single
 * bucket when headers are missing.
 */
function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) {
    // x-forwarded-for is a comma-separated chain; the leftmost entry is the
    // original client. Trim aggressively because some proxies pad with spaces.
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get("x-real-ip")
  if (real) return real
  return "unknown"
}

/**
 * Build the Content-Security-Policy header.
 *
 * Production:
 *   script-src 'self' 'nonce-{n}' 'strict-dynamic'
 *   No 'unsafe-inline' on script-src — XSS via injected inline scripts is
 *   blocked. 'strict-dynamic' lets the nonce-trusted Next.js bootstrap script
 *   transitively authorize the chunks it loads, so we don't have to enumerate
 *   every script URL.
 *
 * Development:
 *   Same as production plus 'unsafe-eval' (React DevTools require it).
 *
 * style-src intentionally keeps 'unsafe-inline'. Tailwind v4, recharts, and
 * framer-motion all inject inline <style> tags. Locking those down requires
 * a separate workstream (per-component nonce attribution); the XSS payoff for
 * nonce-only style-src is much smaller than for script-src.
 */
function buildCSPHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development"

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isDev ? " 'unsafe-eval'" : ""
    }`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self' https: wss:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
  ]

  if (!isDev) {
    // upgrade-insecure-requests rewrites same-origin http:// subresources to
    // https://. Safari enforces this on localhost too, so we only emit it in
    // production where TLS is actually present.
    directives.push(`upgrade-insecure-requests`)
  }

  return directives.join("; ")
}

/**
 * Determine which rate-limit tier a request falls into.
 * Auth/webhook routes get the strictest tier; other API routes get standard;
 * everything else (page navigations, prefetches that slip past the matcher)
 * is unauthenticated.
 */
function tierForPath(pathname: string): "auth" | "standard" | "unauthenticated" {
  if (AUTH_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return "auth"
  }
  if (pathname.startsWith("/api/")) {
    return "standard"
  }
  return "unauthenticated"
}

// ─── Proxy Function ──────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const clientIp = getClientIp(request)

  // ── 0. Generate per-request CSP nonce ─────────────────────────────────────
  // crypto.randomUUID is available on the edge runtime; encoded as base64 so
  // it can be embedded directly in the CSP header without escaping.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const cspHeader = buildCSPHeader(nonce)

  // Forward the nonce to the rendering layer via a request header so React
  // Server Components can attach it to <Script> components when needed.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)

  // ── 1. IP block check (cheapest reject — do it first) ────────────────────
  const ipBlock = checkIPBlock(clientIp)
  if (ipBlock.blocked) {
    const blockedResponse = NextResponse.json(
      {
        error: "Too many requests. Try again later.",
        code: "IP_BLOCKED",
      },
      { status: 429 }
    )
    blockedResponse.headers.set("Retry-After", String(ipBlock.retryAfterSeconds))
    blockedResponse.headers.set("Content-Security-Policy", cspHeader)
    return blockedResponse
  }

  // ── 2. CORS preflight (no rate limiting) ──────────────────────────────────
  if (pathname.startsWith("/api/") && request.method === "OPTIONS") {
    const origin = request.headers.get("origin") ?? ""
    const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin)
    const preflightHeaders: Record<string, string> = { ...CORS_OPTIONS }
    if (isAllowedOrigin) {
      preflightHeaders["Access-Control-Allow-Origin"] = origin
    }
    return NextResponse.json({}, { headers: preflightHeaders })
  }

  // ── 3. Distributed rate limit (Upstash in prod, in-memory fallback) ──────
  // Only rate-limit API routes. Page navigations (HTML responses) are NOT
  // rate-limited here — they're protected by the CSP + IP block above.
  // Applying rate limits to page loads causes 429s during normal browsing
  // when the IP resolves to "unknown" (no proxy headers) and all requests
  // share the same bucket.
  const isApiRoute2 = pathname.startsWith("/api/")
  let _rateLimitResult: Awaited<ReturnType<typeof checkRateLimitDistributed>> | null = null

  if (isApiRoute2) {
    // Track every API request against the IP-level abuse detector.
    trackIPRequest(clientIp)

    const tier = tierForPath(pathname)
    const rateLimitKey = `${tier}:${clientIp}`
    const rateResult = await checkRateLimitDistributed(rateLimitKey, tier)

    if (!rateResult.allowed) {
      const limitedResponse = NextResponse.json(
        {
          error: "Too many requests. Please slow down.",
          code: "RATE_LIMIT_EXCEEDED",
        },
        { status: 429 }
      )
      applyRateLimitHeaders(limitedResponse, rateResult)
      limitedResponse.headers.set("Content-Security-Policy", cspHeader)
      return limitedResponse
    }

    // Store result so we can attach headers after the response is built
    _rateLimitResult = rateResult
  }

  // ── 4. Build response with forwarded headers (nonce visible to RSC) ──────
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // ── 5. Apply rate-limit headers on API responses (informational) ─────────
  if (_rateLimitResult) {
    applyRateLimitHeaders(response, _rateLimitResult)
  }

  // ── 6. CORS headers on API responses ──────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") ?? ""
    const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin)
    if (isAllowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", origin)
    }
    Object.entries(CORS_OPTIONS).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  // ── 7. Security headers (CSP + HSTS + co.) ───────────────────────────────
  response.headers.set("Content-Security-Policy", cspHeader)
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  )

  if (process.env.NODE_ENV !== "development") {
    // HSTS only makes sense over https. Sending it from the dev server teaches
    // Safari (which respects HSTS on localhost) to refuse plain http on this
    // host for a year, breaking every subsequent dev session in that browser.
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    )
  }

  // Strip identifying headers (in addition to next.config's poweredByHeader).
  response.headers.delete("X-Powered-By")
  response.headers.delete("Server")

  // ── 8. Auth guard (page routes only — API routes self-enforce) ────────────
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
  const isApiRoute = pathname.startsWith("/api/")
  const isStaticAsset =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|webp|woff2?|ttf|css|js)$/)

  if (!isPublicRoute && !isApiRoute && !isStaticAsset) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Verify the HMAC-signed guest cookie. A forged Cookie header (e.g.
    // `lasyly_guest=true`) no longer satisfies this check — only tokens
    // issued by /api/auth/guest with the server's GUEST_TOKEN_SECRET pass.
    const isGuest = verifyGuestToken(
      request.cookies.get(GUEST_COOKIE_NAME)?.value
    )

    if (!user && !isGuest) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }

    if (
      (user || isGuest) &&
      AUTH_ROUTES.some((route) => pathname.startsWith(route))
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // Redirect already-authed users away from /login and /signup.
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isGuest = verifyGuestToken(
      request.cookies.get(GUEST_COOKIE_NAME)?.value
    )

    if (user || isGuest) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return response
}

// ─── Matcher Configuration ───────────────────────────────────────────────────
// Skip Next-internal prefetches so we don't burn nonces (and rate-limit budget)
// on hidden link previews. Static asset paths and Next image optimization are
// also skipped so they can stay cacheable at the CDN.
export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
