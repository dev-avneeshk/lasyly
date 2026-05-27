import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { getDashboard } from "@/lib/data/dashboard"
import { getDashboardParlays } from "@/lib/data/parlays"
import { computeParlayStats } from "@/lib/parlays/computations"
import { AuthGatePage } from "@/components/auth/AuthGate"
import DashboardClient from "./DashboardClient"

export const metadata: Metadata = {
  title: "Dashboard | Lasyly",
  robots: { index: false },
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AuthGatePage title="Sign in to view your dashboard" />
  }

  // Fetch dashboard data and parlay data in parallel
  const [dashboardResult, parlayResult] = await Promise.allSettled([
    getDashboard(user.id),
    getDashboardParlays(user.id),
  ])

  const dashboard =
    dashboardResult.status === "fulfilled"
      ? dashboardResult.value
      : { data: { total_income: 0, total_wagered: 0, win_rate: 0, average_odds: 0, total_picks_count: 0, won_count: 0, lost_count: 0, pending_count: 0 }, sports: [], funds: { income: [], spending: [] }, transactions: [] }

  const parlayData =
    parlayResult.status === "fulfilled"
      ? parlayResult.value
      : { parlays: [], stats: computeParlayStats([]) }

  return (
    <DashboardClient
      initialData={dashboard.data}
      initialSports={dashboard.sports}
      initialFunds={dashboard.funds}
      initialTransactions={dashboard.transactions}
      initialParlays={parlayData.parlays}
      initialParlayStats={parlayData.stats}
    />
  )
}
