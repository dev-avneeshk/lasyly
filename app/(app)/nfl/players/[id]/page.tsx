import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getSeasonPlayers, findPlayer, DEFAULT_SEASON } from "@/lib/nfl/data"
import PlayerDetailClient from "./PlayerDetailClient"

export function generateStaticParams() {
  return getSeasonPlayers(DEFAULT_SEASON).map((p) => ({ id: p.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const player = findPlayer(DEFAULT_SEASON, id)
  if (!player) return { title: "Player not found | Lasyly Gridiron", robots: { index: false } }
  return {
    title: `${player.name} · ${player.position} ${player.team} | NFL Auction`,
    description: `${player.name} — ${player.position} for ${player.team}. Ratings, value, and estimated auction price.`,
    robots: { index: false },
  }
}

export default async function NflPlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const player = findPlayer(DEFAULT_SEASON, id)
  if (!player) notFound()
  return <PlayerDetailClient player={player} season={DEFAULT_SEASON} />
}
