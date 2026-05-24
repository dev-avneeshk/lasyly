import { NextResponse } from "next/server"

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://lasyly.com"

const posts = [
  {
    slug: "why-share-your-betslip",
    title: "Why You Should Share Your Betslip (Even When You Lose)",
    description:
      "Sharing your betslip publicly builds your track record, sharpens decision-making, and can turn your edge into real income.",
    pubDate: "Sat, 24 May 2026 09:00:00 +0000",
  },
  {
    slug: "how-to-read-prop-analytics",
    title: "How to Read Prop Analytics: Hit Rates, Matchup Grades & Confidence Scores Explained",
    description:
      "A plain-English breakdown of every metric on a Lasyly prop card — hit rates, matchup grades, confidence scores, trend arrows, streak dots, correlations, and line movement.",
    pubDate: "Thu, 22 May 2026 09:00:00 +0000",
  },
  {
    slug: "nba-player-props-guide",
    title: "The Complete Guide to NBA Player Props in 2026",
    description:
      "Points, rebounds, assists, 3-pointers, and beyond. Everything you need to approach NBA player props — defensive matchups, line value, hit rates, and correlated parlays.",
    pubDate: "Tue, 20 May 2026 09:00:00 +0000",
  },
]

export function GET() {
  const items = posts
    .map(
      (p) => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${BASE_URL}/blog/${p.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${p.slug}</guid>
      <description><![CDATA[${p.description}]]></description>
      <pubDate>${p.pubDate}</pubDate>
      <author>team@lasyly.com (Lasyly Team)</author>
    </item>`
    )
    .join("")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Lasyly Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Sports betting tips, prop analytics guides, and community insights from the Lasyly team.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
