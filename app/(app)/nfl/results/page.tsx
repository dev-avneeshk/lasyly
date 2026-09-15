import { redirect } from "next/navigation"

/**
 * Results are the final state of a live game at /nfl (client game state, not a
 * persisted resource in this vs-CPU mode). Visiting /nfl/results directly has
 * no completed game to show, so we route back into the experience. Kept so the
 * documented route never 404s.
 */
export default function NflResultsPage() {
  redirect("/nfl")
}
