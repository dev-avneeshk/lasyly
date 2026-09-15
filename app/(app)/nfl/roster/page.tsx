import { redirect } from "next/navigation"

/**
 * The roster lives inside the single-page auction experience at /nfl (it's
 * client game state, not a persisted resource in this vs-CPU mode). Visiting
 * /nfl/roster directly has no standalone roster to show, so we route the user
 * back into the game where the roster panels render live. Kept so the
 * documented route never 404s.
 */
export default function NflRosterPage() {
  redirect("/nfl")
}
