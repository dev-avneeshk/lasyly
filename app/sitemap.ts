import type { MetadataRoute } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAllPlayerSlugs } from "@/lib/data/public-players"
import { SPORT_SLUG_MAP } from "@/lib/seo/player-slug"

export const revalidate = 3600 // regenerate sitemap every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"

  // Fetch all published blog posts from DB for dynamic sitemap entries
  const supabase = createAdminClient()
  const { data: blogPosts } = await supabase
    .from("blog_posts")
    .select("slug, published_at, updated_at")
    .eq("published", true)
    .order("published_at", { ascending: false })

  const blogEntries: MetadataRoute.Sitemap = (blogPosts ?? []).map(
    (post: { slug: string; published_at: string; updated_at: string }) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updated_at || post.published_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })
  )

  // Static blog posts that live as individual page files (not in DB)
  const staticBlogSlugs = [
    { slug: "why-share-your-betslip", date: "2026-05-24" },
    { slug: "how-to-read-prop-analytics", date: "2026-05-22" },
    { slug: "nba-player-props-guide", date: "2026-05-20" },
  ]

  // Deduplicate: if a static slug also exists in DB, skip the static entry
  const dbSlugs = new Set((blogPosts ?? []).map((p: { slug: string }) => p.slug))
  const staticBlogEntries: MetadataRoute.Sitemap = staticBlogSlugs
    .filter((s) => !dbSlugs.has(s.slug))
    .map((s) => ({
      url: `${baseUrl}/blog/${s.slug}`,
      lastModified: new Date(s.date),
      changeFrequency: "monthly" as const,
      priority: 0.75,
    }))

  // Fetch dynamic player entries for sitemap (wrapped in try/catch for DB resilience)
  let playerEntries: MetadataRoute.Sitemap = []
  try {
    const playerSlugs = await getAllPlayerSlugs()
    playerEntries = playerSlugs.map((player) => ({
      url: `${baseUrl}/players/${player.slug}`,
      lastModified: new Date(player.lastGameDate),
      changeFrequency: "daily" as const,
      priority: 0.7,
    }))
  } catch (error) {
    console.error("[sitemap] Failed to fetch player slugs, serving static entries only:", error)
  }

  // Today's props entry
  const propsEntry: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/props/today`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
  ]

  // Sport scores entries (all 12 supported sports)
  const sportScoresEntries: MetadataRoute.Sitemap = Object.keys(SPORT_SLUG_MAP).map(
    (sportSlug) => ({
      url: `${baseUrl}/scores/${sportSlug}`,
      lastModified: new Date(),
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })
  )

  return [
    // Core app
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/scores`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    // Marketing / SEO pages
    {
      url: `${baseUrl}/features`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tipsters`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    // Blog index
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.85,
    },
    // All blog posts (dynamic from DB + static fallbacks)
    ...blogEntries,
    ...staticBlogEntries,
    // Public SEO pages: player analysis
    ...playerEntries,
    // Public SEO pages: today's props
    ...propsEntry,
    // Public SEO pages: sport scores
    ...sportScoresEntries,
    // Auth
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // Legal
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}
