import "server-only"

import { createClient } from "@/lib/supabase/server"
import { cached, CACHE_TTL } from "@/lib/cache"

/**
 * Dashboard data layer.
 *
 * Consolidates the four parallel fetches that the dashboard client currently
 * makes (`/api/dashboard`, `/api/dashboard/sports`, `/api/dashboard/funds`,
 * `/api/dashboard/transactions`) into a single server-side call so the page
 * can SSR with real data.
 */

export type DashboardData = {
  total_income: number
  total_wagered: number
  win_rate: number
  average_odds: number
  total_picks_count: number
  won_count: number
  lost_count: number
  pending_count: number
}

export type SportCategory = {
  category: string
  total_betslips: number
  win_rate: number
  profit_loss: number
}

export type FundsDay = { day: string; amount: number }

export type Transaction = {
  id: string
  type: string
  amount: number
  status: string
  created_at: string
  betslip?: { sportsbook: string; bet_type: string; odds: number } | null
}

export type DashboardResult = {
  data: DashboardData
  sports: SportCategory[]
  funds: { income: FundsDay[]; spending: FundsDay[] }
  transactions: Transaction[]
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function emptyFunds() {
  const now = new Date()
  const income = []
  const spending = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
    const label = DAY_LABELS[d.getUTCDay()]
    income.push({ day: label, amount: 0 })
    spending.push({ day: label, amount: 0 })
  }
  return { income, spending }
}

async function getMainStats(userId: string): Promise<DashboardData> {
  const supabase = await createClient()

  const [betslipResult, parlayResult, earningsResult] = await Promise.all([
    supabase.from("betslips").select("status, odds, stake").eq("user_id", userId),
    supabase.from("parlays").select("status, odds, stake").eq("user_id", userId).eq("is_logged", false),
    supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("type", "EARNING")
      .eq("status", "COMPLETED"),
  ])

  const allBetslips = betslipResult.data ?? []
  const allParlays = parlayResult.data ?? []

  // Betslip counts (legacy room-based bets)
  const bsTotal = allBetslips.length
  const bsWon = allBetslips.filter((b) => b.status === "Won").length
  const bsLost = allBetslips.filter((b) => b.status === "Lost").length
  const bsPending = allBetslips.filter((b) => b.status === "Pending").length
  const bsResolved = allBetslips.filter(
    (b) => b.status === "Won" || b.status === "Lost" || b.status === "Void"
  ).length

  // Parlay counts
  const pTotal = allParlays.length
  const pWon = allParlays.filter((p) => p.status === "won").length
  const pLost = allParlays.filter((p) => p.status === "lost").length
  const pPending = allParlays.filter((p) => p.status === "pending").length
  const pResolved = pWon + pLost

  // Combined totals
  const totalPicksCount = bsTotal + pTotal
  const wonCount = bsWon + pWon
  const lostCount = bsLost + pLost
  const pendingCount = bsPending + pPending
  const resolvedCount = bsResolved + pResolved

  let winRate = 0
  if (resolvedCount > 0) {
    winRate = Math.round((wonCount / resolvedCount) * 1000) / 10
  }

  // Average odds: combine betslips odds + parlay odds
  const bsOddsTotal = allBetslips.reduce((sum, b) => sum + Number(b.odds || 0), 0)
  const pOddsTotal = allParlays
    .filter((p) => p.odds != null)
    .reduce((sum, p) => sum + Number(p.odds), 0)
  const oddsCount = bsTotal + allParlays.filter((p) => p.odds != null).length

  let averageOdds = 0
  if (oddsCount > 0) {
    averageOdds = Math.round(((bsOddsTotal + pOddsTotal) / oddsCount) * 100) / 100
  }

  // Total wagered: betslip stakes + parlay stakes
  const bsWagered = allBetslips
    .filter((b) => b.stake != null)
    .reduce((sum, b) => sum + Number(b.stake), 0)
  const pWagered = allParlays
    .filter((p) => p.stake != null)
    .reduce((sum, p) => sum + Number(p.stake), 0)
  const totalWagered = bsWagered + pWagered

  // Total income from transactions + parlay winnings
  const txIncome = (earningsResult.data ?? []).reduce(
    (sum, t) => sum + Number(t.amount),
    0
  )
  // For parlays marked as won with stake and odds, calculate winnings
  const parlayWinnings = allParlays
    .filter((p) => p.status === "won" && p.stake != null && p.odds != null)
    .reduce((sum, p) => sum + (Number(p.stake) * Number(p.odds) - Number(p.stake)), 0)

  const totalIncome = txIncome + parlayWinnings

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
}

