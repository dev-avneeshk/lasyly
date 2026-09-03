import "server-only"
import { unstable_cache } from "next/cache"
import { getScoresForDate, getTodayYYYYMMDD, type ScoresResult } from "@/lib/data/scores"
import { getNews } from "@/lib/data/news"
import type { NewsItem } from "@/types/news"

/**
 * ISR-safe snapshot helpers for statically-generated marketing/app shells
 * (`/scores`, `/explore`).
 *
 * WHY THIS EXISTS
 * ---------------
 * The runtime data layer (`getScoresForDate`, `getNews`) reads through the
 * Upstash Redis cache-aside layer. The Upstash REST client issues its HTTP
 * calls with `cache: "no-store"` (see @upstash/redis). In the Next.js App
 * Router, a `no-store` fetch encountered while rendering a route forces that
 * ENTIRE route to be dynamically rendered on every request — silently
 * discarding the `export const revalidate` ISR window. That turned the
 * `/scores` and `/explore` shells into per-request renders (and per-request
 * cache writes), which is a primary driver of runaway Vercel ISR write usage.
 *
 * These wrappers run the same fetch inside an `unstable_cache` boundary. That
 * boundary (a) stops the inner `no-store` fetch from de-opting the page, so
 * the route can be statically generated and served from the ISR cache again,
 * and (b) memoizes the snapshot in the Data Cache with a revalidate window
 * that matches the page. The live `/api/scores` + `/api/explore` routes still
 * call the underlying data layer directly (Redis-hot, fully dynamic) and the
 * client components poll them for freshness — so nothing about the live
 * experience changes.
 *
 * Only the INITIAL server-rendered snapshot flows through here.
 */

// Snapshot revalidate windows (seconds). These match the page-level
// `export const revalidate` and are intentionally generous: the client
// components poll the live API for up-to-the-second data after hydration.
const SCORES_SNAPSHOT_REVALIDATE = 300
const NEWS_SNAPSHOT_REVALIDATE = 300

/**
 * Cached initial scores snapshot for today, keyed by UTC calendar date so a
 * new day naturally busts the entry.
 */
export async function getScoresSnapshot(): Promise<ScoresResult["data"]> {
  const today = getTodayYYYYMMDD()

  const load = unstable_cache(
    async (date: string) => {
      const result = await getScoresForDate(date)
      return result.data
    },
    ["isr-scores-snapshot"],
    { revalidate: SCORES_SNAPSHOT_REVALIDATE, tags: ["scores-snapshot"] }
  )

  return load(today)
}

/**
 * Cached top news article for the explore shell.
 */
export async function getTopNewsSnapshot(): Promise<NewsItem | null> {
  const load = unstable_cache(
    async () => {
      const news = await getNews(null)
      return news.items.length > 0 ? news.items[0] : null
    },
    ["isr-top-news-snapshot"],
    { revalidate: NEWS_SNAPSHOT_REVALIDATE, tags: ["news-snapshot"] }
  )

  return load()
}
