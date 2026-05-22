import { NextResponse } from "next/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { cached } from "@/lib/cache"

/**
 * GET /api/highlights?q=Spurs+vs+OKC+highlights
 *
 * Strategy:
 * 1. If YOUTUBE_API_KEY is set → use YouTube Data API v3 (best results)
 * 2. Fallback → scrape video ID from YouTube search HTML (no key needed)
 */

const HIGHLIGHTS_CACHE_TTL = 600_000 // 10 minutes

async function scrapeYouTubeSearch(query: string): Promise<{ id: string; title: string } | null> {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    })

    if (!res.ok) return null

    const html = await res.text()

    // Extract video ID from the search results page
    // YouTube embeds video data in a script tag as JSON
    const videoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)
    if (!videoIdMatch) return null

    const videoId = videoIdMatch[1]

    // Try to extract the title
    const titlePattern = new RegExp(`"videoId":"${videoId}"[^}]*?"title":\\{"runs":\\[\\{"text":"([^"]+)"`)
    const titleMatch = html.match(titlePattern)
    // Fallback: try another title pattern
    const altTitleMatch = html.match(new RegExp(`"videoId":"${videoId}".*?"title":\\{[^}]*"simpleText":"([^"]+)"`))

    const title = titleMatch?.[1] || altTitleMatch?.[1] || query

    return { id: videoId, title }
  } catch {
    return null
  }
}

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")

  if (!query || query.length < 3) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required (min 3 chars)", success: false },
      { status: 400 }
    )
  }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY

    if (apiKey) {
      // Use YouTube Data API v3 to search for the video
      const video = await cached(`highlights:yt:${query}`, async () => {
        const ytUrl = new URL("https://www.googleapis.com/youtube/v3/search")
        ytUrl.searchParams.set("part", "snippet")
        ytUrl.searchParams.set("q", query)
        ytUrl.searchParams.set("type", "video")
        ytUrl.searchParams.set("maxResults", "1")
        ytUrl.searchParams.set("order", "relevance")
        ytUrl.searchParams.set("key", apiKey)

        const res = await fetch(ytUrl.toString())
        const data = await res.json()

        if (data.items && data.items.length > 0) {
          const item = data.items[0]
          return {
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            channel: item.snippet.channelTitle,
            embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
          }
        }
        return null
      }, HIGHLIGHTS_CACHE_TTL)

      if (video) {
        return NextResponse.json({ success: true, video })
      }
    }

    // Fallback: scrape YouTube search results (no API key needed)
    const scraped = await cached(`highlights:scrape:${query}`, async () => {
      return scrapeYouTubeSearch(query)
    }, HIGHLIGHTS_CACHE_TTL)

    if (scraped) {
      return NextResponse.json({
        success: true,
        video: {
          id: scraped.id,
          title: scraped.title,
          thumbnail: `https://img.youtube.com/vi/${scraped.id}/hqdefault.jpg`,
          channel: null,
          embedUrl: `https://www.youtube.com/embed/${scraped.id}`,
          searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        },
      })
    }

    // Last resort: return search URL so user can click through
    return NextResponse.json({
      success: true,
      video: {
        id: null,
        title: query,
        thumbnail: null,
        channel: null,
        embedUrl: null,
        searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to search highlights"
    console.error("Highlights API error:", message)
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    )
  }
}

export const GET = withSecurity(handleGET, {
  cacheControl: CACHE_CONTROL.PUBLIC_SHORT,
})
