/**
 * ESPN Unofficial API integration.
 * Fetches live scores from ESPN's public JSON API for multiple sports/leagues.
 * No API key required — ESPN's API is open and CORS-friendly.
 *
 * Architecture: This module is called by the sportsApi service layer.
 * It should only be called server-side (from API routes or cache fetchers).
 * Never call ESPN directly from the client — always proxy through /api/scores.
 */

import { LiveMatch, MatchStatus, MatchSummary } from "@/types"

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports"

// ─── League Configuration ────────────────────────────────────────────────────

interface LeagueConfig {
  sport: string
  league: string
  displaySport: string
  path: string
}

const LEAGUES: LeagueConfig[] = [
  // Basketball
  { sport: "basketball", league: "nba", displaySport: "Basketball", path: "basketball/nba" },
  { sport: "basketball", league: "wnba", displaySport: "Basketball", path: "basketball/wnba" },
  // American Football
  { sport: "football", league: "nfl", displaySport: "American Football", path: "football/nfl" },
  // Hockey
  { sport: "hockey", league: "nhl", displaySport: "Hockey", path: "hockey/nhl" },
  // Soccer
  { sport: "soccer", league: "eng.1", displaySport: "Football", path: "soccer/eng.1" },
  { sport: "soccer", league: "esp.1", displaySport: "Football", path: "soccer/esp.1" },
  { sport: "soccer", league: "ita.1", displaySport: "Football", path: "soccer/ita.1" },
  { sport: "soccer", league: "ger.1", displaySport: "Football", path: "soccer/ger.1" },
  { sport: "soccer", league: "fra.1", displaySport: "Football", path: "soccer/fra.1" },
  { sport: "soccer", league: "uefa.champions", displaySport: "Football", path: "soccer/uefa.champions" },
  { sport: "soccer", league: "usa.1", displaySport: "Football", path: "soccer/usa.1" },
  // Baseball
  { sport: "baseball", league: "mlb", displaySport: "Baseball", path: "baseball/mlb" },
  // Tennis (uses tournament/groupings structure — handled by fetchTennisScoreboard)
  { sport: "tennis", league: "atp", displaySport: "Tennis", path: "tennis/atp" },
  { sport: "tennis", league: "wta", displaySport: "Tennis", path: "tennis/wta" },
  // Racing
  { sport: "racing", league: "f1", displaySport: "F1", path: "racing/f1" },
  // Golf
  { sport: "golf", league: "pga", displaySport: "Golf", path: "golf/pga" },
  // MMA
  { sport: "mma", league: "ufc", displaySport: "MMA", path: "mma/ufc" },
  // Cricket
  { sport: "cricket", league: "cricket", displaySport: "Cricket", path: "cricket" },
]

// ─── ESPN Response Types ─────────────────────────────────────────────────────

interface ESPNCompetitor {
  homeAway: "home" | "away"
  score: string
  team: {
    id: string
    abbreviation: string
    displayName: string
    logo?: string
    color?: string
  }
}

interface ESPNEvent {
  id: string
  name: string
  date: string
  status: {
    type: {
      name: string
      shortDetail: string
    }
  }
  competitions: Array<{
    competitors: ESPNCompetitor[]
    venue?: { fullName: string }
    odds?: Array<{ details: string }>
  }>
}

interface ESPNScoreboardResponse {
  events?: ESPNEvent[]
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch live scores from ESPN for all configured leagues.
 * Fetches all leagues in parallel with a 5-second timeout per request.
 * Returns combined results — failed leagues are silently skipped.
 *
 * @param date - Optional date in YYYYMMDD format to fetch scores for a specific date
 */
export async function fetchESPNScores(date?: string): Promise<LiveMatch[]> {
  const results = await Promise.allSettled(
    LEAGUES.map((league) => fetchLeagueScoreboard(league, date))
  )

  const matches: LiveMatch[] = []
  for (const result of results) {
    if (result.status === "fulfilled") {
      matches.push(...result.value)
    }
  }

  return matches
}

/**
 * Fetch scores for a specific league only.
 * Useful for targeted polling (e.g., only NBA during basketball season).
 */
export async function fetchESPNLeague(sportPath: string, date?: string): Promise<LiveMatch[]> {
  const league = LEAGUES.find((l) => l.path === sportPath)
  if (!league) return []
  return fetchLeagueScoreboard(league, date)
}

/**
 * Fetch match summary/detail from ESPN's summary endpoint.
 * Returns venue, odds, broadcasts, leaders, and headline.
 */
export async function fetchESPNSummary(sportPath: string, eventId: string): Promise<MatchSummary> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const url = `${ESPN_BASE}/${sportPath}/summary?event=${eventId}`
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 0 },
    })

    clearTimeout(timeout)

    if (!res.ok) {
      throw new Error(`ESPN summary returned ${res.status}`)
    }

    const data = await res.json()
    return mapESPNSummary(data, eventId)
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

