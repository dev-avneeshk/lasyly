import { NextResponse } from "next/server"
import { cached } from "@/lib/cache"
import {
  isHeadshotNameMatch,
  normalizeHeadshotName,
} from "@/lib/players/headshotResolver"
import { withSecurity } from "@/lib/security/routeHelpers"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * GET /api/players/headshots?name=Nikola+Jokic&name=Luka+Doncic&sport=NBA
 *
 * Batch headshot resolver for list views. It checks persisted URLs first,
 * resolves active NBA players from one cached league-roster index, and uses a
 * small ESPN search fallback only for names absent from active rosters.
 */

const HEADSHOT_CACHE_TTL = 86_400_000 // 24 hours
const HEADSHOT_RESPONSE_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
const MAX_NAMES = 100
const MAX_NAME_LENGTH = 100
const MAX_CORE_SEARCHES = 5

const HEADSHOT_PATTERNS: Record<string, string> = {
  nba: "https://a.espncdn.com/i/headshots/nba/players/full/{id}.png",
  nfl: "https://a.espncdn.com/i/headshots/nfl/players/full/{id}.png",
  nhl: "https://a.espncdn.com/i/headshots/nhl/players/full/{id}.png",
  soccer: "https://a.espncdn.com/i/headshots/soccer/players/full/{id}.png",
}

const SPORT_KEY: Record<string, string> = {
  nba: "nba",
  basketball: "nba",
  nfl: "nfl",
  nhl: "nhl",
  soccer: "soccer",
}

const ESPN_SPORT_VALUES: Record<string, string> = {
  nba: "basketball",
  nfl: "football",
  nhl: "hockey",
  soccer: "soccer",
}

const NBA_TEAM_SLUGS = [
  "atl", "bos", "bkn", "cha", "chi", "cle", "dal", "den", "det", "gs",
  "hou", "ind", "lac", "lal", "mem", "mia", "mil", "min", "no", "ny",
  "okc", "orl", "phi", "phx", "por", "sac", "sa", "tor", "utah", "wsh",
] as const

interface PlayerRow {
  name: string | null
  espn_id: string | number | null
  headshot_url: string | null
}

interface NbaPlayerRow {
  player_name: string
  headshot_url: string | null
}

interface EspnAthlete {
  id?: string | number
  displayName?: string
  fullName?: string
  headshot?: { href?: string }
}

interface EspnRosterGroup extends EspnAthlete {
  items?: EspnAthlete[]
}

function buildHeadshotUrl(espnId: string, sportKey: string): string {
  const pattern = HEADSHOT_PATTERNS[sportKey] ?? HEADSHOT_PATTERNS.nba
  return pattern.replace("{id}", espnId)
}

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url)
  const repeatedNames = searchParams.getAll("name")
  const rawNames = repeatedNames.length > 0
    ? repeatedNames
    : (searchParams.get("names") ?? "").split(",")
  const sportParam = (searchParams.get("sport") ?? "NBA").toLowerCase()
  const sportKey = SPORT_KEY[sportParam] ?? "nba"
  const names = Array.from(
    new Set(rawNames.map((name) => name.trim()).filter((name) => name.length >= 2))
  )

  if (names.length === 0) {
    return NextResponse.json({ success: true, headshots: {} })
  }

  if (names.length > MAX_NAMES || names.some((name) => name.length > MAX_NAME_LENGTH)) {
    return NextResponse.json(
      { success: false, error: `Provide at most ${MAX_NAMES} names of ${MAX_NAME_LENGTH} characters or fewer.` },
      { status: 400 }
    )
  }

  try {
    const headshots = await resolveHeadshots(names, sportKey)
    return NextResponse.json({ success: true, headshots })
  } catch (error) {
    console.error("Batch headshot error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, headshots: {} }, { status: 500 })
  }
}

async function resolveHeadshots(
  names: string[],
  sportKey: string
): Promise<Record<string, string>> {
  const result = await resolveStoredHeadshots(names, sportKey)
  if (sportKey !== "nba") return result

  const unresolved = names.filter((name) => !result[name])
  if (unresolved.length === 0) return result

  Object.assign(result, await resolveFromNbaRosters(unresolved))

  const fallbackNames = names
    .filter((name) => !result[name])
    .slice(0, MAX_CORE_SEARCHES)
  const searched = await Promise.all(
    fallbackNames.map(async (name) => [name, await searchEspnNbaAthlete(name)] as const)
  )
  for (const [name, url] of searched) {
    if (url) result[name] = url
  }

  return result
}

