import { getScoresSnapshot, getTopNewsSnapshot } from "@/lib/data/isr-snapshots"
import ExploreClient from "./ExploreClient"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Explore Betting Rooms & Live Scores — Lasyly",
  description:
    "Discover public and tipster betting rooms by sport, browse live match cards, and find trending picks. The social hub for sports bettors.",
  openGraph: {
    title: "Explore Betting Rooms & Live Scores — Lasyly",
    description: "Discover public and tipster betting rooms, live match cards, and trending picks.",
  },
  alternates: {
    canonical: "https://lasyly.me/explore",
  },
}

// Only the initial server snapshot needs this; ExploreClient polls for live
// score/news updates on the client after mount. A 30s ISR window regenerated
// the shell far more often than the data meaningfully changed, so relax it to
// 5 minutes to cut ISR writes without affecting perceived freshness.
export const revalidate = 300

/**
 * Server component shell for /explore.
 *
 * Pre-fetches today's scores and the top news article on the server in
 * parallel and hands them to the client component as props. This means the
 * first HTML response already contains real match data and a real top-story
 * card; the client only does background polling and category swaps.
 */
export default async function ExplorePage() {
  // ISR-safe snapshots (see lib/data/isr-snapshots.ts): both reads go through
  // an unstable_cache boundary so the Redis-backed data layer's no-store fetch
  // doesn't force this page to render dynamically on every request. Live
  // updates arrive via ExploreClient's client-side polling after hydration.
  const [scoresResult, newsResult] = await Promise.allSettled([
    getScoresSnapshot(),
    getTopNewsSnapshot(),
  ])

  const initialScores = scoresResult.status === "fulfilled" ? scoresResult.value : []
  const initialArticle = newsResult.status === "fulfilled" ? newsResult.value : null

  return <ExploreClient initialScores={initialScores} initialArticle={initialArticle} />
}