/**
 * Get the sport path for a given league string (used to construct summary URLs).
 */
export function getLeagueSportPath(league: string): string | undefined {
  const config = LEAGUES.find((l) => getLeagueDisplayName(l.league) === league)
  return config?.path
}

// ─── Internal ────────────────────────────────────────────────────────────────

async function fetchLeagueScoreboard(config: LeagueConfig, date?: string): Promise<LiveMatch[]> {
  // Tennis uses a completely different structure (tournaments with groupings)
  if (config.sport === "tennis") {
    return fetchTennisScoreboard(config, date)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    let url = `${ESPN_BASE}/${config.path}/scoreboard`
    if (date) {
      url += `?dates=${date}`
    }
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 0 }, // Don't use Next.js fetch cache
    })

    clearTimeout(timeout)

    if (!res.ok) {
      return [] // Silently skip failed leagues
    }

    const data: ESPNScoreboardResponse = await res.json()
    const events = data.events ?? []

    // Filter events to only include matches on the requested date
    // ESPN sometimes returns entire matchdays/gameweeks that span multiple calendar days
    // Determine the target date to filter by
    const targetDate = date
      ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
      : new Date().toISOString().split("T")[0] // Today in local time

    const filtered = events.filter((event) => {
      if (!event.date) return true // Keep events without a date (shouldn't happen)
      const eventDate = event.date.split("T")[0] // "2025-05-24T15:00Z" → "2025-05-24"
      return eventDate === targetDate
    })

    return filtered.map((event) => mapESPNEvent(event, config))
  } catch {
    clearTimeout(timeout)
    return [] // Silently skip on timeout or network error
  }
}

/**
 * Tennis-specific scoreboard fetcher.
 * ESPN tennis events are tournaments containing groupings (Singles/Doubles)
 * with individual match competitions nested inside.
 * Competitors use `athlete` instead of `team`.
 * We filter to only live + recent + upcoming matches to avoid
 * returning hundreds of historical tournament matches.
 */
