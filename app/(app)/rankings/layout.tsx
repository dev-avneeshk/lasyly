import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "NBA Rankings 2026-27",
  description: "Lasyly's comprehensive NBA player and team power rankings for the 2026-27 season. Historical 2025-26 rankings, projected breakouts, and team power rankings — all algorithmically generated.",
  keywords: ["NBA rankings", "NBA power rankings", "best NBA players 2026", "NBA player rankings 2026-27", "team power rankings"],
  openGraph: {
    title: "NBA Rankings 2026-27 | Lasyly",
    description: "The definitive algorithmic NBA rankings — players, teams, and projections for the 2026-27 season.",
  },
}

export default function RankingsLayout({ children }: { children: React.ReactNode }) {
  return children
}
