import type { Metadata } from "next"
import LeaderboardClient from "./LeaderboardClient"

export const metadata: Metadata = {
  title: "Leaderboard | Lasyly",
  description: "See the top predictors on Lasyly ranked by hit rate, total picks, and streaks.",
}

export default function LeaderboardPage() {
  return <LeaderboardClient />
}
