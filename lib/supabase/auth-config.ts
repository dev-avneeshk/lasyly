/**
 * Centralized authentication cookie and session configuration.
 * These settings enforce security requirements for token rotation,
 * PKCE, and cookie hardening (Requirements 5.1–5.8).
 */

/**
 * Secure cookie options applied to all Supabase auth cookies.
 * - secure: only sent over HTTPS in production
 * - sameSite: lax allows cookies on top-level navigations (required for OAuth redirects)
 *   while still protecting against CSRF on sub-requests
 * 
 * NOTE: httpOnly is intentionally NOT set here. Supabase SSR requires both
 * server and client to read auth cookies. The browser client needs cookie access
 * to maintain the session. This is the standard Supabase SSR pattern.
 */
export const AUTH_COOKIE_OPTIONS = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

/**
 * Token lifetime configuration (informational — actual enforcement
 * is in Supabase dashboard settings).
 * Access token: 15 minutes (900 seconds)
 * Refresh token: 7 days (604800 seconds)
 */
export const TOKEN_LIFETIMES = {
  accessTokenExpirySeconds: 900,    // 15 minutes
  refreshTokenExpirySeconds: 604800, // 7 days
} as const

/**
 * Names of Supabase auth cookies to clear on session invalidation.
 * Supabase SSR uses chunked cookies with these prefixes.
 */
export const SUPABASE_AUTH_COOKIE_PREFIX = 'sb-'

/**
 * Clear all Supabase auth cookies from a response.
 * Used during logout and when handling invalid/expired sessions.
 */
export function getAuthCookiesToClear(cookieNames: string[]): string[] {
  return cookieNames.filter(
    (name) => name.startsWith(SUPABASE_AUTH_COOKIE_PREFIX)
  )
}
