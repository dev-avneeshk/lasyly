import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { cached, CACHE_TTL } from "@/lib/cache"
import type { NewsItem } from "@/types/news"

/**
 * News data layer.
 *
 * Used by both `app/api/news/rss/route.ts` and the `(app)/news` server
 * component. DB-first (espn_news table populated by scrape workflow), with
 * a live ESPN fallback when the table is empty or queries fail.
 */

export type { NewsItem }

export const NEWS_CATEGORIES = ["Football", "NBA", "NFL", "UFC", "Tennis", "F1", "Cricket"] as const

const ESPN_FEEDS: { name: string; url: string; category: string }[] = [
  { name: "Premier League", url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?limit=15", category: "Football" },
  { name: "NBA", url: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=15", category: "NBA" },
  { name: "NFL", url: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=10", category: "NFL" },
  { name: "UFC", url: "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/news?limit=8", category: "UFC" },
  { name: "Tennis", url: "https://site.api.espn.com/apis/site/v2/sports/tennis/news?limit=8", category: "Tennis" },
  { name: "F1", url: "https://site.api.espn.com/apis/site/v2/sports/racing/f1/news?limit=8", category: "F1" },
  { name: "Cricket", url: "https://site.api.espn.com/apis/site/v2/sports/cricket/news?limit=8", category: "Cricket" },
]

interface ESPNArticle {
  id?: number
  headline?: string
  description?: string
  published?: string
  type?: string
  links?: { web?: { href?: string } }
  images?: { url?: string; width?: number }[]
}

export type NewsResult = {
  items: NewsItem[]
  categories: typeof NEWS_CATEGORIES
  fetchedAt: string
  source: "database" | "espn_api_fallback"
}

async function fetchFromDatabase(category: string | null): Promise<NewsItem[] | null> {
  try {
    const supabase = createAdminClient()
    let query = supabase
      .from("espn_news")
      .select("id, headline, description, published_at, source, category, image_url, link, linked_blog_slug")
      .order("published_at", { ascending: false })
      .limit(80)

    if (category) {
      query = query.eq("category", category)
    }

    const { data, error } = await query
    if (error || !data || data.length === 0) return null

    return data.map((row) => ({
      id: String(row.id),
      title: row.headline,
      link: row.link || "",
      description: row.description || "",
      pubDate: row.published_at,
      source: row.source,
      image: row.image_url,
      category: row.category,
      linkedBlogSlug: row.linked_blog_slug ?? null,
    }))
  } catch {
    return null
  }
}

async function fetchFromESPN(category: string | null): Promise<NewsItem[]> {
  const feedsToFetch = category
    ? ESPN_FEEDS.filter((f) => f.category.toLowerCase() === category.toLowerCase())
    : ESPN_FEEDS

  const results = await Promise.all(
    feedsToFetch.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "Lasyly/1.0" },
          next: { revalidate: 300 },
        })
        if (!res.ok) return [] as NewsItem[]
        const data = await res.json()
        return ((data.articles ?? []) as ESPNArticle[]).map((a) => {
          const images = a.images ?? []
          const sorted = [...images].sort((x, y) => (y.width ?? 0) - (x.width ?? 0))
          let imageUrl = sorted[0]?.url ?? null
          if (imageUrl) imageUrl = imageUrl.replace(/_\d+x\d+_\d+-\d+\./, "_1296x729_16-9.")
          return {
            id: String(a.id ?? ""),
            title: a.headline ?? "",
            link: a.links?.web?.href ?? "",
            description: a.description ?? "",
            pubDate: a.published ?? "",
            source: feed.name,
            image: imageUrl,
            category: feed.category,
          } as NewsItem
        }).filter((item) => item.title && item.link)
      } catch {
        return [] as NewsItem[]
      }
    })
  )

  return results
    .flat()
    .sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0
      return db - da
    })
    .slice(0, 80)
}

/**
 * Get news items, DB-first with live ESPN fallback. Wrapped in the in-memory
 * cache so concurrent server-side calls don't fan out to the same upstream.
 */
export async function getNews(category?: string | null): Promise<NewsResult> {
  const normalizedCategory = category ?? null
  const cacheKey = `news:${normalizedCategory ?? "all"}`

  return cached<NewsResult>(
    cacheKey,
    async () => {
      const dbItems = await fetchFromDatabase(normalizedCategory)
      if (dbItems && dbItems.length > 0) {
        return {
          items: dbItems,
          categories: NEWS_CATEGORIES,
          fetchedAt: new Date().toISOString(),
          source: "database",
        }
      }

      const espnItems = await fetchFromESPN(normalizedCategory)
      return {
        items: espnItems,
        categories: NEWS_CATEGORIES,
        fetchedAt: new Date().toISOString(),
        source: "espn_api_fallback",
      }
    },
    CACHE_TTL.explore
  )
}
