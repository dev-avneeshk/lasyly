import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * GET /api/wallet/balance
 *
 * Lightweight endpoint that returns only the current user's Coins balance,
 * for the header/nav balance pill. The full /api/wallet route also returns
 * paginated transactions; use this when only the number is needed.
 *
 * Balance is read via the SECURITY DEFINER RPC `get_my_wallet_balance`
 * because column-level privileges prevent the authenticated role from
 * selecting profiles.wallet_balance directly.
 */
export const GET = withSecurity(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to view your balance." },
      { status: 401 }
    )
  }

  const { data: balance, error } = await supabase.rpc("get_my_wallet_balance")

  if (error) {
    console.error("Wallet balance fetch error:", error.message)
    return NextResponse.json({ error: "Failed to fetch balance." }, { status: 500 })
  }

  return NextResponse.json({ balance: Number(balance ?? 0) })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
