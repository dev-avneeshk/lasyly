import { NextResponse } from "next/server"
import { getScoresForDate, isValidYYYYMMDD } from "@/lib/data/scores"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"

/**
 * GET /api/scores?date=YYYYMMDD&sport=Football
 *
 * Thin route handler; all the DB-first ESPN fallback logic lives in
 * `lib/data/scores.ts` so server components can share it without going
 * through HTTP.
 */

export const revalidate = 10

async function handleGET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sportFilter = searchParams.get("sport")
  const dateParam = searchParams.get("date")

  if (dateParam && !isValidYYYYMMDD(dateParam)) {
    return NextResponse.json(
      { error: "Invalid date format. Expected YYYYMMDD.", success: false },
      { status: 400 }
    )
  }

  try {
    const { data, meta } = await getScoresForDate(dateParam, sportFilter)
    return NextResponse.json(
      { data, success: true, meta },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch live scores"
    console.error("Scores API error:", message)
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    )
  }
}

export const GET = withSecurity(handleGET, {
  cacheControl: CACHE_CONTROL.PUBLIC_SHORT,
})