async function resolveStoredHeadshots(
  names: string[],
  sportKey: string
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  const supabase = createAdminClient()

  if (sportKey === "nba") {
    const { data, error } = await supabase
      .from("nba_players")
      .select("player_name, headshot_url")
      .not("headshot_url", "is", null)
      .limit(1000)

    if (error) {
      console.error("NBA headshot lookup failed:", error.message)
    } else {
      for (const requested of names) {
        const match = (data as NbaPlayerRow[] | null)?.find((player) =>
          Boolean(player.headshot_url) && isHeadshotNameMatch(requested, player.player_name)
        )
        if (match?.headshot_url) result[requested] = match.headshot_url
      }
    }
  }

  const unresolved = names.filter((name) => !result[name])
  if (unresolved.length === 0) return result

  // Fetch the bounded provider index and match locally. This avoids building
  // PostgREST filter expressions from public query-string input.
  const providerSport = ESPN_SPORT_VALUES[sportKey] ?? sportKey
  const { data, error } = await supabase
    .from("espn_players")
    .select("name, espn_id, headshot_url")
    .eq("sport", providerSport)
    .limit(1000)

  if (error) {
    console.error("Stored ESPN headshot lookup failed:", error.message)
    return result
  }

  const rows = (data ?? []) as PlayerRow[]
  for (const requested of unresolved) {
    const match = rows.find((row) => isHeadshotNameMatch(requested, row.name ?? ""))
    if (!match) continue

    const url = match.headshot_url
      || (match.espn_id ? buildHeadshotUrl(String(match.espn_id), sportKey) : null)
    if (url) result[requested] = url
  }

  return result
}

async function resolveFromNbaRosters(names: string[]): Promise<Record<string, string>> {
  let athletes: EspnAthlete[]
  try {
    athletes = await cached(
      "headshots:provider:nba-rosters:v1",
      fetchNbaRosterAthletes,
      HEADSHOT_CACHE_TTL
    )
  } catch (error) {
    console.error("ESPN NBA roster lookup failed:", error instanceof Error ? error.message : error)
    return {}
  }

  const result: Record<string, string> = {}
  for (const requested of names) {
    const athlete = athletes.find((candidate) =>
      isHeadshotNameMatch(requested, candidate.displayName ?? candidate.fullName ?? "")
    )
    if (!athlete?.id) continue

    result[requested] = athlete.headshot?.href
      || buildHeadshotUrl(String(athlete.id), "nba")
  }

  return result
}

async function fetchNbaRosterAthletes(): Promise<EspnAthlete[]> {
  const rosterResults = await Promise.allSettled(
    NBA_TEAM_SLUGS.map(async (teamSlug) => {
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamSlug}/roster`,
        {
          signal: AbortSignal.timeout(5000),
          next: { revalidate: 86400 },
        }
      )
      if (!response.ok) throw new Error(`ESPN roster ${teamSlug}: ${response.status}`)

      const data = await response.json() as { athletes?: EspnRosterGroup[] }
      return (data.athletes ?? []).flatMap((group) =>
        group.items ?? (group.id ? [group] : [])
      )
    })
  )

  const successfulRosters = rosterResults.filter((result) => result.status === "fulfilled")
  if (successfulRosters.length < NBA_TEAM_SLUGS.length * 0.8) {
    throw new Error(`Only ${successfulRosters.length} of ${NBA_TEAM_SLUGS.length} NBA rosters loaded`)
  }

  return successfulRosters.flatMap((result) => result.value)
}

async function searchEspnNbaAthlete(playerName: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(normalizeHeadshotName(playerName))
    const response = await fetch(
      `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes?limit=5&search=${query}`,
      {
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 86400 },
      }
    )
    if (!response.ok) return null

    const data = await response.json() as { items?: Array<{ $ref?: string }> }
    for (const item of data.items ?? []) {
      const espnId = item.$ref?.match(/athletes\/(\d+)/)?.[1]
      if (!espnId) continue

      const detailResponse = await fetch(
        `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/${espnId}`,
        {
          signal: AbortSignal.timeout(3000),
          next: { revalidate: 86400 },
        }
      )
      if (!detailResponse.ok) continue

      const athlete = await detailResponse.json() as EspnAthlete
      const providerName = athlete.displayName ?? athlete.fullName ?? ""
      if (!isHeadshotNameMatch(playerName, providerName)) continue

      return athlete.headshot?.href || buildHeadshotUrl(espnId, "nba")
    }
  } catch {
    return null
  }

  return null
}

export const GET = withSecurity(handleGET, {
  cacheControl: HEADSHOT_RESPONSE_CACHE,
})
