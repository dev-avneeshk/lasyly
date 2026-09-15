import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { applyRateLimitHeaders } from "@/lib/security/rateLimiter"
import { checkRateLimitDistributed } from "@/lib/security/rateLimiterRedis"
import { getClientIp } from "@/lib/security/clientIp"
import {
  GUEST_COOKIE_NAME,
  verifyGuestToken,
} from "@/lib/security/guestCookie"
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/auth-config"

// ─── Configuration ───────────────────────────────────────────────────────────

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/onboarding",
  "/privacy",
  "/terms",
  "/auth/callback",
  "/blog",
  "/features",
  "/tipsters",
  "/explore",
  "/scores",
  "/news",
]

// Routes that need a REAL account — a signed guest cookie is not enough.
//
// The auth gate below treats `user || isGuest` as authenticated, which is right
// for browsing but wrong for pages whose only purpose is a write. Guests could
// reach /rooms/create and fill in the whole form, because the "Create Room"
// button is hidden for them but the route itself was never gated. Submitting
// then failed with 401 from POST /api/rooms/create (which correctly requires a
// Supabase user, and is additionally backstopped by the rooms_insert_own RLS
// policy). No data was ever at risk; it was a dead end.
//
// Prefixes are matched with startsWith, same as PUBLIC_ROUTES.
const ACCOUNT_REQUIRED_ROUTES = ["/rooms/create"]

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
].filter(Boolean)

/**
 * The one host the whole app must run on.
 *
 * Why this exists: `lasyly.me` and `www.lasyly.me` are both attached to the
 * project. When a browser sits on one host and an auth flow sets a cookie on
 * the other, the cookie is scoped to the host that answered the request (no
 * Domain attribute), so the page that reads it back never sees it. That is why
 * "Continue as guest" and Google sign-in appeared to do nothing on the apex:
 * POST /api/auth/guest was 307'd to www, the cookie landed on www, and the
 * following navigation to /explore stayed on the apex with no cookie, bouncing
 * straight back to /login.
 *
 * Fix: canonicalize the host in the proxy, before any cookie is set, so every
 * request — document navigation, fetch, and OAuth callback alike — is on one
 * origin.
 *
 * IMPORTANT: this MUST equal the Vercel project's PRIMARY domain. Vercel
 * redirects every non-primary attached domain to the primary at the edge,
 * before this proxy runs. If CANONICAL_HOST disagreed with the primary we would
 * ping-pong forever: edge sends apex→www, proxy sends www→apex, repeat. The
 * primary is `www.lasyly.me`, so it is pinned here rather than derived from
 * NEXT_PUBLIC_SITE_URL (which is currently the apex and would reintroduce the
 * loop). If you ever change the Vercel primary domain, change this to match.
 */
const CANONICAL_HOST = "www.lasyly.me"

const CORS_OPTIONS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400",
}

// Auth routes that should be tightly limited (login attempts, guest creation,
// logout). Matched as exact prefixes against the request pathname.
const AUTH_API_PREFIXES = ["/api/auth/"]

/**
 * Paths exempt from proxy rate limiting entirely.
 *
 * Stripe's webhook used to match AUTH_API_PREFIXES and inherit the 10 req/min
 * per-IP auth tier. Stripe delivers from a small set of source addresses, so a
 * burst of top-ups above ten a minute started returning 429 to Stripe. Stripe
 * retries with backoff, so payments arrived late rather than never — but those
 * retries are precisely what used to trigger the double-credit race in
 * process_stripe_topup (now closed by uq_transactions_stripe_session).
 *
 * A webhook's authenticity is established by its signature, not by its rate, and
 * the handler rejects anything that fails `constructEvent`. Rate limiting it
 * only creates a way to make us drop legitimate payment events.
 */
