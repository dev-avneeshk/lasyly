import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cached, CACHE_TTL } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

export const GET = withSecurity(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to view dashboard data." },
      { status: 401 }
    )
  }

  const result = await cached(`dashboard:${user.id}`, async () => {
    const [betslipResult, earningsResult] = await Promise.all([
      supabase.from("betslips").select("status, odds, stake").eq("user_id", user.id),
      supabase.from("transactions").select("amount").eq("user_id", user.id).eq("type", "EARNING").eq("status", "COMPLETED"),
    ])

    const allBetslips = betslipResult.data ?? []
    const totalPicksCount = allBetslips.length

    const wonCount = allBetslips.filter((b) => b.status === "Won").length
    const lostCount = allBetslips.filter((b) => b.status === "Lost").length
    const pendingCount = allBetslips.filter((b) => b.status === "Pending").length

    const resolvedCount = allBetslips.filter(
      (b) => b.status === "Won" || b.status === "Lost" || b.status === "Void"
    ).length

    let winRate = 0
    if (resolvedCount > 0) {
      winRate = Math.round((wonCount / resolvedCount) * 1000) / 10
    }

    let averageOdds = 0
    if (totalPicksCount > 0) {
      const totalOdds = allBetslips.reduce((sum, b) => sum + Number(b.odds), 0)
      averageOdds = Math.round((totalOdds / totalPicksCount) * 100) / 100
    }

    const totalWagered = allBetslips
      .filter((b) => b.stake != null)
      .reduce((sum, b) => sum + Number(b.stake), 0)

    const totalIncome = (earningsResult.data ?? []).reduce((sum, t) => sum + Number(t.amount), 0)

    return {
      total_income: Math.round(totalIncome * 100) / 100,
      total_wagered: Math.round(totalWagered * 100) / 100,
      win_rate: winRate,
      average_odds: averageOdds,
      total_picks_count: totalPicksCount,
      won_count: wonCount,
      lost_count: lostCount,
      pending_count: pendingCount,
    }
  }, CACHE_TTL.dashboard)

  return NextResponse.json(result)
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
