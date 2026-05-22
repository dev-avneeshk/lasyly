import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const GET = withSecurity(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to view funds activity." },
      { status: 401 }
    )
  }

  const now = new Date()
  const days: { date: string; label: string }[] = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    const dateStr = d.toISOString().split("T")[0]
    const label = DAY_LABELS[d.getUTCDay()]
    days.push({ date: dateStr, label })
  }

  const startDate = days[0].date + "T00:00:00.000Z"

  const { data: transactions, error: txErr } = await supabase
    .from("transactions")
    .select("type, amount, created_at, status")
    .eq("user_id", user.id)
    .eq("status", "COMPLETED")
    .gte("created_at", startDate)
    .order("created_at", { ascending: true })

  if (txErr) {
    return NextResponse.json({ error: "Failed to fetch transactions." }, { status: 500 })
  }

  const incomeByDay: Record<string, number> = {}
  const spendingByDay: Record<string, number> = {}

  for (const day of days) {
    incomeByDay[day.date] = 0
    spendingByDay[day.date] = 0
  }

  for (const tx of transactions ?? []) {
    const txDate = tx.created_at.split("T")[0]

    if (tx.type === "TOP_UP" || tx.type === "EARNING") {
      incomeByDay[txDate] = (incomeByDay[txDate] ?? 0) + Math.abs(Number(tx.amount))
    } else if (tx.type === "PURCHASE") {
      spendingByDay[txDate] = (spendingByDay[txDate] ?? 0) + Math.abs(Number(tx.amount))
    }
  }

  const income = days.map((day) => ({
    day: day.label,
    amount: Math.round((incomeByDay[day.date] ?? 0) * 100) / 100,
  }))

  const spending = days.map((day) => ({
    day: day.label,
    amount: Math.round((spendingByDay[day.date] ?? 0) * 100) / 100,
  }))

  return NextResponse.json({ income, spending })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })
