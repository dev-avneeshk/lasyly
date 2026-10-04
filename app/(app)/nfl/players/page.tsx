import type { Metadata } from "next"
import { getSeasonPlayers, DEFAULT_SEASON } from "@/lib/nfl/data"
import { playerValue } from "@/lib/nfl/value"
import { estimatedPrice } from "@/lib/nfl/grades"
import PlayersClient from "./PlayersClient"

// A representative budget/roster so the "est. price" column is meaningful on the
// browse page (matches the default league). The engine owns the math.
const REF_BUDGET = 50
const REF_ROSTER = 9

export const metadata: Metadata = {
  title: "NFL Players | Lasyly Gridiron",
  description: "Browse the NFL auction player pool — search, filter by position, and sort by value.",
  robots: { index: false },
}

export default function NflPlayersPage() {
  // Only what the list renders (full player objects made the page 3.2 MB), with
  // value and price computed here instead of in the browser.
  const players = getSeasonPlayers(DEFAULT_SEASON).map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    position: p.position,
    overall: p.overall,
    value: playerValue(p),
    estimate: estimatedPrice(p, REF_BUDGET, REF_ROSTER),
    espnId: p.espnId,
  }))
  return <PlayersClient players={players} season={DEFAULT_SEASON} />
}
