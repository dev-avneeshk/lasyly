import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { fetchWithRetry } from "@/lib/supabase/fetch-with-retry"
import { cached } from "@/lib/cache"

const ARTICLE_CACHE_TTL = 600_000 // 10 minutes

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const articleId = searchParams.get("id")

  if (!articleId) {
    return NextResponse.json({ error: "Missing article id" }, { status: 400 })
  }

  try {
    // Try Supabase first
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { fetch: fetchWithRetry },
    })
    const { data } = await supabase
      .from("espn_news")
      .select("*")
      .eq("id", articleId)
      .single()

    if (data && data.story) {
      return NextResponse.json({
        id: data.id,
        headline: data.headline,
        description: data.description,
        story: data.story,
        published: data.published_at,
        source: data.source,
        image: data.image_url,
        byline: data.byline,
        link: data.link,
      })
    }

    // Fallback: fetch from ESPN API
    return await fetchFromESPN(articleId)
  } catch {
    return await fetchFromESPN(articleId)
  }
}

async function fetchFromESPN(articleId: string) {
  try {
    // Cache-aside in Redis instead of the Next Data Cache: a `next.revalidate`
    // fetch here created one billed ISR write per article id every 10 minutes.
    // Wrapped so a 404 is cached too (cached() treats a bare null as a miss).
    const { data } = await cached(
      `news:espn-article:v1:${encodeURIComponent(articleId)}`,
      async () => {
        const res = await fetch(
          `https://now.core.api.espn.com/v1/sports/news/${encodeURIComponent(articleId)}`,
          { headers: { "User-Agent": "Lasyly/1.0" }, cache: "no-store" }
        )
        return { data: res.ok ? await res.json() : null }
      },
      ARTICLE_CACHE_TTL
    )

    if (!data) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 })
    }
    const headlines = data.headlines ?? []

    if (headlines.length === 0) {
      return NextResponse.json({ error: "No article data" }, { status: 404 })
    }

    const article = headlines[0]
    const images = article.images ?? []
    const sortedImages = [...images].sort((a: { width?: number }, b: { width?: number }) => (b.width ?? 0) - (a.width ?? 0))
    let image = sortedImages[0]?.url ?? null
    if (image) {
      image = image.replace(/_\d+x\d+_\d+-\d+\./, "_1296x729_16-9.")
    }

    return NextResponse.json({
      id: article.id,
      headline: article.headline ?? "",
      description: article.description ?? "",
      story: article.story ?? null,
      published: article.published ?? "",
      source: article.section ?? article.root ?? "ESPN",
      image,
      byline: article.byline ?? null,
      link: article.links?.web?.href ?? "",
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch article" }, { status: 500 })
  }
}
