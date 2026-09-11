import { getTodayYYYYMMDD } from "@/lib/data/scores"
import { getScoresSnapshot } from "@/lib/data/isr-snapshots"
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
    canonical: "https://lasyly.me/scores",
  },
}

// This server component only provides the initial server-rendered snapshot;
// live freshness is handled entirely by ScoresClient, which polls the
// CDN-cached /api/scores endpoint every ~15s on the client. A 10s ISR window
// forced the shell HTML to regenerate constantly for data the client already
// refreshes, so we relax it to 5 minutes. The initial paint is still recent
// and the client hydrates fresh scores immediately after mount.
export const revalidate = 300

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
  let initialScores: Awaited<ReturnType<typeof getScoresSnapshot>> = []

  try {
    // ISR-safe snapshot (see lib/data/isr-snapshots.ts): reads through an
    // unstable_cache boundary so the Redis-backed data layer's no-store fetch
    // doesn't force this page to render dynamically on every request.
    initialScores = await getScoresSnapshot()
  } catch {
    // If the data layer fails on the server, render with an empty list and
    // let the client component refetch on mount.
    initialScores = []
  }

  return <ScoresClient initialDate={initialDate} initialScores={initialScores} />
}
