import type { MetadataRoute } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAllPlayerSlugs } from "@/lib/data/public-players"
import { SPORT_SLUG_MAP } from "@/lib/seo/player-slug"
import { getAllComparisonSlugs } from "@/lib/data/comparisons"
import { SITE_URL } from "@/lib/seo/site"

export const revalidate = 3600 // regenerate sitemap every hour
// The player index is read through Upstash Redis, whose client fetches with
// `cache: "no-store"`; without this the route bails to per-request rendering.
// Nothing here reads cookies or headers, so forcing static keeps hourly ISR.
export const dynamic = "force-static"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL
  // Midnight UTC of the current day, not `new Date()`. A per-render timestamp
  // made every hourly regeneration produce new output, and Vercel bills ISR
  // writes only when the output changes. With a day-stable value the sitemap
  // changes at most once a day plus whenever the underlying data changes.
  const today = new Date(new Date().toISOString().slice(0, 10))

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
      lastModified: today,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
  ]

  // Sport scores entries (all 12 supported sports)
  const sportScoresEntries: MetadataRoute.Sitemap = Object.keys(SPORT_SLUG_MAP).map(
    (sportSlug) => ({
      url: `${baseUrl}/scores/${sportSlug}`,
      lastModified: today,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })
  )

  // Comparison pages (Lasyly vs X)
  const comparisonSlugs = getAllComparisonSlugs()
  const comparisonEntries: MetadataRoute.Sitemap = comparisonSlugs.map((slug) => ({
    url: `${baseUrl}/compare/${slug}`,
    lastModified: today,
    changeFrequency: "monthly" as const,
    priority: 0.85,
  }))

  return [
    // Core app. The bare root (/) 308-redirects to /explore, so it is
    // intentionally omitted here — listing a permanently-redirecting URL in the
    // sitemap is an error Google Search Console flags. /explore is the home.
    {
      url: `${baseUrl}/explore`,
      lastModified: today,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/scores`,
      lastModified: today,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: today,
      changeFrequency: "daily",
      priority: 0.7,
    },
    // Marketing / SEO pages
    {
      url: `${baseUrl}/features`,
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tipsters`,
      lastModified: today,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/careers`,
      lastModified: today,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    // Blog index
    {
      url: `${baseUrl}/blog`,
      lastModified: today,
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
    // Public SEO pages: comparisons (Lasyly vs X)
    {
      url: `${baseUrl}/compare`,
      lastModified: today,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    },
    ...comparisonEntries,
    // Auth
    {
      url: `${baseUrl}/login`,
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // Legal
    {
      url: `${baseUrl}/terms`,
      lastModified: today,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: today,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}
