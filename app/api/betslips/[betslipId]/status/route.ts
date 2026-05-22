import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { handleConflict } from "@/lib/security/concurrency"

const VALID_STATUSES = ["Pending", "Won", "Lost", "Void", "Partial"] as const

const updateStatusSchema = z.object({
  status: z.enum(VALID_STATUSES),
})

export const PATCH = withSecurity(async (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { betslipId } = await context!.params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to update a betslip." },
      { status: 401 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, updateStatusSchema)
  if (validationError) return validationError

  // Fetch the betslip including current status for concurrency guard
  const { data: betslip, error: fetchErr } = await supabase
    .from("betslips")
    .select("id, user_id, odds, stake, status")
    .eq("id", betslipId)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: "Failed to fetch betslip." }, { status: 500 })
  }

  if (!betslip) {
    return NextResponse.json(
      { error: "Betslip not found." },
      { status: 404 }
    )
  }

  // Check ownership
  if (betslip.user_id !== user.id) {
    return NextResponse.json(
      { error: "You can only update your own betslips." },
      { status: 403 }
    )
  }

  // Build update payload
  const updatePayload: { status: string; payout?: number } = { status: data.status }

  // Compute payout if status is "Won" and stake is present
  if (data.status === "Won" && betslip.stake != null && betslip.stake > 0) {
    updatePayload.payout = Math.round(betslip.stake * betslip.odds * 100) / 100
  }

  // Update the betslip with current status as a condition (concurrency guard).
  // This ensures the update only succeeds if the status hasn't been changed
  // by a concurrent request since we read it.
  const { data: updated, error: updateErr, count } = await supabase
    .from("betslips")
    .update(updatePayload)
    .eq("id", betslipId)
    .eq("status", betslip.status)
    .select()

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update betslip." }, { status: 500 })
  }

  // Check if zero rows were affected (concurrent modification)
  const affectedRows = count ?? updated?.length ?? 0
  const conflictResponse = handleConflict(affectedRows, "betslip status")
  if (conflictResponse) return conflictResponse

  return NextResponse.json(updated?.[0] ?? null)
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
