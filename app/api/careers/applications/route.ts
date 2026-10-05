import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { getClientIp } from "@/lib/security/clientIp"
import { withSecurity } from "@/lib/security/routeHelpers"
import { applicationRequestSchema } from "@/lib/careers/validation"
import { MIN_FILL_TIME_MS } from "@/lib/careers/constants"
import { getActiveJobById } from "@/lib/careers/server"

/**
 * POST /api/careers/applications — job / talent-pool application.
 *
 * Requires a signed-in account (a real Supabase user; guest cookies and
 * anonymous users are rejected). The listing and form pages stay public and
 * static; this route is the enforcement point, the form's sign-in gate is only
 * UX. Everything is still validated here regardless of what the form checked.
 * Writes use the service role; careers_applications has no RLS policies, so the
 * anon key can neither read nor write it.
 *
 * Anti-abuse: per-IP and per-email rate limits, a honeypot field, a minimum
 * fill time, and an idempotency key (submissionKey) so a double-click or a
 * retried request returns the original application instead of a duplicate.
 *
 * The response only ever contains the short reference, never the row id or
 * any stored data, and errors are generic (details go to server logs).
 */

const GENERIC_ERROR =
  "Something went wrong while submitting your application. Please try again."

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status })
}

export const POST = withSecurity(
  async (request: Request) => {
    // Captured before any awaited I/O so slow rate-limit/Redis calls can't
    // inflate the measured fill time.
    const receivedAt = Date.now()

    const authClient = await createClient()
    const {
      data: { user },
    } = await authClient.auth.getUser()
    if (!user || user.is_anonymous) {
      return fail(401, "Please log in to submit an application.", { code: "AUTH_REQUIRED" })
    }

    const ip = getClientIp(request)
    const ipCheck = await checkRateLimit(`careers:apply:ip:${ip}`, RATE_LIMITS.careersApplyIp)
    if (!ipCheck.allowed) {
      return fail(
        429,
        "You've submitted several applications recently. Please wait a while and try again.",
        { code: "RATE_LIMITED" }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail(400, GENERIC_ERROR, { code: "BAD_REQUEST" })
    }

    const parsed = applicationRequestSchema.safeParse(body)
    if (!parsed.success) {
      // Only field-level messages (the same ones the form shows) are returned.
      const issues = parsed.error.issues.filter((i) => i.path[0] === "fields")
      const fields: Record<string, string> = {}
      for (const issue of issues) {
        const key = String(issue.path[1] ?? "form")
        if (!fields[key]) fields[key] = issue.message
      }
      if (Object.keys(fields).length === 0) {
        return fail(400, GENERIC_ERROR, { code: "BAD_REQUEST" })
      }
      return fail(400, "Please check the highlighted fields.", {
        code: "VALIDATION_ERROR",
        fields,
      })
    }

    const { fields, jobId, submissionKey, website, startedAt } = parsed.data

    // Honeypot filled, or the form was "completed" faster than a human can.
    const elapsed = receivedAt - startedAt
    if ((website && website.trim() !== "") || elapsed < MIN_FILL_TIME_MS || elapsed < -60_000) {
      return fail(400, GENERIC_ERROR, { code: "REJECTED" })
    }

    const emailCheck = await checkRateLimit(
      `careers:apply:email:${fields.email}`,
      RATE_LIMITS.careersApplyEmail
    )
    if (!emailCheck.allowed) {
      return fail(
        429,
        "We've already received several applications from this email address today. Please try again tomorrow.",
        { code: "RATE_LIMITED" }
      )
    }

    const supabase = createAdminClient()

    // Idempotency: same submissionKey → same application.
    const existing = await supabase
      .from("careers_applications")
      .select("reference")
      .eq("submission_key", submissionKey)
      .maybeSingle()
    if (existing.error) {
      console.error("[careers/apply] idempotency lookup failed:", existing.error.message)
      return fail(500, GENERIC_ERROR)
    }
    if (existing.data) {
      return NextResponse.json({ reference: existing.data.reference, duplicate: true })
    }

    let jobTitle: string | null = null
    if (jobId) {
      let job
      try {
        job = await getActiveJobById(jobId)
      } catch (err) {
        console.error("[careers/apply] job lookup failed:", err)
        return fail(500, GENERIC_ERROR)
      }
      if (!job) {
        return fail(409, "This position is no longer accepting applications.", {
          code: "JOB_UNAVAILABLE",
        })
      }
      jobTitle = job.title
    }

    const insert = await supabase
      .from("careers_applications")
      .insert({
        submission_key: submissionKey,
        application_type: jobId ? "job" : "general",
        job_id: jobId,
        job_title: jobTitle,
        full_name: fields.fullName,
        email: fields.email,
        phone: fields.phone,
        location: fields.location,
        current_job_title: fields.currentJobTitle ?? null,
        current_company: fields.currentCompany ?? null,
        experience: fields.experience,
        linkedin: fields.linkedin ?? null,
        portfolio_url: fields.portfolioUrl,
        fit_answer: fields.fitAnswer,
        referral_source: fields.referralSource ?? null,
        referral_other: fields.referralSource === "other" ? fields.referralOther ?? null : null,
        consent_at: new Date().toISOString(),
      })
      .select("reference")
      .single()

    if (insert.error) {
      // 23505 = unique_violation: a concurrent request with the same key won.
      if (insert.error.code === "23505") {
        const again = await supabase
          .from("careers_applications")
          .select("reference")
          .eq("submission_key", submissionKey)
          .maybeSingle()
        if (again.data) {
          return NextResponse.json({ reference: again.data.reference, duplicate: true })
        }
      }
      console.error("[careers/apply] insert failed:", insert.error.code, insert.error.message)
      return fail(500, GENERIC_ERROR)
    }

    return NextResponse.json({ reference: insert.data.reference }, { status: 201 })
  },
  { maxBodySize: 32 * 1024 }
)
