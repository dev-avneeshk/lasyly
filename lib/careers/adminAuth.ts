import "server-only"

import { NextResponse, connection } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Careers admin guard.
 *
 * The platform has no global admin role, so careers access is an explicit
 * allowlist: CAREERS_ADMIN_EMAILS is a comma-separated list of account emails
 * (server-only env var, never sent to the browser). A caller is an admin only
 * if they have a real Supabase session (not a guest cookie) whose email is
 * confirmed and on the list. An unset/empty list means nobody is an admin —
 * the guard fails closed.
 */
function allowlist(): Set<string> {
  return new Set(
    (process.env.CAREERS_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

export interface CareersAdmin {
  id: string
  email: string
}

export async function getCareersAdmin(): Promise<CareersAdmin | null> {
  // Always per-request. Without this, an empty allowlist at build time returns
  // before cookies() is read and Next prerenders the admin pages as a static 404.
  await connection()
  const allowed = allowlist()
  if (allowed.size === 0) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.is_anonymous || !user.email || !user.email_confirmed_at) return null

  const email = user.email.toLowerCase()
  return allowed.has(email) ? { id: user.id, email } : null
}

/**
 * For admin API routes: returns the admin, or a 404 response. 404 (not 403) so
 * the endpoints don't advertise their existence to non-admins.
 */
export async function requireCareersAdmin(): Promise<
  { admin: CareersAdmin; response: null } | { admin: null; response: NextResponse }
> {
  const admin = await getCareersAdmin()
  if (admin) return { admin, response: null }
  return {
    admin: null,
    response: NextResponse.json({ error: "Not found." }, { status: 404 }),
  }
}
