import { NextResponse } from "next/server"
import { cached } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * GET /api/injuries?team=LAL
 *
 * Fetches NBA injury data from ESPN's public API.
 * Optionally filters by team abbreviation.
 * Cached for 5 minutes.
 */

const INJURIES_CACHE_TTL = 300_000 // 5 minutes

interface InjuryPlayer {
  name: string
  position: string
  status: string
  date: string
  comment: string
  headshot: string | null
  team: string
  teamAbbr: string
}

interface TeamInjuries {
  team: string
  teamAbbr: string
  logo: string | null
  injuries: InjuryPlayer[]
}

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url)
  const teamFilter = searchParams.get("team")?.toUpperCase()

  try {
    const allInjuries = await cached("nba:injuries:all", async () => {
      const res = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries",
        { headers: { "Accept": "application/json" } }
      )

      if (!res.ok) {
        throw new Error(`ESPN API returned ${res.status}`)
      }

      const data = await res.json()
      const teams: TeamInjuries[] = []

      for (const teamGroup of data.injuries ?? []) {
        const teamName = teamGroup.displayName ?? "Unknown"
        const teamInjuries: InjuryPlayer[] = []

        for (const injury of teamGroup.injuries ?? []) {
          const athlete = injury.athlete
          if (!athlete) continue

          const abbr = athlete.team?.abbreviation ?? ""
          const logo = athlete.team?.logos?.[0]?.href ?? null

          teamInjuries.push({
            name: athlete.displayName ?? `${athlete.firstName} ${athlete.lastName}`,
            position: athlete.position?.abbreviation ?? athlete.position?.displayName ?? "—",
            status: injury.status ?? "Unknown",
            date: injury.date ? new Date(injury.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
            comment: injury.shortComment ?? injury.longComment ?? "",
            headshot: athlete.headshot?.href ?? null,
            team: teamName,
            teamAbbr: abbr,
          })

          // Set team-level data from first injury's athlete
          if (teamInjuries.length === 1) {
            teams.push({
              team: teamName,
              teamAbbr: abbr,
              logo,
              injuries: teamInjuries,
            })
          }
        }

        // If we already pushed the team, update its injuries reference
        const existing = teams.find((t) => t.team === teamName)
        if (existing) {
          existing.injuries = teamInjuries
        } else if (teamInjuries.length > 0) {
          teams.push({
            team: teamName,
            teamAbbr: teamInjuries[0].teamAbbr,
            logo: null,
            injuries: teamInjuries,
          })
        }
      }

      return teams
    }, INJURIES_CACHE_TTL)

    // Filter by team if requested
    let result = allInjuries
    if (teamFilter) {
      // Handle common abbreviation mismatches (props use 3-letter, ESPN uses 2-letter for some)
      const teamAliases: Record<string, string[]> = {
        SA: ["SA", "SAS"], SAS: ["SA", "SAS"],
        GS: ["GS", "GSW"], GSW: ["GS", "GSW"],
        NY: ["NY", "NYK"], NYK: ["NY", "NYK"],
        NO: ["NO", "NOP"], NOP: ["NO", "NOP"],
        UTAH: ["UTAH", "UTA"], UTA: ["UTAH", "UTA"],
        WSH: ["WSH", "WAS"], WAS: ["WSH", "WAS"],
      }
      const aliases = teamAliases[teamFilter] ?? [teamFilter]

      result = allInjuries.filter(
        (t) => aliases.includes(t.teamAbbr.toUpperCase()) || t.team.toLowerCase().includes(teamFilter.toLowerCase())
      )
    }

    // Flatten for easier consumption
    const flatInjuries = result.flatMap((t) => t.injuries)

    return NextResponse.json({
      success: true,
      injuries: flatInjuries,
      teams: result,
      total: flatInjuries.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch injuries"
    console.error("Injuries API error:", message)
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    )
  }
}

export const GET = withSecurity(handleGET, {
  cacheControl: CACHE_CONTROL.PUBLIC_SHORT,
})