const RATE_LIMIT_EXEMPT_PREFIXES = ["/api/webhooks/"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Stable, per-session rate-limit bucket derived from the Supabase auth cookie.
 *
 * Why not the user id? Getting it would require verifying the JWT, which is a
 * network round-trip on symmetric-key projects — the exact cost this refactor
 * removes from the API path. Why not the unverified `sub` claim? Because an
 * unverified claim is attacker-chosen, so it would hand out a fresh bucket per
 * forged request.
 *
 * The cookie VALUE is signed by Supabase and cannot be forged into something
 * that also authenticates, so hashing it gives a bucket that is stable for a
 * real session and useless to rotate: a request with a made-up cookie gets its
 * own bucket but is rejected by the route with a 401 anyway.
 *
 * Supabase splits large tokens across `...auth-token.0` / `.1` chunks, so all
 * matching cookies are concatenated in name order.
 */
function sessionBucket(request: NextRequest): string | null {
  const authCookies = request.cookies
    .getAll()
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name))

  if (authCookies.length === 0) return null

  const material = authCookies.map((c) => `${c.name}=${c.value}`).join("|")
  // Truncated digest: 128 bits is far beyond collision risk for a bucket key,
  // and keeps the Redis key small.
  return createHash("sha256").update(material).digest("hex").slice(0, 32)
}

/**
 * Build the Content-Security-Policy header.
 *
 * Pages are statically generated / ISR-cached on CDN, so nonce-based CSP is
 * not viable (the nonce in the header would never match the one baked into
 * the cached HTML). We also cannot use 'strict-dynamic' without a nonce or
 * hash — when strict-dynamic is present, browsers that support it (all modern
 * browsers) silently ignore 'unsafe-inline', which blocks Next.js's inline
 * bootstrap scripts and prevents React from hydrating entirely.
 *
 * The correct approach for a statically-rendered Next.js app:
 *   script-src 'self' 'unsafe-inline'
 *
 * 'self' allows scripts loaded from our own origin (all Next.js chunks).
 * 'unsafe-inline' allows the small inline bootstrap scripts Next.js injects.
 * No strict-dynamic — it provides no benefit without a nonce/hash and actively
 * breaks things by overriding unsafe-inline.
 *
 * Development adds 'unsafe-eval' for React DevTools / HMR.
 * style-src keeps 'unsafe-inline' because Tailwind v4 injects inline styles.
 */
