import { getScoresForDate, getTodayYYYYMMDD } from "@/lib/data/scores"
import { getNews } from "@/lib/data/news"
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
    canonical: "https://lasyly.com/explore",
  },
}

export const revalidate = 30

/**
 * Server component shell for /explore.
 *
 * Pre-fetches today's scores and the top news article on the server in
 * parallel and hands them to the client component as props. This means the
 * first HTML response already contains real match data and a real top-story
 * card; the client only does background polling and category swaps.
 */
export default async function ExplorePage() {
  // Kick off both requests in parallel.
  const today = getTodayYYYYMMDD()
  const [scoresResult, newsResult] = await Promise.allSettled([
    getScoresForDate(today),
    getNews(null),
  ])

  const initialScores = scoresResult.status === "fulfilled" ? scoresResult.value.data : []
  const initialArticle =
    newsResult.status === "fulfilled" && newsResult.value.items.length > 0
      ? newsResult.value.items[0]
      : null

  return <ExploreClient initialScores={initialScores} initialArticle={initialArticle} />
}
