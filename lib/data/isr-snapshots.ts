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

// ─── Explore above-the-fold snapshots ───────────────────────────────────────
//
// The leaderboard sidebar and the community feed are the largest above-the-fold
// elements on /explore, and they used to render as empty skeletons in the SSR
// HTML and only populate after the client hydrated and fetched
// /api/leaderboard + /api/feed/posts. That made the LCP element appear a full
// round-trip after hydration. Pre-rendering both on the server puts real
// content in the first HTML response.
//
// Both go through unstable_cache for the same reason as the scores/news
// snapshots above: the underlying reads touch the no-store Upstash layer, which
// would otherwise de-opt the force-static /explore route to per-request
// rendering. The client components still poll/refresh after hydration, so
// freshness is unchanged; only the initial paint improves.

import { createAdminClient } from "@/lib/supabase/admin"

const LEADERBOARD_SNAPSHOT_REVALIDATE = 300
const FEED_SNAPSHOT_REVALIDATE = 30

export type LeaderboardSnapshotEntry = {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  win_rate: number
  total_picks: number
}

/**
 * Top-5 win-rate leaderboard for the explore sidebar. Mirrors the aggregation
 * in /api/leaderboard but returns only the five fields MiniLeaderboard renders.
 */
export async function getLeaderboardSnapshot(): Promise<LeaderboardSnapshotEntry[]> {
  const load = unstable_cache(
    async () => {
      const supabase = createAdminClient()

      const { data: parlays, error } = await supabase
        .from("parlays")
        .select("user_id, status")
        .in("status", ["won", "lost", "pending"])

      if (error || !parlays || parlays.length === 0) return []

      const userStats = new Map<string, { total: number; won: number; totalPicks: number }>()
      for (const parlay of parlays) {
        if (!parlay.user_id) continue
        const s = userStats.get(parlay.user_id) || { total: 0, won: 0, totalPicks: 0 }
        s.totalPicks += 1
        if (parlay.status === "won" || parlay.status === "lost") {
          s.total += 1
          if (parlay.status === "won") s.won += 1
        }
        userStats.set(parlay.user_id, s)
      }

      const qualified = Array.from(userStats.entries())
        .filter(([, s]) => s.total >= 10)
        .map(([userId]) => userId)

      if (qualified.length === 0) return []

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", qualified)

      if (!profiles) return []

      return profiles
        .map((p) => {
          const s = userStats.get(p.id)!
          return {
            user_id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            win_rate: s.total > 0 ? Math.round((s.won / s.total) * 1000) / 10 : 0,
            total_picks: s.totalPicks,
          }
        })
        .sort((a, b) => b.win_rate - a.win_rate)
        .slice(0, 5)
    },
    ["isr-leaderboard-snapshot"],
    { revalidate: LEADERBOARD_SNAPSHOT_REVALIDATE, tags: ["leaderboard-snapshot"] }
  )

  return load()
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
 * user-agnostic and the page remains static/CDN-cacheable — the client
 * refreshes with real like state after hydration.
 */
export async function getFeedSnapshot(): Promise<FeedSnapshot> {
  const load = unstable_cache(
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
    ["isr-feed-snapshot"],
    { revalidate: FEED_SNAPSHOT_REVALIDATE, tags: ["feed-snapshot"] }
  )

  return load()
}
