import {
  getScoresSnapshot,
  getTopNewsSnapshot,
  getLeaderboardSnapshot,
  getFeedSnapshot,
} from "@/lib/data/page-snapshots"
import ExploreClient from "./ExploreClient"
import { SiteStructuredData } from "@/components/seo/SiteStructuredData"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Explore Prediction Rooms & Live Scores — Lasyly",
  description:
    "Discover public and expert prediction rooms by sport, browse live match cards, and find trending picks. The social hub for sports fans.",
  openGraph: {
    title: "Explore Prediction Rooms & Live Scores — Lasyly",
    description: "Discover public and expert prediction rooms, live match cards, and trending picks.",
  },
  alternates: {
    canonical: "/explore",
  },
}

// Render per request instead of as ISR (same reasoning as /scores). This is
// the site's most-requested route (`/` rewrites here) and its HTML embeds live
// scores, the top story, the leaderboard and the feed, so every timed ISR
// regeneration was a billed ISR write (~9-39 write units each). All four reads
// are Redis cache-aside (lib/data/page-snapshots.ts), so a dynamic render is a
// handful of Redis hits and writes nothing to the ISR cache. ExploreClient
// still polls for live updates after mount.
export const dynamic = "force-dynamic"

/**
 * Server component shell for /explore.
 *
 * Pre-fetches today's scores and the top news article on the server in
 * parallel and hands them to the client component as props. This means the
 * first HTML response already contains real match data and a real top-story
 * card; the client only does background polling and category swaps.
 */
export default async function ExplorePage() {
  // Redis cache-aside snapshots (see lib/data/page-snapshots.ts). Live updates
  // arrive via ExploreClient's client-side polling after hydration.
  const [scoresResult, newsResult, leaderboardResult, feedResult] = await Promise.allSettled([
    getScoresSnapshot(),
    getTopNewsSnapshot(),
    getLeaderboardSnapshot(),
    getFeedSnapshot(),
  ])

  const initialScores = scoresResult.status === "fulfilled" ? scoresResult.value : []
  const initialArticle = newsResult.status === "fulfilled" ? newsResult.value : null
  const initialLeaders = leaderboardResult.status === "fulfilled" ? leaderboardResult.value : []
  const initialFeed =
    feedResult.status === "fulfilled"
      ? feedResult.value
      : { posts: [], hasMore: false, nextCursor: null }

  return (
    <>
      {/* /explore is the canonical home (/ rewrites here), so the site-wide
          Organization/WebSite/ItemList structured data lives on this route. */}
      <SiteStructuredData />
      <ExploreClient
        initialScores={initialScores}
        initialArticle={initialArticle}
        initialLeaders={initialLeaders}
        initialFeed={initialFeed}
      />
    </>
  )
}
