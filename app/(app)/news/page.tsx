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
  alternates: { canonical: "https://lasyly.me/news" },
}

export const dynamic = "force-static"
export const revalidate = 60

export default function NewsPage() {
  return (
    <div className="w-full">
      <NewsClient initialItems={[]} />
    </div>
  )
}
