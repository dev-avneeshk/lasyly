import { NextResponse } from "next/server"
import { fetchESPNSummary, getLeagueSportPath } from "@/lib/services/espn"
import { cached } from "@/lib/cache"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { createAdminClient } from "@/lib/supabase/admin"

const SUMMARY_CACHE_TTL = 30_000 // 30 seconds

async function handleGET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params

  if (!eventId || eventId.length > 20) {
    return NextResponse.json(
      { error: "Invalid event ID", success: false },
      { status: 400 }
    )
  }

  // Determine sport path from query param or try common paths
  const { searchParams } = new URL(request.url)
  const league = searchParams.get("league")
  const sportPath = league ? getLeagueSportPath(league) : undefined

  // Try fetching with known sport path, or try common ones
  const pathsToTry = sportPath
    ? [sportPath]
    : ["basketball/nba", "football/nfl", "soccer/eng.1", "basketball/wnba", "soccer/usa.1"]

  try {
    const summary = await cached(
      `summary:${eventId}`,
      async () => {
        // First check if we have it stored in DB
        try {
          const supabase = createAdminClient()
          const { data: stored } = await supabase
            .from("matches")
            .select("raw_data")
            .like("event_id", `%${eventId}%`)
            .not("raw_data", "is", null)
            .limit(1)
            .single()

          if (stored?.raw_data) {
            return stored.raw_data
          }
        } catch {
          // DB lookup failed, continue to ESPN
        }

        // Fetch from ESPN
        for (const path of pathsToTry) {
          try {
            const result = await fetchESPNSummary(path, eventId)

            // Store in DB for permanent history (fire and forget)
            storeSummaryInDB(eventId, result).catch(() => {})

            return result
          } catch {
            continue
          }
        }
        throw new Error("Could not fetch summary from any sport path")
      },
      SUMMARY_CACHE_TTL
    )

    return NextResponse.json(
      { data: summary, success: true },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch match summary"
    console.error("Summary API error:", message)
    return NextResponse.json(
      { error: "Failed to fetch match details from ESPN", success: false },
      { status: 502 }
    )
  }
}

/**
 * Store summary data in the matches table's raw_data column for permanent history.
 */
async function storeSummaryInDB(eventId: string, summary: unknown): Promise<void> {
  const supabase = createAdminClient()

  // Find the match by event_id and store the summary
  await supabase
    .from("matches")
    .update({ raw_data: summary, updated_at: new Date().toISOString() })
    .eq("event_id", eventId)
}

export const GET = withSecurity(handleGET, {
  cacheControl: CACHE_CONTROL.PUBLIC_SHORT,
})
