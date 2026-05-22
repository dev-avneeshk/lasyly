import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

export const GET = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to view wallet data." },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor")
  const pageSizeParam = searchParams.get("page_size")

  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(pageSizeParam ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )

  // Fetch wallet balance via SECURITY DEFINER RPC (column-level revoke
  // prevents direct SELECT on profiles.wallet_balance from the
  // authenticated role).
  const { data: walletBalance, error: profileErr } = await supabase.rpc(
    "get_my_wallet_balance"
  )

  if (profileErr) {
    console.error("Wallet balance fetch error:", profileErr.message)
    return NextResponse.json({ error: "Failed to fetch wallet data." }, { status: 500 })
  }

  // Fetch transactions with cursor-based pagination
  let txQuery = supabase
    .from("transactions")
    .select("id, type, amount, status, created_at, reference_id, stripe_session_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(pageSize + 1)

  if (cursor) {
    const cursorDate = new Date(cursor)
    if (!isNaN(cursorDate.getTime())) {
      txQuery = txQuery.lt("created_at", cursor)
    }
  }

  const { data: rawTransactions, error: txErr } = await txQuery

  if (txErr) {
    console.error("Wallet transactions fetch error:", txErr.message)
    return NextResponse.json({ error: "Failed to fetch transactions." }, { status: 500 })
  }

  const allResults = rawTransactions ?? []
  const hasMore = allResults.length > pageSize
  const transactions = hasMore ? allResults.slice(0, pageSize) : allResults
  const nextCursor = hasMore ? transactions[transactions.length - 1]?.created_at ?? null : null

  // For transactions with reference_id, fetch associated betslip info
  const referenceIds = transactions
    .filter((t) => t.reference_id)
    .map((t) => t.reference_id)

  const betslipMap: Record<string, { sportsbook: string; bet_type: string; odds: number } | null> = {}

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

  // Format transactions
  const formattedTransactions = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    status: t.status,
    created_at: t.created_at,
    reference_id: t.reference_id,
    betslip: t.reference_id ? (betslipMap[t.reference_id] ?? null) : null,
  }))

  return NextResponse.json({
    wallet_balance: Number(walletBalance ?? 0),
    transactions: formattedTransactions,
    pagination: {
      next_cursor: nextCursor,
      has_more: hasMore,
      page_size: pageSize,
    },
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