function buildCSPHeader(): string {
  const isDev = process.env.NODE_ENV === "development"

  const csp = `
    default-src 'self';
    script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com;
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
 * Which rate-limit tier a request falls into.
 *
 * "standard" is the per-session tier; "unauthenticated" is the per-IP tier. The
 * distinction is now about which KEY we can use, not just which ceiling — see
 * RATE_LIMIT_STANDARD in lib/security/constants.ts.
 */
function tierForPath(
  pathname: string,
  hasSession: boolean
): "auth" | "standard" | "unauthenticated" {
  if (AUTH_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return "auth"
  }
  return hasSession ? "standard" : "unauthenticated"
}

// ─── Proxy Function ──────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 0a. Canonical-host redirect ───────────────────────────────────────────
  // Force every request onto CANONICAL_HOST so auth cookies are always set and
  // read on the same origin. Runs first, before rate limiting / auth / cookie
  // writes, and only in production against real hosts (localhost, previews, and
  // Vercel *.vercel.app deploys are left alone). 308 preserves the method and
  // body, so a POST to /api/auth/guest on the wrong host is re-issued as a POST
  // to the right one instead of silently becoming a GET.
  const requestHost = request.headers.get("host")
  const isLocalHost =
    !requestHost ||
    requestHost.startsWith("localhost") ||
    requestHost.startsWith("127.0.0.1") ||
    requestHost.endsWith(".vercel.app")
  if (
    process.env.NODE_ENV !== "development" &&
    !isLocalHost &&
    requestHost !== CANONICAL_HOST
  ) {
    const canonicalUrl = new URL(request.url)
    canonicalUrl.host = CANONICAL_HOST
    canonicalUrl.port = ""
    return NextResponse.redirect(canonicalUrl, 308)
  }

  // ── 0b. Root → /explore ───────────────────────────────────────────────────
  // Land every visitor on the app's Explore page instead of the marketing home.
  // A 307 (temporary) is deliberate: it is not cached by browsers/search engines
  // the way a 308/301 is, so reverting to the marketing landing page later is a
  // one-line change with no stale-redirect tail. Query string is preserved.
  if (pathname === "/") {
    const exploreUrl = new URL(request.url)
    exploreUrl.pathname = "/explore"
    return NextResponse.redirect(exploreUrl, 307)
  }

  // ── 0. Build CSP header (no nonce — pages are statically cached) ────────
  const cspHeader = buildCSPHeader()

  // Forward CSP via request header so Server Components can read it if needed.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("Content-Security-Policy", cspHeader)

  // ── 1. CORS preflight (no rate limiting) ──────────────────────────────────
  if (pathname.startsWith("/api/") && request.method === "OPTIONS") {
    const origin = request.headers.get("origin") ?? ""
    const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin)
    const preflightHeaders: Record<string, string> = { ...CORS_OPTIONS }
    if (isAllowedOrigin) {
      preflightHeaders["Access-Control-Allow-Origin"] = origin
    }
    return NextResponse.json({}, { headers: preflightHeaders })
  }

  // Supabase keeps the session in cookies named `sb-<project-ref>-auth-token`,
  // split into `...auth-token.0` / `.1` chunks when the JWT is too big for one
  // cookie. Their presence is the cheapest available signal that there is a
  // session worth validating.
  const bucket = sessionBucket(request)
  const hasSupabaseSessionCookie = bucket !== null

  // ── 2. Distributed rate limit (Upstash in prod, in-memory fallback) ──────
  // Only API routes. Page navigations are not rate-limited here — doing so
  // produced 429s during normal browsing.
  //
  // The in-memory IP blocker that used to run here (checkIPBlock /
  // trackIPRequest from lib/security/rateLimiter) has been removed from this
  // path. Its stores are module-scoped Maps, so on serverless every instance
  // had its own: the 300 req/min auto-block threshold was effectively
  // unreachable and a block never propagated to the instance serving the next
  // request. The Next.js proxy docs are explicit that proxy code must not rely
  // on shared globals. It was protection on paper only, and keeping it made the
  // real (Redis-backed) limit below look like a second layer when it was the
  // only one.
  const isApiRoute = pathname.startsWith("/api/")
  const isRateLimitExempt = RATE_LIMIT_EXEMPT_PREFIXES.some((p) =>
    pathname.startsWith(p)
  )
  let rateLimitResult: Awaited<ReturnType<typeof checkRateLimitDistributed>> | null = null

  if (isApiRoute && !isRateLimitExempt) {
    const tier = tierForPath(pathname, hasSupabaseSessionCookie)
    // Authenticated traffic is keyed per session so users behind one NAT don't
    // share a bucket; anonymous traffic falls back to IP, read from
    // platform-set headers rather than the client-forgeable x-forwarded-for.
    const rateLimitKey =
      bucket !== null ? `${tier}:s:${bucket}` : `${tier}:i:${getClientIp(request)}`

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

    rateLimitResult = rateResult
  }

  // ── 3. Build response with forwarded headers ─────────────────────────────
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // ── 4. Apply rate-limit headers on API responses (informational) ─────────
  if (rateLimitResult) {
    applyRateLimitHeaders(response, rateLimitResult)
  }

  // ── 5. CORS headers on API responses ──────────────────────────────────────
  if (isApiRoute) {
    const origin = request.headers.get("origin") ?? ""
    const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin)
    if (isAllowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", origin)
    }
    Object.entries(CORS_OPTIONS).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  // ── 6. Security headers (CSP + HSTS + co.) ───────────────────────────────
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

  // ── 7. Session refresh & auth guard ───────────────────────────────────────
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  )
  const isStaticAsset =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname === "/manifest.json" ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|webp|woff2?|ttf|css|js)$/)

  /**
   * Validate the session only for PAGE requests.
   *
   * API routes are deliberately excluded. Every one of them calls
   * `createClient()` + `auth.getUser()` itself — they have to, because the proxy
   * cannot be their authorization boundary (the Next docs note that a matcher
   * change can silently remove proxy coverage, and Server Functions are POSTs to
   * whatever route they live in). So validating here as well meant every API
   * request paid TWO Supabase Auth round-trips, each an HTTP call plus an
   * auth.users read, serialized ahead of the response. On the arena poll path
   * that was 2 auth calls every 900ms per player.
   *
   * Dropping the API-side call halves that. Token refresh still happens: the
   * route's own server client refreshes an expired access token and writes the
   * new cookies (cookies() is writable in Route Handlers), and the browser
   * client refreshes proactively via autoRefreshToken + AuthListener.
   *
   * For pages we use getClaims() rather than getUser(). It verifies the JWT
   * locally with WebCrypto when the project uses asymmetric signing keys — no
   * network at all — and falls back to a server call otherwise, so it is never
   * worse than the getUser() it replaces. It also refreshes a near-expiry
   * session, which is the other thing this block is here for.
   */
  const needsSessionCheck =
    !isStaticAsset && !isApiRoute && hasSupabaseSessionCookie

  let authenticatedUserId: string | null = null

  if (needsSessionCheck) {
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

    try {
      const { data } = await supabase.auth.getClaims()
      const sub = data?.claims?.sub
      authenticatedUserId = typeof sub === "string" ? sub : null
    } catch {
      // Treat a validation failure as "not signed in" and let the guard below
      // redirect. Never fail the request open on a protected page.
      authenticatedUserId = null
    }
  }

  // ── 8. Auth guard (no network calls — safe to run on every request) ───────
  if (!isStaticAsset) {
    // Verify the HMAC-signed guest cookie.
    const isGuest = verifyGuestToken(
      request.cookies.get(GUEST_COOKIE_NAME)?.value
    )

    const isAuthed = Boolean(authenticatedUserId || isGuest)

    // Protected page routes require authentication (API routes self-enforce).
    const needsAuthGuard = !isApiRoute && !isPublicRoute

    // Write-only pages need a real Supabase user, so a guest cookie does not
    // satisfy them even though it satisfies needsAuthGuard.
    const needsRealAccount =
      !isApiRoute &&
      ACCOUNT_REQUIRED_ROUTES.some((route) => pathname.startsWith(route))

    if (
      (needsAuthGuard && !isAuthed) ||
      (needsRealAccount && !authenticatedUserId)
    ) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      const redirectResponse = NextResponse.redirect(loginUrl)
      // Forward any refreshed auth cookies
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value)
      })
      return redirectResponse
    }
  }

  return response
}

// ─── Matcher Configuration ───────────────────────────────────────────────────
// Skip Next-internal prefetches so we don't burn rate-limit budget on hidden
// link previews. Static asset paths and Next image optimization are also
// skipped so they can stay cacheable at the CDN.
//
// The extension list matters more than it looks: proxy runs on `public/` folder
// assets too, not just routes, so every image, font, and icon request was
// invoking the edge function before the CDN could answer it. That is latency
// added to the exact resources on the critical rendering path.
//
// `svg` is deliberately NOT excluded. An SVG opened by direct navigation is a
// document and can execute script, so those responses should keep the CSP that
// section 6 sets. The public SVGs are ~1 KB and off the critical path, so the
// proxy hop costs nothing there. Everything excluded here still receives
// nosniff / X-Frame-Options / HSTS from next.config.ts `headers()`, which
// applies to `/(.*)` independently of this matcher.
export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.json|.*\\.(?:png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|css|js|map|txt|xml|webmanifest)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