async function getSportBreakdown(userId: string): Promise<SportCategory[]> {
  const supabase = await createClient()

  // Fetch legacy betslips with room sport info
  const { data: betslips } = await supabase
    .from("betslips")
    .select("status, odds, stake, payout, room_id")
    .eq("user_id", userId)
    .not("room_id", "is", null)

  // Fetch parlays with their legs (which contain sport info) — exclude logged parlays
  const { data: parlays } = await supabase
    .from("parlays")
    .select("id, status, odds, stake, parlay_legs(sport)")
    .eq("user_id", userId)
    .eq("is_logged", false)

  const categoryMap: Record<
    string,
    {
      total: number
      won: number
      resolved: number
      profitLoss: number
    }
  > = {}

  // Process legacy betslips
  if (betslips && betslips.length > 0) {
    const roomIds = [...new Set(betslips.map((b) => b.room_id))]

    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, sport_tag")
      .in("id", roomIds)

    const roomSportMap: Record<string, string> = {}
    for (const room of rooms ?? []) {
      roomSportMap[room.id] = room.sport_tag ?? "Other"
    }

    for (const b of betslips) {
      const sport = roomSportMap[b.room_id] ?? "Other"

      if (!categoryMap[sport]) {
        categoryMap[sport] = { total: 0, won: 0, resolved: 0, profitLoss: 0 }
      }

      categoryMap[sport].total += 1

      const isResolved =
        b.status === "Won" || b.status === "Lost" || b.status === "Partial"

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
  }

  // Process parlays — determine sport from the most common leg sport
  if (parlays && parlays.length > 0) {
    for (const p of parlays) {
      const legs = (p.parlay_legs ?? []) as Array<{ sport: string }>
      if (legs.length === 0) continue

      // Determine primary sport from legs (most frequent)
      const sportCounts: Record<string, number> = {}
      for (const leg of legs) {
        const s = leg.sport || "Other"
        sportCounts[s] = (sportCounts[s] ?? 0) + 1
      }
      const sport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0][0]

      if (!categoryMap[sport]) {
        categoryMap[sport] = { total: 0, won: 0, resolved: 0, profitLoss: 0 }
      }

      categoryMap[sport].total += 1

      const isResolved = p.status === "won" || p.status === "lost"

      if (isResolved) {
        categoryMap[sport].resolved += 1

        if (p.status === "won") {
          categoryMap[sport].won += 1
        }

        // Calculate P/L for parlays
        if (p.stake != null && p.odds != null) {
          if (p.status === "won") {
            categoryMap[sport].profitLoss += Number(p.stake) * Number(p.odds) - Number(p.stake)
          } else {
            categoryMap[sport].profitLoss -= Number(p.stake)
          }
        }
      }
    }
  }

  if (Object.keys(categoryMap).length === 0) {
    return []
  }

  return Object.entries(categoryMap)
    .map(([name, data]) => ({
      category: name,
      total_betslips: data.total,
      win_rate:
        data.resolved > 0 ? Math.round((data.won / data.resolved) * 1000) / 10 : 0,
      profit_loss: Math.round(data.profitLoss * 100) / 100,
    }))
    .sort((a, b) => b.total_betslips - a.total_betslips)
    .slice(0, 5)
}

async function getFundsActivity(
  userId: string
): Promise<{ income: FundsDay[]; spending: FundsDay[] }> {
  const supabase = await createClient()

  const now = new Date()
  const days: { date: string; label: string }[] = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)
    )
    const dateStr = d.toISOString().split("T")[0]
    const label = DAY_LABELS[d.getUTCDay()]
    days.push({ date: dateStr, label })
  }

  const startDate = days[0].date + "T00:00:00.000Z"

  const { data: transactions } = await supabase
    .from("transactions")
    .select("type, amount, created_at, status")
    .eq("user_id", userId)
    .eq("status", "COMPLETED")
    .gte("created_at", startDate)
    .order("created_at", { ascending: true })

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
      spendingByDay[txDate] =
        (spendingByDay[txDate] ?? 0) + Math.abs(Number(tx.amount))
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

  return { income, spending }
}

async function getRecentTransactions(userId: string): Promise<Transaction[]> {
  const supabase = await createClient()

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, type, amount, status, created_at, reference_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)

  if (!transactions || transactions.length === 0) {
    return []
  }

  const referenceIds = transactions
    .filter(
      (t) => (t.type === "PURCHASE" || t.type === "EARNING") && t.reference_id
    )
    .map((t) => t.reference_id)

  const betslipMap: Record<
    string,
    { sportsbook: string; bet_type: string; odds: number } | null
  > = {}

  if (referenceIds.length > 0) {
    const { data: betslips } = await supabase
      .from("betslips")
      .select("id, sportsbook, bet_type, odds")
      .in("id", referenceIds)

    if (betslips) {
      for (const b of betslips) {
        betslipMap[b.id] = {
          sportsbook: b.sportsbook,
          bet_type: b.bet_type,
          odds: b.odds,
        }
      }
    }
  }

  return transactions.map((t) => {
    const base: Transaction = {
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
}

/**
 * Fetch all dashboard data in parallel. Wrapped in the in-memory cache so
 * concurrent server-side calls don't fan out to Supabase multiple times.
 */
export async function getDashboard(userId: string): Promise<DashboardResult> {
  return cached<DashboardResult>(
    `dashboard:${userId}`,
    async () => {
      const [data, sports, funds, transactions] = await Promise.all([
        getMainStats(userId),
        getSportBreakdown(userId),
        getFundsActivity(userId),
        getRecentTransactions(userId),
      ])

      return { data, sports, funds, transactions }
    },
    CACHE_TTL.dashboard
  )
}
