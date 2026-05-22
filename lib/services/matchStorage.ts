/**
 * Match storage service — persists matches to Supabase `matches` table.
 * Used for caching finished matches and storing historical data.
 * 
 * Strategy: DB-first. Always serve from DB when possible.
 * Only hit ESPN when data is stale or missing.
 */

import { LiveMatch } from "@/types"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Upsert matches into the `matches` table.
 * For finished matches, always update. For live matches, update score/status/clock.
 */
export async function upsertMatches(matches: LiveMatch[], source: string = "espn", date?: string): Promise<void> {
  if (matches.length === 0) return

  const supabase = createAdminClient()

  const matchDate = date ? formatDateParam(date) : getTodayDate()

  const rows = matches.map((m) => ({
    id: m.id,
    event_id: m.eventId ?? m.id.split("-").pop() ?? "",
    home_team: m.homeTeam,
    away_team: m.awayTeam,
    home_score: m.homeScore,
    away_score: m.awayScore,
    home_logo: m.homeLogo ?? null,
    away_logo: m.awayLogo ?? null,
    home_color: m.homeColor ?? null,
    away_color: m.awayColor ?? null,
    venue: m.venue ?? null,
    league: m.league,
    sport: m.sport,
    status: m.status,
    clock: m.clock ?? null,
    start_time: m.startTime ?? null,
    match_date: matchDate,
    source,
    updated_at: new Date().toISOString(),
  }))

  // Upsert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    await supabase
      .from("matches")
      .upsert(batch, { onConflict: "id" })
  }

  // Also store team logos for future use (fire and forget)
  storeTeamLogos(matches, supabase).catch(() => {})
}

/**
 * Query matches table by date, optionally filter by sport.
 * Maps DB rows to LiveMatch format.
 */
export async function getMatchesByDate(date: string, sport?: string): Promise<LiveMatch[]> {
  const supabase = createAdminClient()

  // Convert YYYYMMDD to YYYY-MM-DD for DB query
  const formattedDate = formatDateParam(date)

  let query = supabase
    .from("matches")
    .select("*")
    .eq("match_date", formattedDate)

  if (sport && sport !== "All") {
    query = query.eq("sport", sport)
  }

  const { data, error } = await query

  if (error || !data) return []

  return data.map(mapRowToLiveMatch)
}

/**
 * Check if DB data for a given date is fresh enough.
 * Returns { matches, isFresh } where isFresh means we don't need to hit ESPN.
 * 
 * Rules:
 * - Past dates: always fresh (games are done, no need to re-fetch)
 * - Today with all finished: fresh (no live games to update)
 * - Today with live/upcoming: fresh if updated within last 30 seconds
 * - No data at all: not fresh (need to fetch from ESPN)
 */
export async function getMatchesWithFreshness(
  date: string,
  sport?: string
): Promise<{ matches: LiveMatch[]; isFresh: boolean; hasLive: boolean }> {
  const supabase = createAdminClient()
  const formattedDate = formatDateParam(date)
  const today = getTodayDate()
  const isPast = formattedDate < today
  const isFuture = formattedDate > today

  let query = supabase
    .from("matches")
    .select("*")
    .eq("match_date", formattedDate)

  if (sport && sport !== "All") {
    query = query.eq("sport", sport)
  }

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return { matches: [], isFresh: false, hasLive: false }
  }

  const matches = data.map(mapRowToLiveMatch)

  // Past dates: always serve from DB, never re-fetch
  if (isPast) {
    return { matches, isFresh: true, hasLive: false }
  }

  // Future dates: serve from DB if we have data, refresh occasionally
  if (isFuture) {
    const latestUpdate = getLatestUpdate(data)
    // Refresh future schedules every 5 minutes
    const isFresh = latestUpdate > Date.now() - 5 * 60 * 1000
    return { matches, isFresh, hasLive: false }
  }

  // Today: check if there are live games
  const liveStatuses = ["In Progress", "Halftime", "First Half", "Second Half", "Q1", "Q2", "Q3", "Q4", "OT"]
  const hasLive = matches.some((m) => liveStatuses.includes(m.status))
  const allFinished = matches.every((m) => m.status === "Finished" || m.status === "Postponed")

  if (allFinished) {
    // All games done today — no need to re-fetch
    return { matches, isFresh: true, hasLive: false }
  }

  // Has live or upcoming games — check how recent the data is
  const latestUpdate = getLatestUpdate(data)
  // Consider fresh if updated within last 30 seconds
  const isFresh = latestUpdate > Date.now() - 30_000

  return { matches, isFresh, hasLive }
}

/**
 * Store team logo info for future use.
 */
export async function upsertTeamLogo(
  teamId: string,
  teamName: string,
  logoUrl: string,
  color: string,
  sport: string,
  league: string
): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from("team_logos")
    .upsert({
      id: teamId,
      team_name: teamName,
      logo_url: logoUrl,
      color,
      sport,
      league,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLatestUpdate(rows: any[]): number {
  let latest = 0
  for (const row of rows) {
    if (row.updated_at) {
      const ts = new Date(row.updated_at).getTime()
      if (ts > latest) latest = ts
    }
  }
  return latest
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function storeTeamLogos(matches: LiveMatch[], supabase: any): Promise<void> {
  const logos: Array<{
    id: string
    team_name: string
    logo_url: string
    color: string | null
    sport: string
    league: string
    updated_at: string
  }> = []

  const seen = new Set<string>()

  for (const m of matches) {
    if (m.homeLogo) {
      const id = `${m.sport}-${m.league}-${m.homeTeam}`.toLowerCase().replace(/\s+/g, "-")
      if (!seen.has(id)) {
        seen.add(id)
        logos.push({
          id,
          team_name: m.homeTeam,
          logo_url: m.homeLogo,
          color: m.homeColor ?? null,
          sport: m.sport,
          league: m.league,
          updated_at: new Date().toISOString(),
        })
      }
    }
    if (m.awayLogo) {
      const id = `${m.sport}-${m.league}-${m.awayTeam}`.toLowerCase().replace(/\s+/g, "-")
      if (!seen.has(id)) {
        seen.add(id)
        logos.push({
          id,
          team_name: m.awayTeam,
          logo_url: m.awayLogo,
          color: m.awayColor ?? null,
          sport: m.sport,
          league: m.league,
          updated_at: new Date().toISOString(),
        })
      }
    }
  }

  if (logos.length === 0) return

  // Batch upsert
  for (let i = 0; i < logos.length; i += 50) {
    const batch = logos.slice(i, i + 50)
    await supabase
      .from("team_logos")
      .upsert(batch, { onConflict: "id" })
  }
}

function getTodayDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/**
 * Convert YYYYMMDD to YYYY-MM-DD
 */
function formatDateParam(date: string): string {
  if (date.includes("-")) return date // Already formatted
  if (date.length === 8) return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
  return date
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToLiveMatch(row: any): LiveMatch {
  return {
    id: row.id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeScore: row.home_score ?? 0,
    awayScore: row.away_score ?? 0,
    clock: row.clock ?? undefined,
    startTime: row.start_time ?? undefined,
    status: row.status ?? "Not Started",
    league: row.league,
    sport: row.sport,
    homeLogo: row.home_logo ?? undefined,
    awayLogo: row.away_logo ?? undefined,
    homeColor: row.home_color ?? undefined,
    awayColor: row.away_color ?? undefined,
    venue: row.venue ?? undefined,
    eventId: row.event_id ?? undefined,
  }
}