async function fetchTennisScoreboard(config: LeagueConfig, date?: string): Promise<LiveMatch[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000) // Slightly longer for tennis (more data)

  try {
    let url = `${ESPN_BASE}/${config.path}/scoreboard`
    if (date) {
      url += `?dates=${date}`
    }
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 0 },
    })

    clearTimeout(timeout)

    if (!res.ok) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json()
    const events = data.events ?? []
    const liveMatches: LiveMatch[] = []
    const recentMatches: LiveMatch[] = []
    const upcomingMatches: LiveMatch[] = []

    for (const event of events) {
      const tournamentName = event.name ?? "Tennis"
      const groupings = event.groupings ?? []

      for (const grouping of groupings) {
        const competitions = grouping.competitions ?? []

        for (const comp of competitions) {
          const statusName = comp.status?.type?.name ?? "STATUS_SCHEDULED"
          const isLive = statusName === "STATUS_IN_PROGRESS"
          const isRecent = comp.recent === true
          const isScheduled = statusName === "STATUS_SCHEDULED"
          const isFinal = statusName === "STATUS_FINAL"

          // Include: all live, recent finished, and some upcoming
          if (!isLive && !isRecent && !isScheduled) continue
          // For finished matches, only include if marked as "recent"
          if (isFinal && !isRecent) continue

          const mapped = mapTennisCompetition(comp, config, tournamentName)
          if (!mapped) continue

          if (isLive) {
            liveMatches.push(mapped)
          } else if (isRecent) {
            recentMatches.push(mapped)
          } else if (isScheduled) {
            upcomingMatches.push(mapped)
          }
        }
      }
    }

    // Return all live, all recent, and up to 20 upcoming matches
    return [...liveMatches, ...recentMatches, ...upcomingMatches.slice(0, 20)]
  } catch {
    clearTimeout(timeout)
    return []
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTennisCompetition(comp: any, config: LeagueConfig, tournamentName: string): LiveMatch | null {
  const competitors = comp.competitors ?? []
  if (competitors.length < 2) return null

  const home = competitors.find((c: { homeAway: string }) => c.homeAway === "home")
  const away = competitors.find((c: { homeAway: string }) => c.homeAway === "away")
  if (!home || !away) return null

  const homeName = home.athlete?.displayName ?? home.athlete?.shortName ?? "TBD"
  const awayName = away.athlete?.displayName ?? away.athlete?.shortName ?? "TBD"

  // Calculate total games won from linescores (set scores)
  const homeSets = (home.linescores ?? []).filter((ls: { winner: boolean }) => ls.winner).length
  const awaySets = (away.linescores ?? []).filter((ls: { winner: boolean }) => ls.winner).length

  // Build set score string for clock display (e.g. "6-4, 3-6, 6-2")
  const homeLinescores = home.linescores ?? []
  const awayLinescores = away.linescores ?? []
  const setScores: string[] = []
  for (let i = 0; i < Math.max(homeLinescores.length, awayLinescores.length); i++) {
    const h = homeLinescores[i]?.value ?? 0
    const a = awayLinescores[i]?.value ?? 0
    setScores.push(`${Math.round(h)}-${Math.round(a)}`)
  }

  const statusName = comp.status?.type?.name ?? "STATUS_SCHEDULED"
  const status = mapESPNStatus(statusName, "tennis")
  const round = comp.round?.displayName ?? ""

  // Use country flag as "logo" for tennis players
  const homeFlag = home.athlete?.flag?.href ?? undefined
  const awayFlag = away.athlete?.flag?.href ?? undefined

  return {
    id: `espn-${config.league}-${comp.id}`,
    homeTeam: homeName,
    awayTeam: awayName,
    homeScore: homeSets,
    awayScore: awaySets,
    clock: status === "Finished"
      ? setScores.join(", ")
      : status === "In Progress"
      ? setScores.join(", ")
      : comp.status?.type?.shortDetail ?? undefined,
    status,
    league: `${getLeagueDisplayName(config.league)} - ${tournamentName}`,
    sport: config.displaySport,
    homeLogo: homeFlag,
    awayLogo: awayFlag,
    venue: comp.venue?.fullName ?? undefined,
    eventId: comp.id?.toString(),
  }
}

export function mapESPNEvent(event: ESPNEvent, config: LeagueConfig): LiveMatch {
  const comp = event.competitions[0]
  const home = comp?.competitors?.find((c) => c.homeAway === "home")
  const away = comp?.competitors?.find((c) => c.homeAway === "away")

  return {
    id: `espn-${config.league}-${event.id}`,
    homeTeam: home?.team.displayName ?? "TBD",
    awayTeam: away?.team.displayName ?? "TBD",
    homeScore: parseInt(home?.score ?? "0", 10) || 0,
    awayScore: parseInt(away?.score ?? "0", 10) || 0,
    clock: mapESPNClock(event),
    startTime: event.date || undefined,
    status: mapESPNStatus(event.status.type.name, config.sport),
    league: getLeagueDisplayName(config.league),
    sport: config.displaySport,
    homeLogo: home?.team.logo || undefined,
    awayLogo: away?.team.logo || undefined,
    homeColor: home?.team.color || undefined,
    awayColor: away?.team.color || undefined,
    venue: comp?.venue?.fullName || undefined,
    eventId: event.id,
  }
}

function mapESPNClock(event: ESPNEvent): string | undefined {
  const statusName = event.status.type.name
  const shortDetail = event.status.type.shortDetail

  if (statusName === "STATUS_SCHEDULED") {
    // shortDetail might have the time (e.g. "7:30 PM ET")
    return shortDetail || undefined
  }
  if (statusName === "STATUS_FINAL" || statusName === "STATUS_FULL_TIME") return undefined
  if (statusName === "STATUS_POSTPONED" || statusName === "STATUS_CANCELED") return undefined

  // For live games, shortDetail has the clock info (e.g. "Q3 4:22", "65'", "HT")
  return shortDetail || undefined
}

function mapESPNStatus(statusName: string, sport: string): MatchStatus {
  switch (statusName) {
    case "STATUS_SCHEDULED":
      return "Not Started"
    case "STATUS_IN_PROGRESS":
      return sport === "soccer" ? "In Progress" : "In Progress"
    case "STATUS_HALFTIME":
      return "Halftime"
    case "STATUS_FINAL":
    case "STATUS_FULL_TIME":
      return "Finished"
    case "STATUS_POSTPONED":
    case "STATUS_CANCELED":
    case "STATUS_SUSPENDED":
      return "Postponed"
    default:
      return "In Progress"
  }
}

function getLeagueDisplayName(league: string): string {
  const names: Record<string, string> = {
    nba: "NBA",
    wnba: "WNBA",
    nfl: "NFL",
    nhl: "NHL",
    mlb: "MLB",
    "eng.1": "Premier League",
    "esp.1": "La Liga",
    "ita.1": "Serie A",
    "ger.1": "Bundesliga",
    "fra.1": "Ligue 1",
    "uefa.champions": "Champions League",
    "usa.1": "MLS",
    atp: "ATP",
    wta: "WTA",
    f1: "Formula 1",
    pga: "PGA Tour",
    ufc: "UFC",
    cricket: "Cricket",
  }
  return names[league] ?? league.toUpperCase()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapESPNSummary(data: any, eventId: string): MatchSummary {
  const summary: MatchSummary = { eventId }

  // Extract venue
  try {
    summary.venue = data?.gameInfo?.venue?.fullName || undefined
  } catch {
    summary.venue = undefined
  }

  // Extract broadcasts
  try {
    const broadcasts = data?.header?.competitions?.[0]?.broadcasts
    if (Array.isArray(broadcasts) && broadcasts.length > 0) {
      const names: string[] = []
      for (const b of broadcasts) {
        if (Array.isArray(b?.names)) {
          names.push(...b.names)
        } else if (b?.name) {
          names.push(b.name)
        }
      }
      summary.broadcasts = names.length > 0 ? names : undefined
    }
  } catch {
    summary.broadcasts = undefined
  }

  // Extract odds from pickcenter
  try {
    const pickcenter = data?.pickcenter
    if (Array.isArray(pickcenter) && pickcenter.length > 0) {
      const pc = pickcenter[0]
      summary.odds = {
        homeMoneyline: pc?.homeTeamOdds?.moneyLine?.toString() || undefined,
        awayMoneyline: pc?.awayTeamOdds?.moneyLine?.toString() || undefined,
        spread: pc?.details || undefined,
        overUnder: pc?.overUnder?.toString() || undefined,
      }
    }
  } catch {
    summary.odds = undefined
  }

  // Extract leaders
  try {
    const leaders = data?.leaders
    if (Array.isArray(leaders) && leaders.length > 0) {
      const mapped: MatchSummary["leaders"] = []
      for (const leader of leaders) {
        if (Array.isArray(leader?.leaders)) {
          for (const l of leader.leaders) {
            if (l?.athlete?.displayName) {
              mapped.push({
                team: leader.team?.abbreviation ?? "",
                name: l.athlete.displayName,
                stat: l.displayName ?? "",
                value: l.displayValue ?? l.value?.toString() ?? "",
              })
            }
          }
        }
      }
      summary.leaders = mapped.length > 0 ? mapped : undefined
    }
  } catch {
    summary.leaders = undefined
  }

  // Extract headline
  try {
    summary.headline = data?.header?.competitions?.[0]?.headlines?.[0]?.shortLinkText || undefined
  } catch {
    summary.headline = undefined
  }

  // Extract boxscore (player stats)
  try {
    const boxscore = data?.boxscore
    if (boxscore) {
      // Team stats
      const teamStats: MatchSummary["boxscore"] = { teams: [], players: [] }

      // Extract team-level stats
      if (Array.isArray(boxscore.teams)) {
        for (const team of boxscore.teams) {
          const teamEntry = {
            team: team?.team?.displayName ?? "",
            logo: team?.team?.logo ?? undefined,
            stats: [] as Array<{ label: string; value: string }>,
          }
          if (Array.isArray(team?.statistics)) {
            for (const stat of team.statistics) {
              if (stat?.displayValue && stat?.label) {
                teamEntry.stats.push({ label: stat.label, value: stat.displayValue })
              }
            }
          }
          teamStats.teams.push(teamEntry)
        }
      }

      // Extract player stats
      if (Array.isArray(boxscore.players)) {
        for (const playerGroup of boxscore.players) {
          const teamName = playerGroup?.team?.displayName ?? ""
          const statistics = playerGroup?.statistics
          if (Array.isArray(statistics) && statistics.length > 0) {
            const statBlock = statistics[0] // Primary stat category
            const labels = statBlock?.labels ?? []
            const athletes: Array<{ name: string; position?: string; stats: string[] }> = []

            if (Array.isArray(statBlock?.athletes)) {
              for (const athlete of statBlock.athletes.slice(0, 10)) { // Top 10 players
                if (athlete?.athlete?.displayName) {
                  athletes.push({
                    name: athlete.athlete.displayName,
                    position: athlete.athlete.position?.abbreviation ?? undefined,
                    stats: athlete.stats ?? [],
                  })
                }
              }
            }

            if (athletes.length > 0) {
              teamStats.players.push({ team: teamName, labels, athletes })
            }
          }
        }
      }

      if (teamStats.teams.length > 0 || teamStats.players.length > 0) {
        summary.boxscore = teamStats
      }
    }
  } catch {
    summary.boxscore = undefined
  }

  return summary
}
