import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

export const GET = withSecurity(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to view transactions." },
      { status: 401 }
    )
  }

  const { data: transactions, error: txErr } = await supabase
    .from("transactions")
    .select("id, type, amount, status, created_at, reference_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10)

  if (txErr) {
    return NextResponse.json({ error: "Failed to fetch transactions." }, { status: 500 })
  }

  if (!transactions || transactions.length === 0) {
    return NextResponse.json({ transactions: [] })
  }

  const referenceIds = transactions
    .filter((t) => (t.type === "PURCHASE" || t.type === "EARNING") && t.reference_id)
    .map((t) => t.reference_id)

  let betslipMap: Record<string, { sportsbook: string; bet_type: string; odds: number } | null> = {}

  if (referenceIds.length > 0) {
    const { data: betslips } = await supabase
      .from("betslips")
      .select("id, sportsbook, bet_type, odds")
      .in("id", referenceIds)

    if (betslips) {
      for (const b of betslips) {
        betslipMap[b.id] = { sportsbook: b.sportsbook, bet_type: b.bet_type, odds: b.odds }
      }
    }
  }

  const formattedTransactions = transactions.map((t) => {
    const base: Record<string, unknown> = {
      id: t.id,
      type: t.type,
      amount: t.amount,
      status: t.status,
      created_at: t.created_at,
    }

    if ((t.type === "PURCHASE" || t.type === "EARNING") && t.reference_id) {
      base.betslip = betslipMap[t.reference_id] ?? null
    }

    return base
  })

  return NextResponse.json({ transactions: formattedTransactions })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
