/**
 * Resolve a clicked performance-chart bar to a `LiveMatch` the boxscore modal
 * can open.
 *
 * Client-safe: no `server-only`, no supabase, no secrets.
 *
 *  - NFL: `nfl_games.id` IS the ESPN event id and the NFL engine threads it onto
 *    each `lastGames` entry as `eventId`. So we build a minimal `LiveMatch`
 *    synchronously — no network hop — and the modal fetches ESPN's summary.
 *
 * NBA no longer goes through here: it reads its boxscore from our own DB by game
 * id (see /api/nba/boxscore/[gameId] and the analysis page's click handler), so
 * old games resolve too. Any other sport returns `null` and the caller treats
 * the click as a graceful no-op.
 */

import type { LiveMatch } from "@/types"
import { getTeamLogoUrl } from "@/lib/constants/teams"

export interface ResolveBoxscoreArgs {
  /** Page sport flag, e.g. "NBA" | "NFL" | "NHL" | "Soccer" | "Tennis". */
  sport: string
  /** The player's own team abbreviation (header best-effort). */
  playerTeam: string
  /** Stored opponent abbreviation for the clicked game. */
  opponent: string
  /** Stored game date, `YYYY-MM-DD`. */
  date: string
  /** ESPN event id when the source carries one (NFL). */
  eventId?: string
  /** Real player-team name for the modal header (NFL). Falls back to the abbr. */
  playerTeamName?: string
  /** Real player-team logo url for the modal header (NFL). */
  playerTeamLogo?: string | null
  /** Real player-team color for the modal header wash (NFL). */
  playerTeamColor?: string | null
  /** Real opponent name for the modal header (NFL). Falls back to the abbr. */
  opponentName?: string
  /** Real opponent logo url for the modal header (NFL). */
  opponentLogo?: string | null
  /** Real opponent color for the modal header wash (NFL). */
  opponentColor?: string | null
}

export async function resolveBoxscoreMatch(args: ResolveBoxscoreArgs): Promise<LiveMatch | null> {
  const {
    sport,
    playerTeam,
    opponent,
    eventId,
    playerTeamName,
    playerTeamLogo,
    playerTeamColor,
    opponentName,
    opponentLogo,
    opponentColor,
  } = args

  // NFL: stored ESPN event id → open directly. The modal header reads team
  // identity entirely from this LiveMatch, so thread real names/logos/colors
  // (falling back to the stored abbreviations) instead of bare abbreviations.
  if (eventId && sport === "NFL") {
    return {
      id: `perf-${eventId}`,
      eventId,
      league: "NFL",
      sport: "American Football",
      status: "Finished",
      homeTeam: playerTeamName || playerTeam,
      awayTeam: opponentName || opponent,
      homeLogo: playerTeamLogo ?? getTeamLogoUrl(playerTeam, "NFL") ?? undefined,
      awayLogo: opponentLogo ?? getTeamLogoUrl(opponent, "NFL") ?? undefined,
      homeColor: playerTeamColor ?? undefined,
      awayColor: opponentColor ?? undefined,
      homeScore: 0,
      awayScore: 0,
    }
  }

  // Any other sport (NBA reads from our DB elsewhere): no ESPN resolution.
  return null
}
