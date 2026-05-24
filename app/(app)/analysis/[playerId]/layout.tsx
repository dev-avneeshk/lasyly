import type { Metadata } from "next"

interface Props {
  params: Promise<{ playerId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { playerId } = await params
  // Convert slug back to display name: "lebron-james" → "LeBron James"
  const displayName = decodeURIComponent(playerId)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return {
    title: `${displayName} Prop Analytics`,
    description: `Hit rates, matchup grade, confidence score, trend, and streak data for ${displayName} player props. Research smarter before you bet.`,
    openGraph: {
      title: `${displayName} Prop Analytics — Lasyly`,
      description: `Hit rates, matchup grade, confidence score, and historical trend data for ${displayName}.`,
    },
    alternates: {
      canonical: `https://lasyly.me/analysis/${encodeURIComponent(playerId)}`,
    },
  }
}

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
