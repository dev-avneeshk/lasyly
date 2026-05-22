import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit"
import { withSecurity, validateRequestBody, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const unlockSchema = z.object({
  betslipId: z.string().uuid(),
  tipsterId: z.string().uuid(),
})

/**
 * POST /api/picks/unlock
 *
 * Atomically purchases a tipster's pick. All wallet movement happens
 * inside the `purchase_pick` SECURITY DEFINER Postgres function which
 * locks both buyer and tipster rows, verifies all preconditions, and
 * writes the ledger entries in a single transaction. This route only
 * authenticates the caller and translates RPC return codes into HTTP
 * status codes.
 */
export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to unlock picks." },
      { status: 401 }
    )
  }

  // Rate limit wallet operations.
  const rateCheck = checkRateLimit(`wallet:${user.id}`, RATE_LIMITS.wallet)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many wallet operations. Please wait a moment." },
      { status: 429 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, unlockSchema)
  if (validationError) return validationError

  // Always pass auth.uid() as the buyer — never trust client-supplied buyer ids.
  const { data: outcome, error: rpcError } = await supabase.rpc("purchase_pick", {
    p_buyer_id: user.id,
    p_betslip_id: data.betslipId,
    p_tipster_id: data.tipsterId,
  })

  if (rpcError) {
    console.error("purchase_pick RPC error:", rpcError.message)
    return NextResponse.json(
      { error: "Failed to process purchase." },
      { status: 500 }
    )
  }

  switch (outcome) {
    case "completed":
      return NextResponse.json({ success: true })
    case "self_purchase":
      return NextResponse.json(
        { error: "You cannot purchase your own pick." },
        { status: 400 }
      )
    case "not_for_sale":
      return NextResponse.json(
        { error: "Betslip not found or is not available for purchase." },
        { status: 404 }
      )
    case "invalid_tipster":
      return NextResponse.json(
        { error: "Invalid tipster for this betslip." },
        { status: 403 }
      )
    case "invalid_price":
      return NextResponse.json(
        { error: "This betslip does not have a valid price." },
        { status: 400 }
      )
    case "already_unlocked":
      return NextResponse.json(
        { error: "You have already unlocked this pick." },
        { status: 409 }
      )
    case "insufficient_funds":
      return NextResponse.json(
        { error: "Insufficient funds for this purchase." },
        { status: 402 }
      )
    default:
      console.error("purchase_pick returned unexpected outcome:", outcome)
      return NextResponse.json(
        { error: "Failed to process purchase." },
        { status: 500 }
      )
  }
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
