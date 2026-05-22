import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AUTH_COOKIE_OPTIONS, getAuthCookiesToClear } from '@/lib/supabase/auth-config'
import { GUEST_COOKIE_NAME } from '@/lib/security/guestCookie'
import { cookies } from 'next/headers'

/**
 * POST /api/auth/logout
 * Invalidates the current session (both access and refresh tokens)
 * on the server side and clears all auth cookies.
 * Requirements: 5.4 (session invalidation on logout)
 */
export async function POST() {
  const supabase = await createClient()
  const cookieStore = await cookies()

  // Sign out on the server — this invalidates the refresh token
  // so it cannot be replayed. Supabase's signOut with scope 'global'
  // invalidates all sessions for the user across devices.
  // Use 'local' to only invalidate the current session.
  await supabase.auth.signOut({ scope: 'local' })

  // Clear all Supabase auth cookies
  const allCookieNames = cookieStore.getAll().map((c) => c.name)
  const authCookieNames = getAuthCookiesToClear(allCookieNames)

  const response = NextResponse.json({ ok: true })

  for (const name of authCookieNames) {
    response.cookies.set(name, '', {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 0,
    })
  }

  // Also clear the guest cookie if present
  response.cookies.set(GUEST_COOKIE_NAME, '', {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0,
  })

  return response
}
