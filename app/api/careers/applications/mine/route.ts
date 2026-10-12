import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { getClientIp } from "@/lib/security/clientIp"
import { withSecurity } from "@/lib/security/routeHelpers"
import { isUuid } from "@/lib/careers/server"

/**
 * GET /api/careers/applications/mine — has the signed-in account already
 * applied in this scope?
 *
 * Scope follows the submit route: ?jobId=<uuid> for a specific role, or no
 * jobId for the general / talent-pool application (job_id IS NULL).
 *
 * This is a UX helper for the apply form, so it fails open: no session, an
 * invalid jobId, a rate-limit, or a DB error all return { applied: false }
 * rather than an error, so the form always renders. The POST route is the real
 * enforcement point. Reads use the service role (careers_applications has no
 * RLS policies); the response only ever exposes the short reference.
 */
export const GET = withSecurity(async (request: Request) => {
  // Fails open: a tripped limit still returns { applied: false } so the form
  // renders; it just skips the lookup.
  const ipCheck = await checkRateLimit(
    `careers:mine:ip:${getClientIp(request)}`,
    RATE_LIMITS.careersApplyIp
  )
  if (!ipCheck.allowed) {
    return NextResponse.json({ applied: false })
  }

  const authClient = await createClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()
  if (!user || user.is_anonymous) {
    return NextResponse.json({ applied: false })
  }

  const jobIdParam = new URL(request.url).searchParams.get("jobId")
  // An invalid jobId is treated as "no match" (not a 400) to keep the client
  // simple; an absent/empty jobId means the general pool.
  if (jobIdParam && !isUuid(jobIdParam)) {
    return NextResponse.json({ applied: false })
  }

  try {
    const supabase = createAdminClient()
    const base = supabase.from("careers_applications").select("reference").eq("user_id", user.id)
    const scoped = jobIdParam ? base.eq("job_id", jobIdParam) : base.is("job_id", null)
    const { data, error } = await scoped.maybeSingle()
    if (error) {
      console.error("[careers/mine] lookup failed:", error.message)
      return NextResponse.json({ applied: false })
    }
    return data
      ? NextResponse.json({ applied: true, reference: data.reference })
      : NextResponse.json({ applied: false })
  } catch (err) {
    console.error("[careers/mine] lookup threw:", err)
    return NextResponse.json({ applied: false })
  }
})
