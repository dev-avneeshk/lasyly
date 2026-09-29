import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { withSecurity, validateRequestBody } from "@/lib/security/routeHelpers"
import { requireCareersAdmin } from "@/lib/careers/adminAuth"
import { statusUpdateSchema } from "@/lib/careers/validation"
import { isUuid } from "@/lib/careers/server"

/** PATCH /api/careers/admin/applications/:id — change an application's status. */
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
  const [data, validationError] = validateRequestBody(body, statusUpdateSchema)
  if (validationError) return validationError

  const { data: row, error } = await createAdminClient()
    .from("careers_applications")
    .update({ status: data.status })
    .eq("id", id)
    .select("status")
    .maybeSingle()

  if (error) {
    console.error("[careers/admin] status update failed:", error.message)
    return NextResponse.json({ error: "Couldn't update the status. Please try again." }, { status: 500 })
  }
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 })

  return NextResponse.json({ status: row.status })
})
