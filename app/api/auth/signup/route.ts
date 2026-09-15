import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { z } from "zod"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { getClientIp } from "@/lib/security/clientIp"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const signupSchema = z.object({
  /**
   * Accepted for backwards compatibility and VERIFIED against the session.
   * It is never used as the identity — see the security note below.
   */
  userId: z.string().uuid(),
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores."),
  displayName: z.string().min(1).max(50),
})

/**
 * POST /api/auth/signup
 *
 * Completes the profile row for the CURRENTLY AUTHENTICATED user.
 *
 * ── Security history ────────────────────────────────────────────────────────
 * This route used to accept `userId` from the request body and write that row
 * with the service-role client whenever no session was present:
 *
 *     const { data: { user: sessionUser } } = await supabase.auth.getUser()
 *     if (sessionUser && sessionUser.id !== userId) → 403     // skipped when null
 *     await admin.from("profiles").upsert({ id: userId, username, display_name })
 *
 * The comment justifying it claimed the id "came from supabase.auth.signUp()
 * which is tamper-evident". It is not — it is a plain UUID in a JSON body, and
 * `upsert(..., { ignoreDuplicates: false })` UPDATES an existing row. Because
 * GET /api/profiles/[identifier] returns `id`, any user's UUID is publicly
 * enumerable from their username, which made this a fully unauthenticated
 * profile takeover:
 *
 *     VICTIM=$(curl -s /api/profiles/victim | jq -r .id)
 *     curl /api/auth/signup -d '{"userId":"'$VICTIM'","username":"pwned", ...}'
 *
 * The identity now comes exclusively from `auth.uid()`. A body `userId` that
 * disagrees with the session is rejected rather than honoured.
 *
 * Ordering note: body-size → schema validation → authentication. Validation
 * runs before the auth check because it is cheap and leaks nothing, and because
 * malformed input should read as 400 rather than 401.
 *
 * Live signup does not use this route at all (Google OAuth creates the profile
 * in app/auth/callback/route.ts against a verified session, and onboarding uses
 * PATCH /api/profiles/me). It is kept for the email/password flow, which is
 * currently disabled in the UI.
 */
export const POST = withSecurity(async (request: Request) => {
  const body = await request.json().catch(() => null)
  if (body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const [data, validationError] = validateRequestBody(body, signupSchema)
  if (validationError) return validationError

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in to complete your profile." },
      { status: 401 }
    )
  }

  // A mismatched body id is a tampering attempt, not a routine error.
  if (data.userId !== user.id) {
    return NextResponse.json({ error: "User ID mismatch." }, { status: 403 })
  }

  // Rate limit per authenticated user. This used to be keyed on the raw
  // x-forwarded-for header, whose leftmost entry the client controls — rotating
  // it gave unlimited attempts.
  const rateCheck = await checkRateLimit(`signup:${user.id}`, RATE_LIMITS.auth)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many profile setup attempts. Please wait a moment." },
      { status: 429 }
    )
  }
  // Anonymous-abuse backstop: also bound attempts per source address.
  const ipCheck = await checkRateLimit(`signup-ip:${getClientIp(request)}`, RATE_LIMITS.auth)
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Too many profile setup attempts. Please wait a moment." },
      { status: 429 }
    )
  }

  const username = data.username.toLowerCase()

  // Admin client: the profiles INSERT policy requires auth.uid() = id, which is
  // satisfied here, but the row may need creating before the first session cookie
  // round-trip completes. Scoped strictly to `user.id`, which the client cannot
  // influence.
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "This username is already taken." }, { status: 409 })
  }

  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      username,
      display_name: data.displayName,
    },
    { onConflict: "id", ignoreDuplicates: false }
  )

  if (error) {
    // profiles_username_lower_key (20260911) is the authoritative guard; the
    // check above only turns the common case into a friendlier message.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This username was just taken. Please choose another." },
        { status: 409 }
      )
    }
    console.error("Profile creation error:", error.code, error.message)
    return NextResponse.json(
      { error: "Profile creation failed. Please try again." },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
