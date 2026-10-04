import { getTodayYYYYMMDD } from "@/lib/data/scores"
import { getScoresSnapshot } from "@/lib/data/page-snapshots"
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
    canonical: "/scores",
  },
}

// Render per request instead of as ISR. The HTML embeds today's scores, so
// every timed ISR regeneration produced new output and was billed as ISR
// writes (~8-51 write units each). A dynamic render writes nothing to the ISR
// cache. The snapshot read is Redis cache-aside with the 10 s live-scores TTL
// (lib/data/page-snapshots.ts), so each request is a Redis hit and the first
// paint is fresher than the old 15-minute ISR shell. ScoresClient still polls
// /api/scores after hydration.
export const dynamic = "force-dynamic"

/**
 * Server component shell for /scores.
 *
 * Fetches today's matches directly from the data layer (no /api/scores
 * round-trip) and ships them as HTML in the very first response, so the
 * browser paints real match cards immediately. The interactive bits
 * (sport tabs, date picker, voting, polling) live in `ScoresClient`.
 */
export default async function ScoresPage() {
  const initialDate = getTodayYYYYMMDD()
  let initialScores: Awaited<ReturnType<typeof getScoresSnapshot>> = []

  try {
    // Redis cache-aside snapshot (see lib/data/page-snapshots.ts).
    initialScores = await getScoresSnapshot()
  } catch {
    // If the data layer fails on the server, render with an empty list and
    // let the client component refetch on mount.
    initialScores = []
  }

  return <ScoresClient initialDate={initialDate} initialScores={initialScores} />
}
