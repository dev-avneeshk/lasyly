import { LiveMatch } from "@/types"
import { fetchESPNScores } from "./espn"

/**
 * Fetch live scores from all configured sources.
 *
 * Primary source: ESPN (no API key required, covers NBA, NFL, EPL, La Liga, etc.)
 * Secondary source: api-sports.io (Football only, requires SPORTS_API_KEY)
 *
 * ESPN is always fetched. If SPORTS_API_KEY is also configured, football scores
 * from api-sports.io are merged in (they may have faster updates for some leagues).
 * Duplicates are avoided by preferring ESPN data.
 *
 * @param date - Optional date in YYYYMMDD format
 */
export async function fetchLiveScores(date?: string): Promise<LiveMatch[]> {
  const results = await Promise.allSettled([
    fetchESPNScores(date),
    fetchFootballApiScores(),
  ])

  const espnMatches = results[0].status === "fulfilled" ? results[0].value : []
  const footballMatches = results[1].status === "fulfilled" ? results[1].value : []

  // ESPN is primary — only add api-sports.io matches that don't overlap
  // (ESPN covers the same soccer leagues, so we deduplicate by team names)
  const espnTeamPairs = new Set(
    espnMatches.map((m) => `${m.homeTeam.toLowerCase()}|${m.awayTeam.toLowerCase()}`)
  )

  const uniqueFootball = footballMatches.filter((m) => {
    const pair = `${m.homeTeam.toLowerCase()}|${m.awayTeam.toLowerCase()}`
    return !espnTeamPairs.has(pair)
  })

  return [...espnMatches, ...uniqueFootball]
}

/**
 * Fetch from api-sports.io (Football only).
 * Returns empty array if no SPORTS_API_KEY is configured.
 */
async function fetchFootballApiScores(): Promise<LiveMatch[]> {
  const apiKey = process.env.SPORTS_API_KEY
  if (!apiKey) return []

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
      headers: { "x-apisports-key": apiKey },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) return []

    const json = await res.json()
    const fixtures = json.response ?? []

    return fixtures.slice(0, 50).map((fixture: Record<string, unknown>) => {
      const f = fixture as {
        fixture: { id: number; status: { short: string; elapsed: number | null } }
        league: { name: string }
        teams: { home: { name: string }; away: { name: string } }
        goals: { home: number | null; away: number | null }
      }

      return {
        id: `apisports-${f.fixture.id}`,
        homeTeam: f.teams.home.name,
        awayTeam: f.teams.away.name,
        homeScore: f.goals.home ?? 0,
        awayScore: f.goals.away ?? 0,
        clock: f.fixture.status.elapsed ? `${f.fixture.status.elapsed}'` : undefined,
        status: mapFootballStatus(f.fixture.status.short),
        league: f.league.name,
        sport: "Football",
      } satisfies LiveMatch
    })
  } catch {
    clearTimeout(timeout)
    return []
  }
}

function mapFootballStatus(short: string): LiveMatch["status"] {
  switch (short) {
    case "1H": return "First Half"
    case "HT": return "Halftime"
    case "2H": return "Second Half"
    case "FT": case "AET": case "PEN": return "Finished"
    case "PST": case "CANC": case "ABD": return "Postponed"
    default: return "Not Started"
  }
}
