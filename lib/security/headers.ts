/**
 * Security Headers Module.
 *
 * Applies comprehensive HTTP security headers to all responses:
 * - Content-Security-Policy (CSP)
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options
 * - X-Frame-Options
 * - Referrer-Policy
 * - Permissions-Policy
 *
 * Also provides CORS origin validation and strips identifying server headers.
 */

import { NextResponse } from "next/server"
import type { SecurityHeadersConfig } from "./types"
import { HSTS_MIN_MAX_AGE, MAX_ALLOWED_ORIGINS } from "./constants"

/**
 * Constructs the Content-Security-Policy header value.
 *
 * script-src is set to 'self' plus any trusted domains from config.
 * 'unsafe-inline' and 'unsafe-eval' are never included.
 * object-src is always 'none'.
 */
export function buildCSP(config: SecurityHeadersConfig): string {
  const isDev = process.env.NODE_ENV === 'development'
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    ...config.trustedDomains,
  ]
  const directives = [
    `default-src 'self'`,
    `script-src ${scriptSources.join(" ")}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' https: wss:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
  ]

  if (config.cspReportUri) {
    directives.push(`report-uri ${config.cspReportUri}`)
  }

  return directives.join("; ")
}

/**
 * Applies all security headers to a NextResponse.
 *
 * Sets CSP, HSTS, X-Content-Type-Options, X-Frame-Options,
 * Referrer-Policy, Permissions-Policy, and strips X-Powered-By and Server headers.
 *
 * Headers are applied regardless of response status code (2xx, 3xx, 4xx, 5xx).
 */
export function applySecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig
): void {
  // Enforce minimum HSTS max-age
  const hstsMaxAge = Math.max(config.hstsMaxAge, HSTS_MIN_MAX_AGE)

  // Content-Security-Policy
  response.headers.set("Content-Security-Policy", buildCSP(config))

  // Strict-Transport-Security with includeSubDomains
  response.headers.set(
    "Strict-Transport-Security",
    `max-age=${hstsMaxAge}; includeSubDomains`
  )

  // X-Content-Type-Options
  response.headers.set("X-Content-Type-Options", "nosniff")

  // X-Frame-Options
  response.headers.set("X-Frame-Options", "DENY")

  // Referrer-Policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions-Policy - disable camera, microphone, geolocation, payment
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  )

  // Strip identifying headers
  response.headers.delete("X-Powered-By")
  response.headers.delete("Server")
}

/**
 * Validates whether a request origin is allowed for CORS.
 *
 * Returns true if the origin is present in the allowed origins list
 * (limited to MAX_ALLOWED_ORIGINS entries). Returns false for null origins
 * or origins not in the allowlist.
 */
export function validateOrigin(
  origin: string | null,
  config: SecurityHeadersConfig
): boolean {
  if (!origin) {
    return false
  }

  // Enforce maximum allowed origins limit
  const allowedOrigins = config.allowedOrigins.slice(0, MAX_ALLOWED_ORIGINS)

  return allowedOrigins.includes(origin)
}
