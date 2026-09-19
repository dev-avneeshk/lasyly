import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { levelProgress } from "@/lib/economy/arena"

/**
 * GET /api/wallet/balance
 *
 * Lightweight endpoint that returns the current user's Coins balance plus their
 * level/XP progression, for the header/nav pill and the level badge. The full
 * /api/wallet route also returns paginated transactions; use this when only the
 * summary is needed.
 *
 * Balance is read via the SECURITY DEFINER RPC `get_my_wallet_balance` and
 * level/XP via `get_my_level`, because column-level privileges prevent the
 * authenticated role from selecting the sensitive columns directly.
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

  const [balanceRes, levelRes] = await Promise.all([
    supabase.rpc("get_my_wallet_balance"),
    supabase.rpc("get_my_level"),
  ])

  if (balanceRes.error) {
    console.error("Wallet balance fetch error:", balanceRes.error.message)
    return NextResponse.json({ error: "Failed to fetch balance." }, { status: 500 })
  }

  // get_my_level returns a single row {level, xp}; tolerate it being absent
  // (brand-new profile mid-provision) by falling back to level 1 / 0 XP.
  const row = Array.isArray(levelRes.data) ? levelRes.data[0] : levelRes.data
  const xp = Number(row?.xp ?? 0)
  const progress = levelProgress(xp)

  return NextResponse.json({
    balance: Number(balanceRes.data ?? 0),
    level: Number(row?.level ?? progress.level),
    xp,
    xp_into_level: progress.xpIntoLevel,
    xp_for_next_level: progress.xpForNextLevel,
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
