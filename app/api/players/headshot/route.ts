import { NextResponse } from "next/server"
import { cached } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * GET /api/players/headshot?name=Victor+Wembanyama&team=SAS&sport=NBA
 *
 * Looks up a player's ESPN headshot. Supports all sports:
 * - NBA: basketball headshots
 * - NFL: football headshots
 * - NHL: hockey headshots
 * - Soccer: soccer headshots
 *
 * Strategy:
 * 1. Check espn_players table for the player's ESPN ID (fastest, covers all sports)
 * 2. Fall back to ESPN roster API search (NBA/NFL/NHL)
 * 3. Fall back to ESPN core search API
 *
 * Cached for 24 hours.
 */

const HEADSHOT_CACHE_TTL = 86_400_000 // 24 hours

// ESPN headshot URL patterns per sport
const HEADSHOT_PATTERNS: Record<string, string> = {
  nba: "https://a.espncdn.com/i/headshots/nba/players/full/{id}.png",
  nfl: "https://a.espncdn.com/i/headshots/nfl/players/full/{id}.png",
  nhl: "https://a.espncdn.com/i/headshots/nhl/players/full/{id}.png",
  soccer: "https://a.espncdn.com/i/headshots/soccer/players/full/{id}.png",
  mls: "https://a.espncdn.com/i/headshots/soccer/players/full/{id}.png",
}

// Map sport display names to ESPN sport/league paths
const SPORT_CONFIG: Record<string, { espnSport: string; espnLeague: string; headshotKey: string }> = {
  nba: { espnSport: "basketball", espnLeague: "nba", headshotKey: "nba" },
  basketball: { espnSport: "basketball", espnLeague: "nba", headshotKey: "nba" },
  nfl: { espnSport: "football", espnLeague: "nfl", headshotKey: "nfl" },
  "american football": { espnSport: "football", espnLeague: "nfl", headshotKey: "nfl" },
  nhl: { espnSport: "hockey", espnLeague: "nhl", headshotKey: "nhl" },
  hockey: { espnSport: "hockey", espnLeague: "nhl", headshotKey: "nhl" },
  soccer: { espnSport: "soccer", espnLeague: "eng.1", headshotKey: "soccer" },
  football: { espnSport: "soccer", espnLeague: "eng.1", headshotKey: "soccer" },
}

// NBA team abbreviation to ESPN slug
const NBA_TEAM_SLUG_MAP: Record<string, string> = {
  atl: "atl", bos: "bos", bkn: "bkn", cha: "cha", chi: "chi",
  cle: "cle", dal: "dal", den: "den", det: "det", gsw: "gs",
  hou: "hou", ind: "ind", lac: "lac", lal: "lal", mem: "mem",
  mia: "mia", mil: "mil", min: "min", nop: "no", nyk: "ny",
  okc: "okc", orl: "orl", phi: "phi", phx: "phx", por: "por",
  sac: "sac", sas: "sa", tor: "tor", uta: "utah", was: "wsh",
  gs: "gs", sa: "sa", ny: "ny", no: "no",
}

// NHL team name to ESPN team ID
const NHL_TEAM_SLUG_MAP: Record<string, string> = {
  "carolina hurricanes": "car", "florida panthers": "fla", "dallas stars": "dal",
  "edmonton oilers": "edm", "new york rangers": "nyr", "winnipeg jets": "wpg",
  "colorado avalanche": "col", "vegas golden knights": "vgk", "toronto maple leafs": "tor",
  "boston bruins": "bos", "new jersey devils": "njd", "tampa bay lightning": "tbl",
  "los angeles kings": "la", "minnesota wild": "min", "vancouver canucks": "van",
  "new york islanders": "nyi", "ottawa senators": "ott", "detroit red wings": "det",
  "nashville predators": "nsh", "st. louis blues": "stl", "seattle kraken": "sea",
  "pittsburgh penguins": "pit", "washington capitals": "wsh", "calgary flames": "cgy",
  "philadelphia flyers": "phi", "montreal canadiens": "mtl", "buffalo sabres": "buf",
  "arizona coyotes": "ari", "utah hockey club": "utah", "columbus blue jackets": "cbj",
  "chicago blackhawks": "chi", "anaheim ducks": "ana", "san jose sharks": "sj",
  hurricanes: "car", panthers: "fla", stars: "dal", oilers: "edm", rangers: "nyr",
  jets: "wpg", avalanche: "col", "golden knights": "vgk", "maple leafs": "tor",
  bruins: "bos", devils: "njd", lightning: "tbl", kings: "la", wild: "min",
  canucks: "van", islanders: "nyi", senators: "ott", "red wings": "det",
  predators: "nsh", blues: "stl", kraken: "sea", penguins: "pit", capitals: "wsh",
  flames: "cgy", flyers: "phi", canadiens: "mtl", sabres: "buf", coyotes: "ari",
  "blue jackets": "cbj", blackhawks: "chi", ducks: "ana", sharks: "sj",
}

