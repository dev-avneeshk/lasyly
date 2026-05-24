import { getScoresForDate, getTodayYYYYMMDD } from "@/lib/data/scores"
import ScoresClient from "./ScoresClient"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Live Sports Scores — Lasyly",
  description:
    "Real-time live scores across 10+ sports — NBA, NFL, Premier League, Champions League, NHL, MLB, ATP, WTA, UFC, Formula 1, and more. Updated every 10 seconds.",
  openGraph: {
    title: "Live Sports Scores — Lasyly",
    description: "Real-time scores across NFL, NBA, soccer, tennis, hockey, baseball, F1, MMA, golf, and cricket.",
  },
  alternates: {
    canonical: "https://lasyly.com/scores",
  },
}

// Re-render at most every 10s; matches the in-memory cache TTL for live data.
export const revalidate = 10

/**
 * Server component shell for /scores.
 *
 * Fetches today's matches directly from the data layer (no /api/scores
 * round-trip) and ships them as HTML in the very first response, so the
 * browser paints real match cards immediately. The interactive bits
 * (sport tabs, date picker, voting, 15s polling) live in `ScoresClient`.
 */
export default async function ScoresPage() {
  const initialDate = getTodayYYYYMMDD()
  let initialScores: Awaited<ReturnType<typeof getScoresForDate>>["data"] = []

  try {
    const result = await getScoresForDate(initialDate)
    initialScores = result.data
  } catch {
    // If the data layer fails on the server, render with an empty list and
    // let the client component refetch on mount.
    initialScores = []
  }

  return <ScoresClient initialDate={initialDate} initialScores={initialScores} />
}
