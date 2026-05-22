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
      { error: "You must be logged in to view sport breakdown." },
      { status: 401 }
    )
  }

  const { data: betslips, error: betslipErr } = await supabase
    .from("betslips")
    .select("status, odds, stake, payout, room_id")
    .eq("user_id", user.id)
    .not("room_id", "is", null)

  if (betslipErr) {
    return NextResponse.json({ error: "Failed to fetch betslips." }, { status: 500 })
  }

  if (!betslips || betslips.length === 0) {
    return NextResponse.json({ categories: [] })
  }

  const roomIds = [...new Set(betslips.map((b) => b.room_id))]

  const { data: rooms, error: roomErr } = await supabase
    .from("rooms")
    .select("id, sport_tag")
    .in("id", roomIds)

  if (roomErr) {
    return NextResponse.json({ error: "Failed to fetch rooms." }, { status: 500 })
  }

  const roomSportMap: Record<string, string> = {}
  for (const room of rooms ?? []) {
    roomSportMap[room.id] = room.sport_tag ?? "Other"
  }

  const categoryMap: Record<string, {
    total: number
    won: number
    resolved: number
    profitLoss: number
  }> = {}

  for (const b of betslips) {
    const sport = roomSportMap[b.room_id] ?? "Other"

    if (!categoryMap[sport]) {
      categoryMap[sport] = { total: 0, won: 0, resolved: 0, profitLoss: 0 }
    }

    categoryMap[sport].total += 1

    const isResolved = b.status === "Won" || b.status === "Lost" || b.status === "Partial"

    if (isResolved) {
      categoryMap[sport].resolved += 1

      if (b.status === "Won") {
        categoryMap[sport].won += 1
      }

      if (b.stake != null && b.payout != null) {
        categoryMap[sport].profitLoss += Number(b.payout) - Number(b.stake)
      }
    }
  }

  const categories = Object.entries(categoryMap)
    .map(([name, data]) => ({
      category: name,
      total_betslips: data.total,
      win_rate: data.resolved > 0
        ? Math.round((data.won / data.resolved) * 1000) / 10
        : 0,
      profit_loss: Math.round(data.profitLoss * 100) / 100,
    }))
    .sort((a, b) => b.total_betslips - a.total_betslips)
    .slice(0, 5)

  return NextResponse.json({ categories })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
