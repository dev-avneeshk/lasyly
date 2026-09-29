import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { withSecurity, validateRequestBody } from "@/lib/security/routeHelpers"
import { requireCareersAdmin } from "@/lib/careers/adminAuth"
import { jobSchema } from "@/lib/careers/validation"
import { isUuid } from "@/lib/careers/server"
import { jobInputToRow, refreshPublicJobs } from "@/lib/careers/jobWrites"

const jobPatchSchema = jobSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.")

/**
 * PATCH /api/careers/admin/jobs/:id — edit a job or toggle is_active.
 * Jobs are deactivated rather than deleted so past applications keep their
 * link to the position.
 */
export const PATCH = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { admin, response } = await requireCareersAdmin()
  if (!admin) return response

  const rate = await checkRateLimit(`careers:admin:${admin.id}`, RATE_LIMITS.adminAction)
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many changes. Please slow down." }, { status: 429 })
  }

  const { id } = await context!.params
  if (!id || !isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const [data, validationError] = validateRequestBody(body, jobPatchSchema)
  if (validationError) return validationError

  const { data: row, error } = await createAdminClient()
    .from("careers_jobs")
    .update(jobInputToRow(data))
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[careers/admin] job update failed:", error.message)
    return NextResponse.json({ error: "Couldn't save the job. Please try again." }, { status: 500 })
  }
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 })

  await refreshPublicJobs(id)
  return NextResponse.json({ id })
})
