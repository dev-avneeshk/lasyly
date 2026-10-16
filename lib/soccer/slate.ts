/**
 * Soccer props slate: the set of team names allowed onto the props page.
 *
 * Primary source is the ESPN fixture window (today → +3 days). ESPN has no
 * current-season Big-5 fixtures, so a covered (Big-5) league with no fixture in
 * the window falls back to teams with an imported `soccer_matches` row in the
 * last RECENT_ACTIVITY_DAYS days.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { shiftIso } from "@/lib/props/dates"
import { BIG5_LEAGUE_CODES } from "@/lib/soccer/big5"

/** How far back an imported match keeps a team on the slate (covers international breaks). */
export const RECENT_ACTIVITY_DAYS = 14

const SLATE_LEAGUES = ["eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "uefa.champions", "usa.1"]

/**
 * Every non-null ESPN fixture team, plus DB teams from covered leagues that have
 * no ESPN fixture. Deduped, in first-seen order.
 */
export function mergeSlateTeams(
  espnFixtures: Array<{ league: string; home_team: string | null; away_team: string | null }>,
  recentDbMatches: Array<{ league: string; home_team: string; away_team: string }>,
  coveredLeagues: readonly string[],
): string[] {
  const names = new Set<string>()
  const fixtureLeagues = new Set<string>()

  for (const f of espnFixtures) {
    fixtureLeagues.add(f.league)
    if (f.home_team) names.add(f.home_team)
    if (f.away_team) names.add(f.away_team)
  }

  for (const m of recentDbMatches) {
    if (!coveredLeagues.includes(m.league) || fixtureLeagues.has(m.league)) continue
    if (m.home_team) names.add(m.home_team)
    if (m.away_team) names.add(m.away_team)
  }

  return [...names]
}

/** Slate team names for `todayET` (`YYYY-MM-DD`, ET). Never throws. */
export async function getSoccerSlateTeams(todayET: string): Promise<string[]> {
  const supabase = createAdminClient()

  let fixtures: Array<{ league: string; home_team: string | null; away_team: string | null }> = []
  try {
    const windowEnd = new Date(`${todayET}T00:00:00Z`)
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 3)
    const windowEndStr = windowEnd.toISOString().split("T")[0]
    const { data, error } = await supabase
      .from("espn_games")
      .select("league, home_team, away_team")
      .in("league", SLATE_LEAGUES)
      .gte("match_date", todayET)
      .lte("match_date", windowEndStr)
      .in("status", ["scheduled", "in_progress"])
      .limit(80)
    // An ESPN error counts as no fixtures.
    if (!error) fixtures = data ?? []
  } catch {
    fixtures = []
  }

  const fixtureLeagues = new Set(fixtures.map((f) => f.league))
  const uncovered = BIG5_LEAGUE_CODES.filter((l) => !fixtureLeagues.has(l))

  let recent: Array<{ league: string; home_team: string; away_team: string }> = []
  if (uncovered.length > 0) {
    try {
      const { data, error } = await supabase
        .from("soccer_matches")
        .select("league, home_team, away_team")
        .in("league", uncovered)
        .gte("match_date", shiftIso(todayET, -RECENT_ACTIVITY_DAYS))
      if (error) throw error
      recent = data ?? []
    } catch (err) {
      console.warn("[soccer-slate] soccer_matches read failed:", (err as { message?: string })?.message ?? String(err))
      recent = []
    }
  }

  return mergeSlateTeams(fixtures, recent, BIG5_LEAGUE_CODES)
}
