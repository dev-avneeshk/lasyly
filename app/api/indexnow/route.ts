/**
 * IndexNow submission endpoint.
 *
 * IndexNow is a protocol supported by Bing, Yandex, and others that lets you
 * notify search engines about new/updated URLs instantly instead of waiting
 * for their crawlers to discover changes.
 *
 * POST /api/indexnow          — submits all sitemap URLs
 * POST /api/indexnow?url=...  — submits a single URL
 *
 * The key file must be served at /<INDEXNOW_KEY>.txt (see public/ directory).
 * Get a free key at: https://www.bing.com/indexnow/getstarted
 */

import { NextRequest, NextResponse } from "next/server"

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.me"
const INDEXNOW_KEY = process.env.INDEXNOW_KEY

// All public URLs to submit when doing a bulk ping
const PUBLIC_URLS = [
  BASE_URL,
  `${BASE_URL}/explore`,
  `${BASE_URL}/scores`,
  `${BASE_URL}/news`,
  `${BASE_URL}/features`,
  `${BASE_URL}/tipsters`,
  `${BASE_URL}/blog`,
  `${BASE_URL}/blog/why-share-your-betslip`,
  `${BASE_URL}/blog/how-to-read-prop-analytics`,
  `${BASE_URL}/blog/nba-player-props-guide`,
  `${BASE_URL}/login`,
  `${BASE_URL}/signup`,
]

export async function POST(request: NextRequest) {
  if (!INDEXNOW_KEY) {
    return NextResponse.json(
      { error: "INDEXNOW_KEY environment variable is not set" },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const singleUrl = searchParams.get("url")

  const urlsToSubmit = singleUrl ? [singleUrl] : PUBLIC_URLS

  const payload = {
    host: new URL(BASE_URL).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urlsToSubmit,
  }

  try {
    // Submit to Bing (covers Bing, DuckDuckGo, Yahoo, Ecosia, and more)
    const bingResponse = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    })

    return NextResponse.json({
      success: true,
      urls: urlsToSubmit.length,
      bing: bingResponse.status,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to submit to IndexNow", details: String(error) },
      { status: 500 }
    )
  }
}

// GET returns instructions
export async function GET() {
  return NextResponse.json({
    info: "POST to this endpoint to submit URLs to Bing/DuckDuckGo/Yahoo via IndexNow",
    usage: {
      allUrls: "POST /api/indexnow",
      singleUrl: "POST /api/indexnow?url=https://lasyly.me/blog/my-post",
    },
    setup: [
      "1. Get a free key at https://www.bing.com/indexnow/getstarted",
      "2. Add INDEXNOW_KEY=your-key to .env.local",
      `3. Create public/<your-key>.txt containing just your key`,
      "4. POST to this endpoint",
    ],
  })
}
