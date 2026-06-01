import type { Metadata } from "next"
import LeaderboardClient from "./LeaderboardClient"

export const metadata: Metadata = {
  title: "Leaderboard | Lasyly",
  description: "See the top bettors on Lasyly ranked by win rate, total picks, and streaks.",
}

export default function LeaderboardPage() {
  return <LeaderboardClient />
}
