/**
 * NBA headshot URL resolution for prop cards.
 *
 * This used to live inline in /api/props, positioned *after* the `cached()` call
 * that wraps the actual prop computation. That placement was the problem: it ran
 * on every single request, including ones that hit the cache and did no
 * computation at all. Each run cost a Supabase lookup plus, for any player
 * missing from the DB, up to six outbound ESPN roster fetches with a 4-second
 * timeout apiece — so a request that should have been a sub-100ms cache hit
 * could still block for seconds.
 *
 * Resolution is now cached as a whole, keyed by the set of players asked about,
 * so a repeat request costs one Redis GET.
 */

import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { cached } from "@/lib/cache"

/** Headshots are roster-stable; a day is a safe hold. */
const HEADSHOT_TTL_MS = 24 * 60 * 60_000

/** Cap on outbound ESPN roster calls per resolution, to bound worst-case latency. */
const MAX_ROSTER_FETCHES = 6

/** Timeout for a single ESPN roster call. */
const ROSTER_TIMEOUT_MS = 4000

/** NBA team abbreviation → ESPN roster URL slug (they disagree on several). */
const NBA_SLUG: Record<string, string> = {
  atl: "atl", bos: "bos", bkn: "bkn", cha: "cha", chi: "chi",
  cle: "cle", dal: "dal", den: "den", det: "det", gsw: "gs",
  hou: "hou", ind: "ind", lac: "lac", lal: "lal", mem: "mem",
  mia: "mia", mil: "mil", min: "min", nop: "no", nyk: "ny",
  okc: "okc", orl: "orl", phi: "phi", phx: "phx", por: "por",
  sac: "sac", sas: "sa", tor: "tor", uta: "utah", was: "wsh",
}

export interface HeadshotSubject {
  player: string
  team?: string | null
}

/**
 * Resolve `player name → headshot URL` for the given players.
 *
 * Missing players simply have no entry; callers should treat absence as "fall
 * back to initials". Never throws — headshots are cosmetic and must not be able
 * to fail a props response.
 */
export async function resolveNBAHeadshots(
  subjects: HeadshotSubject[]
): Promise<Record<string, string>> {
  const names = [...new Set(subjects.map((s) => s.player))].sort()
  if (names.length === 0) return {}

  // The name set is the cache identity. Hashing keeps the key bounded — a 50-prop
  // response would otherwise produce a multi-kilobyte Redis key.
  const fingerprint = createHash("sha1")
    .update(names.join("\u0000"))
    .digest("hex")
    .slice(0, 16)

  try {
    return await cached(
      `nba-headshots:${fingerprint}`,
      () => resolveUncached(subjects, names),
      HEADSHOT_TTL_MS
    )
  } catch {
    return {}
  }
}

async function resolveUncached(
  subjects: HeadshotSubject[],
  names: string[]
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}

  try {
    const supabase = createAdminClient()

    // Preferred source: our own roster table (indexed on name).
    const { data: playerRows } = await supabase
      .from("espn_players")
      .select("name, espn_id, headshot_url")
      .in("name", names)

    for (const row of (playerRows ?? []) as any[]) {
      if (!row.name) continue
      const url =
        row.headshot_url ||
        (row.espn_id
          ? `https://a.espncdn.com/i/headshots/nba/players/full/${row.espn_id}.png`
          : null)
      if (url) out[row.name] = url
    }

    // Fallback for players we don't have: ask ESPN for the team roster.
    const missing = names.filter((n) => !out[n])
    if (missing.length === 0) return out

    const missingSet = new Set(missing)
    const teamPlayers = new Map<string, string[]>()
    for (const subject of subjects) {
      if (!missingSet.has(subject.player)) continue
      const team = (subject.team ?? "").toLowerCase()
      if (!teamPlayers.has(team)) teamPlayers.set(team, [])
      teamPlayers.get(team)!.push(subject.player)
    }

    const teamEntries = [...teamPlayers.entries()].slice(0, MAX_ROSTER_FETCHES)
    await Promise.allSettled(
      teamEntries.map(async ([teamAbbr, players]) => {
        const slug = NBA_SLUG[teamAbbr] ?? teamAbbr
        const athletes = await cached<any[]>(
          `nba-roster:${slug}`,
          async () => {
            const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${slug}/roster`
            const res = await fetch(url, {
              signal: AbortSignal.timeout(ROSTER_TIMEOUT_MS),
            })
            if (!res.ok) return []
            const data = await res.json()
            const result: any[] = []
            for (const group of data.athletes ?? []) {
              if (group.items) result.push(...group.items)
              else if (group.id) result.push(group)
            }
            return result
          },
          HEADSHOT_TTL_MS
        )

        for (const athlete of athletes) {
          const displayName: string = athlete.displayName ?? athlete.fullName ?? ""
          const displayLower = displayName.toLowerCase()
          const lastNameESPN = displayLower.split(" ").pop() ?? ""
          for (const p of players) {
            if (out[p]) continue
            const pLower = p.toLowerCase()
            const lastNameP = pLower.split(" ").pop() ?? ""
            if (pLower === displayLower || lastNameP === lastNameESPN) {
              out[p] = `https://a.espncdn.com/i/headshots/nba/players/full/${String(athlete.id)}.png`
            }
          }
        }
      })
    )
  } catch {
    // Non-critical — props render fine without headshots.
  }

  return out
}
