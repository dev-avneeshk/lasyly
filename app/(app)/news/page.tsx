import { getNews } from "@/lib/data/news"
import NewsClient from "./NewsClient"

// Cache the rendered shell for ~60s; matches CACHE_TTL.explore.
export const revalidate = 60

/**
 * Server component shell for /news.
 *
 * Pre-fetches the "Latest" feed on the server so the first response already
 * contains real article cards. Category tab switches are still handled
 * client-side via NewsFeed's existing fetch path.
 */
export default async function NewsPage() {
  let initialItems: Awaited<ReturnType<typeof getNews>>["items"] = []
  try {
    const result = await getNews(null)
    initialItems = result.items
  } catch {
    initialItems = []
  }

  return (
    <div className="w-full">
      {/* Masthead — pure server-rendered */}
      <header className="text-center py-5 border-b border-white/10">
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "32px", fontWeight: 400, letterSpacing: "8px", textTransform: "uppercase", color: "white" }}>
          LASYLY DAILY
        </h1>
        <p style={{ fontFamily: "var(--font-body-serif)", fontSize: "12px", color: "#888", marginTop: "4px", fontStyle: "italic" }}>
          Sports News · Picks · Community
        </p>
      </header>

      <NewsClient initialItems={initialItems} />
    </div>
  )
}
