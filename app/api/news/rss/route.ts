import { NextResponse } from "next/server"
import { getNews } from "@/lib/data/news"

/**
 * GET /api/news/rss?category=Football
 *
 * Thin wrapper. All the DB-first / ESPN-fallback logic lives in
 * `lib/data/news.ts` so server components can import it directly.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const categoryFilter = searchParams.get("category")

  const result = await getNews(categoryFilter)

  return NextResponse.json(result)
}