function buildHeadshotUrl(espnId: string, sportKey: string): string {
  const pattern = HEADSHOT_PATTERNS[sportKey] ?? HEADSHOT_PATTERNS.nba
  return pattern.replace("{id}", espnId)
}

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url)
  const playerName = searchParams.get("name")
  const team = searchParams.get("team")
  const sportParam = (searchParams.get("sport") ?? "NBA").toLowerCase()

  if (!playerName || playerName.length < 2) {
    return NextResponse.json(
      { error: "Query parameter 'name' is required (min 2 chars)", success: false },
      { status: 400 }
    )
  }

  const sportConfig = SPORT_CONFIG[sportParam] ?? SPORT_CONFIG.nba

  try {
    const cacheKey = `headshot:${playerName.toLowerCase()}:${(team ?? "").toLowerCase()}:${sportParam}`

    const result = await cached(cacheKey, async () => {
      // ─── Strategy 1: Check our espn_players table (fastest, all sports) ────
      const dbResult = await searchDatabase(playerName, team, sportConfig.headshotKey)
      if (dbResult) return dbResult

      // ─── Strategy 2: ESPN team roster API ─────────────────────────────────
      if (team) {
        const rosterResult = await searchRoster(playerName, team, sportConfig)
        if (rosterResult) return rosterResult
      }

      // ─── Strategy 3: ESPN core search API ────────────────────────────────
      // Used as final fallback — slower but works for players not on roster pages
      const searchResult = await searchESPNCore(playerName, sportConfig)
      if (searchResult) return searchResult

      return null
    }, HEADSHOT_CACHE_TTL)

    if (!result) {
      return NextResponse.json({ success: false, error: "Player not found", headshot: null }, { status: 404 })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Headshot fetch error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Failed to fetch headshot", success: false }, { status: 500 })
  }
}

// ─── Strategy 1: Database lookup ────────────────────────────────────────────

async function searchDatabase(
  playerName: string,
  team: string | null,
  sportKey: string
): Promise<{ espnId: string; headshot: string; headshotCropped: string } | null> {
  try {
    const supabase = createAdminClient()

    // First, check if this is a team name (for team props) — search espn_teams
    const { data: teamData } = await supabase
      .from("espn_teams")
      .select("espn_id, name, logo_url")
      .ilike("name", `%${playerName}%`)
      .limit(3)

    if (teamData && teamData.length > 0) {
      const searchLower = playerName.toLowerCase()
      const teamMatch = teamData.find((t: any) => (t.name ?? "").toLowerCase() === searchLower) ?? teamData[0]
      if (teamMatch?.logo_url) {
        return {
          espnId: teamMatch.espn_id ?? "",
          headshot: teamMatch.logo_url,
          headshotCropped: teamMatch.logo_url,
        }
      }
    }

    // Search espn_players by name (case-insensitive)
    let query = supabase
      .from("espn_players")
      .select("espn_id, name, headshot_url, sport")
      .ilike("name", `%${playerName}%`)
      .limit(5)

    const { data, error } = await query

    if (error || !data || data.length === 0) return null

    // Find best match
    const searchLower = playerName.toLowerCase()
    const match = data.find((p) => {
      const name = (p.name ?? "").toLowerCase()
      return name === searchLower || name.includes(searchLower) || searchLower.includes(name)
    }) ?? data[0]

    if (!match) return null

    const espnId = match.espn_id
    // Use stored headshot_url if available, otherwise construct from ESPN ID
    const headshot = match.headshot_url || buildHeadshotUrl(espnId, sportKey)

    return {
      espnId,
      headshot,
      headshotCropped: `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(headshot)}&h=80&w=110&scale=crop`,
    }
  } catch {
    return null
  }
}

// ─── Strategy 2: ESPN Roster API ────────────────────────────────────────────

