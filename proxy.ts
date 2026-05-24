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
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/auth-config"

// ─── Configuration ───────────────────────────────────────────────────────────

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/onboarding",
  "/privacy",
  "/terms",
  "/auth/callback",
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
 * Next.js 16 automatically reads the 'nonce-{value}' from this header and
 * applies it to all framework script tags during SSR — no manual wiring needed.
 * 'strict-dynamic' lets nonce-trusted scripts transitively load their chunks.
 *
 * Development adds 'unsafe-eval' for React DevTools / HMR.
 * style-src keeps 'unsafe-inline' because Tailwind v4, recharts, and
 * framer-motion inject inline <style> tags at runtime.
 */
function buildCSPHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development"

  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https: blob:;
    font-src 'self' data:;
    connect-src 'self' https: wss:;
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    frame-ancestors 'none';
    form-action 'self';
    ${isDev ? "" : "upgrade-insecure-requests;"}
  `

  return csp.replace(/\s{2,}/g, " ").trim()
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
  // Next.js 16 automatically reads 'nonce-{value}' from the CSP header and
  // stamps it on all framework <script> tags during SSR — no layout changes needed.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const cspHeader = buildCSPHeader(nonce)

  // Forward the nonce via request header so Server Components can read it
  // if they need to pass it to third-party <Script> tags.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", cspHeader)

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

  const needsAuthCheck =
    !isApiRoute &&
    !isStaticAsset &&
    (!isPublicRoute || AUTH_ROUTES.some((route) => pathname.startsWith(route)))

  if (needsAuthCheck) {
    // Create a single Supabase client for this request so we only call
    // getUser() once. Creating two clients (one per branch) and calling
    // getUser() on each races to consume the same refresh token, which
    // triggers Supabase's "refresh_token_already_used" error.
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
              request.cookies.set(name, value)
              response.cookies.set(name, value, {
                ...options,
                ...AUTH_COOKIE_OPTIONS,
              })
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

    const isAuthed = Boolean(user || isGuest)

    // Already-authenticated users should not see /login or /signup.
    if (isAuthed && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
      // Guest sessions only have a signed cookie — no Supabase user row.
      // Sending guests to /dashboard causes a loop because dashboard SSR
      // calls supabase.auth.getUser(), gets null, and redirects back to /login.
      // Send guests to /explore; real users go to /dashboard.
      const destination = user ? "/dashboard" : "/explore"
      const redirectResponse = NextResponse.redirect(new URL(destination, request.url))
      // Forward any refreshed auth cookies so the new tokens aren't lost.
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value)
      })
      return redirectResponse
    }

    // Protected routes require authentication.
    if (!isPublicRoute && !isAuthed) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      const redirectResponse = NextResponse.redirect(loginUrl)
      // Forward any refreshed auth cookies so the consumed refresh token
      // is replaced with the new one — prevents "refresh_token_already_used".
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value)
      })
      return redirectResponse
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
