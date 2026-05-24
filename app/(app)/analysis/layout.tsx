import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Player Prop Analytics — Lasyly",
  description:
    "Research player props with hit rates, matchup grades (A–F), confidence scores, trend arrows, streak dots, and a correlated parlay builder. NBA, NFL, Soccer, Tennis, and NHL. Free.",
  openGraph: {
    title: "Player Prop Analytics — Lasyly",
    description:
      "Hit rates, matchup grades, confidence scores, and parlay builder for NBA, NFL, Soccer, Tennis, and NHL props.",
  },
  keywords: [
    "NBA player props",
    "prop hit rate",
    "matchup grade",
    "prop analytics",
    "parlay builder",
    "player prop research",
    "sports betting analytics",
  ],
  alternates: {
    canonical: "https://lasyly.com/analysis",
  },
}

export default function AnalysisLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