async function searchRoster(
  playerName: string,
  team: string,
  config: { espnSport: string; espnLeague: string; headshotKey: string }
): Promise<{ espnId: string; headshot: string; headshotCropped: string } | null> {
  try {
    // For NBA, map team abbreviation to ESPN slug
    let teamSlug = team.toLowerCase()
    if (config.espnLeague === "nba") {
      teamSlug = NBA_TEAM_SLUG_MAP[teamSlug] ?? teamSlug
    } else if (config.espnLeague === "nhl") {
      teamSlug = NHL_TEAM_SLUG_MAP[teamSlug] ?? teamSlug
    } else if (config.espnLeague === "nfl") {
      // NFL teams from ESPN data use full names
      const nflMap: Record<string, string> = {
        "kansas city chiefs": "kc", "buffalo bills": "buf", "baltimore ravens": "bal",
        "san francisco 49ers": "sf", "detroit lions": "det", "dallas cowboys": "dal",
        "philadelphia eagles": "phi", "miami dolphins": "mia", "green bay packers": "gb",
        "cleveland browns": "cle", "houston texans": "hou", "jacksonville jaguars": "jax",
        "pittsburgh steelers": "pit", "los angeles rams": "lar", "seattle seahawks": "sea",
        "cincinnati bengals": "cin", "minnesota vikings": "min", "tampa bay buccaneers": "tb",
        "new york jets": "nyj", "new york giants": "nyg", "los angeles chargers": "lac",
        "indianapolis colts": "ind", "denver broncos": "den", "atlanta falcons": "atl",
        "new orleans saints": "no", "chicago bears": "chi", "arizona cardinals": "ari",
        "washington commanders": "wsh", "tennessee titans": "ten", "carolina panthers": "car",
        "new england patriots": "ne", "las vegas raiders": "lv",
      }
      teamSlug = nflMap[teamSlug] ?? teamSlug
    }

    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/${config.espnSport}/${config.espnLeague}/teams/${teamSlug}/roster`
    const res = await fetch(rosterUrl, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 86400 }, // Cache roster for 24h
    })
    if (!res.ok) return null

    const rosterData = await res.json()
    const athletes = rosterData.athletes ?? []
    const searchLower = playerName.toLowerCase()
    const searchLast = searchLower.split(" ").pop() ?? ""

    // Athletes might be grouped by position or flat
    const allAthletes: any[] = []
    for (const group of athletes) {
      if (group.items) {
        allAthletes.push(...group.items)
      } else if (group.id) {
        allAthletes.push(group)
      }
    }

    for (const athlete of allAthletes) {
      const name = (athlete.displayName ?? athlete.fullName ?? "").toLowerCase()
      const lastName = (athlete.lastName ?? "").toLowerCase()

      if (name === searchLower || name.includes(searchLower) || searchLower.includes(name) || lastName === searchLast) {
        const espnId = String(athlete.id)
        const headshot = buildHeadshotUrl(espnId, config.headshotKey)
        return {
          espnId,
          headshot,
          headshotCropped: `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(headshot)}&h=80&w=110&scale=crop`,
        }
      }
    }

    return null
  } catch {
    return null
  }
}

// ─── Strategy 3: ESPN Core Search API ───────────────────────────────────────

async function searchESPNCore(
  playerName: string,
  config: { espnSport: string; espnLeague: string; headshotKey: string }
): Promise<{ espnId: string; headshot: string; headshotCropped: string } | null> {
  try {
    const searchUrl = `https://sports.core.api.espn.com/v2/sports/${config.espnSport}/leagues/${config.espnLeague}/athletes?limit=5&search=${encodeURIComponent(playerName)}`
    const res = await fetch(searchUrl, {
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null

    const data = await res.json()
    const items = data.items ?? []
    if (items.length === 0) return null

    // Extract ESPN ID from the $ref URL
    for (const item of items) {
      const ref = (item.$ref ?? "") as string
      const idMatch = ref.match(/athletes\/(\d+)/)
      if (!idMatch) continue

      const espnId = idMatch[1]

      // Verify name match by fetching athlete detail
      try {
        const detailRes = await fetch(
          `https://sports.core.api.espn.com/v2/sports/${config.espnSport}/leagues/${config.espnLeague}/athletes/${espnId}`,
          { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } }
        )
        if (!detailRes.ok) continue

        const detail = await detailRes.json()
        const fullName = (detail.displayName ?? "").toLowerCase()
        const searchLower = playerName.toLowerCase()
        const lastNameSearch = searchLower.split(" ").pop() ?? ""
        const lastNameResult = fullName.split(" ").pop() ?? ""

        if (fullName === searchLower || fullName.includes(searchLower) || lastNameSearch === lastNameResult) {
          const headshot = buildHeadshotUrl(espnId, config.headshotKey)
          return {
            espnId,
            headshot,
            headshotCropped: `https://a.espncdn.com/combiner/i?img=${encodeURIComponent(headshot)}&h=80&w=110&scale=crop`,
          }
        }
      } catch {
        continue
      }
    }

    return null
  } catch {
    return null
  }
}

export const GET = withSecurity(handleGET, {
  cacheControl: CACHE_CONTROL.IMMUTABLE,
})
