import { NextResponse } from "next/server"
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/auth-config"
import {
  GUEST_COOKIE_NAME,
  issueGuestToken,
} from "@/lib/security/guestCookie"

const GUEST_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

/**
 * POST /api/auth/guest
 *
 * Issues a tamper-evident guest cookie. The cookie is an HMAC-signed token
 * (see lib/security/guestCookie.ts) so a curl with a forged Cookie header
 * can no longer bypass the proxy auth gate.
 */
export async function POST() {
  let token: string
  try {
    token = issueGuestToken(GUEST_TTL_SECONDS)
  } catch (err) {
    console.error("Failed to issue guest token:", err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: "Guest sessions are not currently available." },
      { status: 503 }
    )
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(GUEST_COOKIE_NAME, token, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: GUEST_TTL_SECONDS,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(GUEST_COOKIE_NAME, "", {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0,
  })
  return response
}
