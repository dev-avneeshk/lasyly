import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getDashboard, emptyFunds } from "@/lib/data/dashboard"
import DashboardClient from "./DashboardClient"

// Dashboard is per-user and depends on cookies, so we render it dynamically.
// The data layer itself has an in-memory cache (CACHE_TTL.dashboard = 120s)
// keyed by user id, so repeat visits stay cheap.
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Server component shell for /dashboard.
 *
 * Replaces the previous client-side `useEffect` fan-out (4 parallel API
 * fetches) with a single SSR call to the shared data layer. The page now
 * paints with real numbers, charts, and transactions on first response —
 * no skeleton flash, no waterfall.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  let result
  try {
    result = await getDashboard(user.id)
  } catch (err) {
    console.error("[dashboard] getDashboard failed:", err)
    result = {
      data: {
        total_income: 0,
        total_wagered: 0,
        win_rate: 0,
        average_odds: 0,
        total_picks_count: 0,
        won_count: 0,
        lost_count: 0,
        pending_count: 0,
      },
      sports: [],
      funds: emptyFunds(),
      transactions: [],
    }
  }

  return (
    <DashboardClient
      initialData={result.data}
      initialSports={result.sports}
      initialFunds={result.funds}
      initialTransactions={result.transactions}
    />
  )
}
