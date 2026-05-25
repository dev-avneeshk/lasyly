import NewsClient from "./NewsClient"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sports News — Lasyly Daily",
  description:
    "Curated sports news from ESPN and major sources. Football, NBA, NFL, UFC, Tennis, Formula 1, and Cricket. Updated continuously.",
  openGraph: {
    title: "Sports News — Lasyly Daily",
    description: "Curated sports news from ESPN — Football, NBA, NFL, UFC, Tennis, F1, and Cricket.",
  },
  alternates: {
    canonical: "https://lasyly.me/news",
  },
}

// Statically render the shell; client fetches fresh news on hydration.
// This removes the blocking getNews() call that added ~300-700ms to TTFB.
export const dynamic = "force-static"
export const revalidate = 60

export default function NewsPage() {
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

      {/* Client component fetches news after hydration — no SSR DB round-trip */}
      <NewsClient initialItems={[]} />
    </div>
  )
}
