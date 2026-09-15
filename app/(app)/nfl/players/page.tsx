import type { Metadata } from "next"
import { getSeasonPlayers, DEFAULT_SEASON } from "@/lib/nfl/data"
import PlayersClient from "./PlayersClient"

export const metadata: Metadata = {
  title: "NFL Players | Lasyly Gridiron",
  description: "Browse the NFL auction player pool — search, filter by position, and sort by value.",
  robots: { index: false },
}

export default function NflPlayersPage() {
  const players = getSeasonPlayers(DEFAULT_SEASON)
  return <PlayersClient players={players} season={DEFAULT_SEASON} />
}
