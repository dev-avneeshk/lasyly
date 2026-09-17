/**
 * Player Profile API
 *
 * Contextual data for the player detail page that the prop engines don't carry:
 * bio (position / jersey / height / weight / age), team crest + brand colours +
 * W-L record, and the next scheduled game with kickoff time and venue.
 *
 * Query params:
 *   player   (required) — exact player name, e.g. "Noah Gray"
 *   team     (required) — team abbreviation, e.g. "KC"
 *   sport    (optional) — NBA | NFL | NHL | Soccer | Tennis (default NBA)
 *   opponent (optional) — fallback opponent abbreviation from the prop's
 *                         matchup key, used when no upcoming game row exists
 *
 * Coverage varies by sport: NFL and NHL resolve everything, NBA returns bio
 * only, Tennis/Soccer degrade to team identity. Missing fields are null so the
 * UI can omit them rather than render placeholders.
 */

import { NextResponse } from "next/server"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { getPlayerProfile, ProfileSport } from "@/lib/analytics/player-profile"

const VALID_SPORTS = new Set<ProfileSport>(["NBA", "NFL", "NHL", "Soccer", "Tennis"])

/** Abbreviations are interpolated into DB filters — keep them strictly alphabetic. */
const TEAM_ABBR = /^[A-Za-z]{2,4}$/
/** Player names: letters, spaces and the punctuation real names actually contain. */
const PLAYER_NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'’\-]{0,60}$/u

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const player = (searchParams.get("player") ?? "").trim()
  const team = (searchParams.get("team") ?? "").trim()
  const sportRaw = (searchParams.get("sport") ?? "NBA").trim()
  const opponent = (searchParams.get("opponent") ?? "").trim()

  const injectionCheck = checkQueryParams({ player, team, sport: sportRaw, opponent })
  if (injectionCheck) return injectionCheck

  if (!PLAYER_NAME.test(player)) {
    return NextResponse.json({ error: "valid player name required" }, { status: 400 })
  }
  if (!TEAM_ABBR.test(team)) {
    return NextResponse.json({ error: "valid team abbreviation required" }, { status: 400 })
  }
  if (opponent && !TEAM_ABBR.test(opponent)) {
    return NextResponse.json({ error: "opponent must be a team abbreviation" }, { status: 400 })
  }
  if (!VALID_SPORTS.has(sportRaw as ProfileSport)) {
    return NextResponse.json(
      { error: "sport must be one of NBA, NFL, NHL, Soccer, Tennis" },
      { status: 400 }
    )
  }

  try {
    const profile = await getPlayerProfile(
      player,
      team,
      sportRaw as ProfileSport,
      opponent || undefined
    )
    return NextResponse.json(profile)
  } catch {
    // The page treats this endpoint as enrichment — a failure should degrade the
    // hero, not break it.
    return NextResponse.json({ error: "failed to load player profile" }, { status: 502 })
  }
}, { cacheControl: CACHE_CONTROL.PUBLIC_LONG })
