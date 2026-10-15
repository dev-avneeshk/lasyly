/**
 * Resolve a clicked performance-chart bar to a `LiveMatch` the boxscore modal
 * can open.
 *
 * Client-safe: no `server-only`, no supabase, no secrets. It only reads the
 * public `/api/scores` route. Two paths, keyed on how each sport stores games:
 *
 *  - NFL (path a): `nfl_games.id` IS the ESPN event id and the NFL engine
 *    threads it onto each `lastGames` entry as `eventId`. So we build a minimal
 *    `LiveMatch` synchronously — no network hop.
 *  - NBA (path b): there is no ESPN event id in NBA data (box-score slugs from
 *    Basketball Reference, which the summary route would reject). We resolve the
 *    event at click time by querying the ESPN scoreboard for the game date and
 *    matching the stored opponent abbreviation to a scoreboard team.
 *
 * Any other sport (or a game we can't match) returns `null`, and the caller
 * treats the click as a graceful no-op.
 */

import type { LiveMatch } from "@/types"
import { NBA_TEAM_FULL_NAME } from "@/lib/constants/teams"
import { normalizeTeamName } from "@/lib/scores/alignTeams"

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
}

/** `YYYY-MM-DD` → `YYYYMMDD` for the scoreboard query param. */
function toScoreboardDate(date: string): string {
  return date.replace(/-/g, "").slice(0, 8)
}

/**
 * Does a scoreboard match involve the stored opponent abbreviation? Compares the
 * opponent's full name (from the abbr) against each side's normalized name, and
 * also allows a direct normalized abbr/name comparison in both directions.
 */
function matchInvolvesOpponent(match: LiveMatch, opponentAbbr: string): boolean {
  const abbr = opponentAbbr.toLowerCase()
  const fullName = NBA_TEAM_FULL_NAME[abbr]
  const candidates = [normalizeTeamName(abbr), fullName ? normalizeTeamName(fullName) : ""].filter(Boolean)

  const sides = [normalizeTeamName(match.homeTeam), normalizeTeamName(match.awayTeam)]
  return candidates.some((c) => sides.some((s) => s === c || s.includes(c) || c.includes(s)))
}

export async function resolveBoxscoreMatch(args: ResolveBoxscoreArgs): Promise<LiveMatch | null> {
  const { sport, playerTeam, opponent, date, eventId } = args

  // NFL (path a): stored ESPN event id → open directly.
  if (eventId && sport === "NFL") {
    return {
      id: `perf-${eventId}`,
      eventId,
      league: "NFL",
      sport: "American Football",
      status: "Finished",
      homeTeam: playerTeam,
      awayTeam: opponent,
      homeScore: 0,
      awayScore: 0,
    }
  }

  // NBA (path b): resolve the event from the scoreboard for that date.
  if (sport === "NBA") {
    if (!date) return null
    try {
      const res = await fetch(`/api/scores?date=${toScoreboardDate(date)}&sport=Basketball`)
      if (!res.ok) return null
      const json = (await res.json()) as { data?: LiveMatch[] }
      const matches = json.data ?? []
      const found = matches.find((m) => m.eventId && matchInvolvesOpponent(m, opponent))
      if (!found) return null
      // Force Finished so the modal opens on the stats/boxscore tab, not Preview.
      return { ...found, status: "Finished" }
    } catch {
      return null
    }
  }

  // Any other sport: no boxscore resolution.
  return null
}
