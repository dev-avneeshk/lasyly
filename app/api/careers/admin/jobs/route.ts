import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { withSecurity, validateRequestBody } from "@/lib/security/routeHelpers"
import { requireCareersAdmin } from "@/lib/careers/adminAuth"
import { jobSchema } from "@/lib/careers/validation"
import { jobInputToRow, refreshPublicJobs } from "@/lib/careers/jobWrites"

/** POST /api/careers/admin/jobs — create a job listing. */
export const POST = withSecurity(async (request: Request) => {
  const { admin, response } = await requireCareersAdmin()
  if (!admin) return response

  const rate = await checkRateLimit(`careers:admin:${admin.id}`, RATE_LIMITS.adminAction)
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many changes. Please slow down." }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const [data, validationError] = validateRequestBody(body, jobSchema)
  if (validationError) return validationError

  const { data: row, error } = await createAdminClient()
    .from("careers_jobs")
    .insert(jobInputToRow(data))
    .select("id")
    .single()

  if (error) {
    console.error("[careers/admin] job create failed:", error.message)
    return NextResponse.json({ error: "Couldn't save the job. Please try again." }, { status: 500 })
  }

  await refreshPublicJobs(row.id)
  return NextResponse.json({ id: row.id }, { status: 201 })
})
