import { NextResponse } from "next/server"
import { cached } from "@/lib/cache"
import {
  isHeadshotNameMatch,
  normalizeHeadshotName,
} from "@/lib/players/headshotResolver"
import { withSecurity } from "@/lib/security/routeHelpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchPagedParallel } from "@/lib/supabase/paged"
import {
  NBA_CDN_NAMESPACE,
  getStoredHeadshotIds,
  resolveHeadshotUrl,
  storedHeadshotUrl,
} from "@/lib/data/headshot-storage"
import { nbaIdForName } from "@/lib/players/nba-id"

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
    // Attach the cache header so the browser and CDN can reuse this response.
    // The constant was defined but never applied, so every request was
    // effectively uncacheable — the client had to use `no-store`. With the
    // header in place the client can `force-cache` and skip repeat round trips.
    return NextResponse.json(
      { success: true, headshots },
      { headers: { "Cache-Control": HEADSHOT_RESPONSE_CACHE } }
    )
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
    fallbackNames.map(async (name) => {
      // Wrapped so a miss (null) is cached too; cached() treats bare null as
      // "no entry" and would hit ESPN again on every request.
      const { url } = await cached(
        `headshots:provider:nba-search:v1:${normalizeHeadshotName(name)}`,
        async () => ({ url: await searchEspnNbaAthlete(name) }),
        HEADSHOT_CACHE_TTL
      )
      return [name, url] as const
    })
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

  // Best source for NBA: our own copy, keyed by NBA person id. Tried first
  // because it needs no query at all — the name maps to an id locally — and it is
  // the only option here that does not leave a third-party CDN in the render
  // path. This endpoint previously had no stored path for any sport.
  if (sportKey === "nba") {
    const storedNbaIds = await getStoredHeadshotIds(NBA_CDN_NAMESPACE)
    if (storedNbaIds.size > 0) {
      for (const requested of names) {
        const nbaId = nbaIdForName(requested)
        if (nbaId === null || !storedNbaIds.has(String(nbaId))) continue
        const url = storedHeadshotUrl(NBA_CDN_NAMESPACE, String(nbaId), "sm")
        if (url) result[requested] = url
      }
    }
  }

  if (sportKey === "nba" && names.some((n) => !result[n])) {
    // Paged: `.limit(1000)` was capped at 1000 rows by PostgREST regardless, so
    // any player past that point simply never matched.
    const rows = await fetchPagedParallel<NbaPlayerRow>(
      async () => {
        const { count } = await supabase
          .from("nba_players")
          .select("id", { count: "exact", head: true })
          .not("headshot_url", "is", null)
        return count ?? null
      },
      async (from, to) => {
        const { data, error } = await supabase
          .from("nba_players")
          .select("player_name, headshot_url")
          .not("headshot_url", "is", null)
          .order("id", { ascending: true })
          .range(from, to)
        if (error) {
          console.error("NBA headshot lookup failed:", error.message)
          return []
        }
        return (data ?? []) as NbaPlayerRow[]
      }
    )

    for (const requested of names) {
      if (result[requested]) continue
      const match = rows.find(
        (player) =>
          Boolean(player.headshot_url) && isHeadshotNameMatch(requested, player.player_name)
      )
      if (match?.headshot_url) result[requested] = match.headshot_url
    }
  }

  const unresolved = names.filter((name) => !result[name])
  if (unresolved.length === 0) return result

  // Fetch the provider index and match locally. Matching in memory rather than
  // filtering by name in the query is deliberate: it avoids building PostgREST
  // filter expressions out of public query-string input.
  //
  // Paged for the same reason as above — NFL has 2,913 rows under
  // sport="football", so the old `.limit(1000)` saw a third of them and the rest
  // fell through to the ESPN search fallback below (an outbound call per name)
  // even though they were sitting in the table.
  const providerSport = ESPN_SPORT_VALUES[sportKey] ?? sportKey
  const rows = await fetchPagedParallel<PlayerRow & { league: string | null }>(
    async () => {
      const { count } = await supabase
        .from("espn_players")
        .select("espn_id", { count: "exact", head: true })
        .eq("sport", providerSport)
      return count ?? null
    },
    async (from, to) => {
      const { data, error } = await supabase
        .from("espn_players")
        .select("name, espn_id, headshot_url, league")
        .eq("sport", providerSport)
        .order("espn_id", { ascending: true })
        .range(from, to)
      if (error) {
        console.error("Stored ESPN headshot lookup failed:", error.message)
        return []
      }
      return (data ?? []) as (PlayerRow & { league: string | null })[]
    }
  )

  // Stored-object index per league present in the result set. `league` is the
  // right key for both the bucket path and ESPN's URL path — `sport` is not
  // (the scraper writes sport="hockey" but ESPN's segment is "nhl").
  const leagues = [...new Set(rows.map((r) => String(r.league ?? "").toLowerCase()).filter(Boolean))]
  const storedByLeague = new Map<string, Set<string>>()
  await Promise.all(
    leagues.map(async (lg) => storedByLeague.set(lg, await getStoredHeadshotIds(lg)))
  )

  for (const requested of unresolved) {
    const match = rows.find((row) => isHeadshotNameMatch(requested, row.name ?? ""))
    if (!match) continue

    const league = String(match.league ?? "").toLowerCase()
    const url = league
      ? resolveHeadshotUrl(
          league,
          match.espn_id === null || match.espn_id === undefined ? null : String(match.espn_id),
          match.headshot_url,
          storedByLeague.get(league) ?? new Set<string>(),
          "sm"
        )
      : match.headshot_url
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
          cache: "no-store", // Redis (cached) holds this; Data Cache would bill an ISR write per URL
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
        cache: "no-store", // Redis (cached) holds this; Data Cache would bill an ISR write per URL
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
          cache: "no-store", // Redis (cached) holds this; Data Cache would bill an ISR write per URL
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
