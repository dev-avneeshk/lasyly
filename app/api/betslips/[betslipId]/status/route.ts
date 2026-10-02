import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { handleConflict } from "@/lib/security/concurrency"
import { rateLimited, RATE_LIMITS } from "@/lib/rateLimit"

// A betslip is graded once: Pending → one result. Re-grading let a tipster turn
// old losses into wins (and keep a Won payout after moving off Won), which feeds
// the paid-pick win rate.
const updateStatusSchema = z.object({
  status: z.enum(["Won", "Lost", "Void", "Partial"]),
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
  const limited = await rateLimited(`betslip-write:${user.id}`, RATE_LIMITS.feedWrite)
  if (limited) return limited

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

  if (betslip.status !== "Pending") {
    return NextResponse.json({ error: "This betslip has already been graded." }, { status: 409 })
  }

  // Build update payload
  const updatePayload: { status: string; payout?: number } = { status: data.status }

  // Compute payout if status is "Won" and stake is present
  if (data.status === "Won" && betslip.stake != null && betslip.stake > 0) {
    updatePayload.payout = Math.round(betslip.stake * betslip.odds * 100) / 100
  }

  // Service role: users have no UPDATE on betslips, so payout is always the
  // value computed here. Only while still Pending (a racing grade gets 409).
  const { data: updated, error: updateErr, count } = await createAdminClient()
    .from("betslips")
    .update(updatePayload)
    .eq("id", betslipId)
    .eq("user_id", user.id)
    .eq("status", "Pending")
    .select("id, user_id, odds, stake, payout, status")

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update betslip." }, { status: 500 })
  }

  // Check if zero rows were affected (concurrent modification)
  const affectedRows = count ?? updated?.length ?? 0
  const conflictResponse = handleConflict(affectedRows, "betslip status")
  if (conflictResponse) return conflictResponse

  return NextResponse.json(updated?.[0] ?? null)
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
