import { NextResponse } from "next/server"
import { getScoresForDate, isValidYYYYMMDD } from "@/lib/data/scores"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { rateLimited } from "@/lib/rateLimit"
import { getClientIp } from "@/lib/security/clientIp"
import { RATE_LIMIT_UNAUTHENTICATED } from "@/lib/security/constants"

/**
 * GET /api/scores?date=YYYYMMDD&sport=Football
 *
 * Thin route handler; all the DB-first ESPN fallback logic lives in
 * `lib/data/scores.ts` so server components can share it without going
 * through HTTP.
 *
 * This path is excluded from the proxy matcher (see proxy.ts) so CDN-cached
 * polls don't pay for a proxy run. The per-IP limit the proxy used to apply
 * lives here instead, so it only runs on a CDN miss.
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

  const limited = await rateLimited(`scores:ip:${getClientIp(request)}`, RATE_LIMIT_UNAUTHENTICATED)
  if (limited) return limited

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
