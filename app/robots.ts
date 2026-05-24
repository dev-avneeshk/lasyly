import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"

  const publicPaths = ["/", "/blog/", "/features", "/tipsters", "/scores", "/news", "/explore", "/login", "/signup", "/terms", "/privacy"]
  const privatePaths = ["/api/", "/dashboard/", "/wallet/", "/profile/", "/bets/", "/rooms/", "/analysis/"]

  return {
    rules: [
      {
        userAgent: "*",
        allow: publicPaths,
        disallow: privatePaths,
      },
      // Explicitly allow major AI crawlers so they index llms.txt and public content
      {
        userAgent: "GPTBot",
        allow: publicPaths,
        disallow: privatePaths,
      },
      {
        userAgent: "ClaudeBot",
        allow: publicPaths,
        disallow: privatePaths,
      },
      {
        userAgent: "PerplexityBot",
        allow: publicPaths,
        disallow: privatePaths,
      },
      {
        userAgent: "Applebot",
        allow: publicPaths,
        disallow: privatePaths,
      },
      {
        userAgent: "Amazonbot",
        allow: publicPaths,
        disallow: privatePaths,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
