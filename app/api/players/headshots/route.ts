import { NextResponse } from "next/server"
import { cached } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * GET /api/players/headshots?names=Nikola+Jokic,Luka+Doncic&sport=NBA
 *
 * Batch headshot resolver. Given a comma-separated list of player names,
 * returns a map of { [name]: headshotUrl } for every name we can resolve.
 *
 * Designed for list views (e.g. rankings) where fetching one headshot per
 * player would fan out into dozens of requests. Does a single bulk lookup
 * against espn_players, then constructs ESPN CDN URLs for any players that
 * have an espn_id but no stored headshot_url.
 *
 * Cache-aside via Redis (24h TTL) — the resolved map is cached per sorted
 * set of names so repeat loads for the same ranking list are a cache hit.
 */

const HEADSHOT_CACHE_TTL = 86_400_000 // 24 hours
const MAX_NAMES = 250

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

interface PlayerRow {
  name: string | null
  espn_id: string | number | null
  headshot_url: string | null
  sport: string | null
}

function buildHeadshotUrl(espnId: string, sportKey: string): string {
  const pattern = HEADSHOT_PATTERNS[sportKey] ?? HEADSHOT_PATTERNS.nba
  return pattern.replace("{id}", espnId)
}

/** Normalize a name for fuzzy matching (lowercase, strip punctuation/accents). */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url)
  const namesParam = searchParams.get("names") ?? ""
  const sportParam = (searchParams.get("sport") ?? "NBA").toLowerCase()
  const sportKey = SPORT_KEY[sportParam] ?? "nba"

  const names = Array.from(
    new Set(
      namesParam
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n.length >= 2)
    )
  ).slice(0, MAX_NAMES)

  if (names.length === 0) {
    return NextResponse.json({ success: true, headshots: {} })
  }

  const cacheKey = `headshots:${sportKey}:${[...names].sort().join("|")}`

  try {
    const headshots = await cached(
      cacheKey,
      () => resolveHeadshots(names, sportKey),
      HEADSHOT_CACHE_TTL
    )
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
  const result: Record<string, string> = {}

  try {
    const supabase = createAdminClient()

    // Single bulk query: fetch every player row whose name matches any of the
    // requested names. We over-fetch with `in` on exact names, then fuzzy-match
    // in memory to tolerate small formatting differences.
    const { data, error } = await supabase
      .from("espn_players")
      .select("name, espn_id, headshot_url, sport")
      .in("name", names)

    let rows = error ? [] : data ?? []

    // For any names not matched exactly, do a second pass with ilike per missing
    // name (bounded — only the unresolved ones).
    const matchedExact = new Set(rows.map((r) => normalize((r as PlayerRow).name ?? "")))
    const missing = names.filter((n) => !matchedExact.has(normalize(n)))

    if (missing.length > 0) {
      const orFilter = missing
        .slice(0, 50)
        .map((n) => `name.ilike.%${n.replace(/[%,]/g, "")}%`)
        .join(",")
      if (orFilter) {
        const { data: fuzzy } = await supabase
          .from("espn_players")
          .select("name, espn_id, headshot_url, sport")
          .or(orFilter)
          .limit(200)
        if (fuzzy) rows = rows.concat(fuzzy)
      }
    }

    // Build a normalized-name -> url lookup from the fetched rows.
    const byName = new Map<string, string>()
    for (const row of rows as PlayerRow[]) {
      const url = row.headshot_url || (row.espn_id ? buildHeadshotUrl(String(row.espn_id), sportKey) : null)
      if (!url) continue
      const key = normalize(row.name ?? "")
      if (key && !byName.has(key)) byName.set(key, url)
    }

    for (const requested of names) {
      const norm = normalize(requested)
      let url = byName.get(norm)
      if (!url) {
        // Try last-name / substring match against fetched rows.
        for (const [key, candidate] of byName.entries()) {
          if (key === norm || key.includes(norm) || norm.includes(key)) {
            url = candidate
            break
          }
        }
      }
      if (url) result[requested] = url
    }
  } catch {
    // Best-effort — return whatever we resolved.
  }

  return result
}

export const GET = withSecurity(handleGET, {
  cacheControl: CACHE_CONTROL.IMMUTABLE,
})
