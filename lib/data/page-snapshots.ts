import "server-only"
import { cached, CACHE_TTL } from "@/lib/cache"
import { getScoresForDate, getTodayYYYYMMDD, type ScoresResult } from "@/lib/data/scores"
import { getNews } from "@/lib/data/news"
import { getLeaderboard } from "@/lib/data/leaderboard"
import { createAdminClient } from "@/lib/supabase/admin"
import type { NewsItem } from "@/types/news"

/**
 * Initial server-rendered data for the `/scores` and `/explore` shells.
 *
 * Both routes render dynamically (`force-dynamic`) instead of as ISR. Their
 * HTML embeds live scores, so every timed ISR regeneration produced new
 * output and was billed as Vercel ISR writes (each one ~8-50 write units,
 * up to 96/day per route even at a 900 s window). A dynamic render writes
 * nothing to the ISR cache.
 *
 * To keep each request cheap, every read here goes through the Redis
 * cache-aside layer (`cached()` in lib/cache.ts: Redis, then DB, then
 * populate with a TTL). `getNews` and `getLeaderboard` already cache
 * themselves; the scores and feed reads get their own keys below. The
 * snapshots used to sit behind `unstable_cache` with a 900 s window, which
 * only existed to stop the Upstash `no-store` fetch from de-opting the old
 * force-static routes. That is no longer needed, and dropping it also stops
 * the Data Cache writes.
 *
 * The client components still poll the live APIs after hydration.
 */

/** Today's scores, keyed by UTC date. Shares the 10 s live-scores TTL. */
export async function getScoresSnapshot(): Promise<ScoresResult["data"]> {
  const today = getTodayYYYYMMDD()
  return cached(
    `scores:snapshot:${today}`,
    async () => (await getScoresForDate(today)).data,
    CACHE_TTL.scores
  )
}

/** Top news article for the explore shell (getNews is Redis-cached). */
export async function getTopNewsSnapshot(): Promise<NewsItem | null> {
  const news = await getNews(null)
  return news.items.length > 0 ? news.items[0] : null
}

// ─── Explore above-the-fold snapshots ───────────────────────────────────────
//
// The leaderboard sidebar and the community feed are the largest above-the-fold
// elements on /explore, and they used to render as empty skeletons in the SSR
// HTML and only populate after the client hydrated and fetched
// /api/leaderboard + /api/feed/posts. That made the LCP element appear a full
// round-trip after hydration. Pre-rendering both on the server puts real
// content in the first HTML response.

export type LeaderboardSnapshotEntry = {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  win_rate: number
  total_picks: number
}

/**
 * Top-5 win-rate leaderboard for the explore sidebar: the /api/leaderboard
 * result trimmed to the fields MiniLeaderboard renders.
 */
export async function getLeaderboardSnapshot(): Promise<LeaderboardSnapshotEntry[]> {
  // getLeaderboard is already Redis cache-aside (`leaderboard:win_rate`).
  return (await getLeaderboard("win_rate")).leaderboard
    .slice(0, 5)
    .map(({ user_id, username, display_name, avatar_url, win_rate, total_picks }) => ({
      user_id, username, display_name, avatar_url, win_rate, total_picks,
    }))
}

const FEED_SNAPSHOT_PAGE_SIZE = 10

export type FeedSnapshotPost = {
  id: string
  user_id: string
  content: string | null
  image_url: string | null
  parlay_id: string | null
  like_count: number
  comment_count: number
  created_at: string
  profile: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  } | null
  parlay: {
    id: string
    status: string
    odds: number | null
    created_at: string
    legs: Array<{
      id: string
      player_name: string
      stat_category: string
      prop_line: number
      direction: string
      l10_hit_rate: number | null
    }>
  } | null
  liked_by_me: boolean
}

export type FeedSnapshot = {
  posts: FeedSnapshotPost[]
  hasMore: boolean
  nextCursor: string | null
}

/**
 * First page of the community feed for the explore SSR shell. Deliberately
 * omits per-user "liked_by_me" state (always false here) so the read stays
 * user-agnostic and one Redis entry serves every visitor. The client refreshes
 * with real like state after hydration.
 */
export async function getFeedSnapshot(): Promise<FeedSnapshot> {
  return cached(
    "explore:feed-snapshot",
    async (): Promise<FeedSnapshot> => {
      const supabase = createAdminClient()

      const { data: posts, error } = await supabase
        .from("posts")
        .select("id, user_id, content, image_url, parlay_id, like_count, comment_count, created_at")
        .order("created_at", { ascending: false })
        .limit(FEED_SNAPSHOT_PAGE_SIZE + 1)

      if (error || !posts || posts.length === 0) {
        return { posts: [], hasMore: false, nextCursor: null }
      }

      const hasMore = posts.length > FEED_SNAPSHOT_PAGE_SIZE
      const results = hasMore ? posts.slice(0, FEED_SNAPSHOT_PAGE_SIZE) : posts

      const userIds = [...new Set(results.map((p) => p.user_id))]
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds)
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

      const parlayIds = results.filter((p) => p.parlay_id).map((p) => p.parlay_id!)
      const parlayMap = new Map<string, FeedSnapshotPost["parlay"]>()
      if (parlayIds.length > 0) {
        const { data: parlays } = await supabase
          .from("parlays")
          .select(`
            id, status, odds, created_at,
            legs:parlay_legs(id, player_name, stat_category, prop_line, direction, l10_hit_rate)
          `)
          .in("id", parlayIds)
        for (const p of parlays ?? []) {
          parlayMap.set(p.id, p as unknown as FeedSnapshotPost["parlay"])
        }
      }

      const enriched: FeedSnapshotPost[] = results.map((post) => ({
        ...post,
        profile: profileMap.get(post.user_id) ?? null,
        parlay: post.parlay_id ? parlayMap.get(post.parlay_id) ?? null : null,
        liked_by_me: false,
      }))

      return {
        posts: enriched,
        hasMore,
        nextCursor: hasMore ? results[results.length - 1].created_at : null,
      }
    },
    CACHE_TTL.feed
  )
}
