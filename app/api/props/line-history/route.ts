/**
 * GET /api/props/line-history
 *
 * Returns line history for chart rendering, plus current line and 24h change.
 * Accepts player, stat, sport (default "NBA"), and days (default 7) query parameters.
 * Caps at 100 data points.
 *
 * Requirements: 8.4, 8.5
 */

import { NextResponse } from "next/server"
import { getLineHistory, getLineMovement } from "@/lib/analytics/line-movement"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const player = searchParams.get("player")
  const stat = searchParams.get("stat")
  const sport = (searchParams.get("sport") ?? "NBA") as "NBA" | "Tennis"
  const daysParam = searchParams.get("days")
  const days = daysParam ? Math.max(1, Math.min(parseInt(daysParam, 10) || 7, 90)) : 7

  // Validate required params
  if (!player || !stat) {
    return NextResponse.json(
      {
        error: "Missing required query parameters: player and stat are required.",
        code: "MISSING_PARAMS",
      },
      { status: 400 }
    )
  }

  // Check for injection patterns
  const injectionCheck = checkQueryParams({ player, stat, sport: searchParams.get("sport") })
  if (injectionCheck) return injectionCheck

  // Validate sport value
  if (sport !== "NBA" && sport !== "Tennis") {
    return NextResponse.json(
      {
        error: "Invalid sport parameter. Must be 'NBA' or 'Tennis'.",
        code: "INVALID_PARAM",
      },
      { status: 400 }
    )
  }

  // Fetch line history and movement data
  const [history, movement] = await Promise.all([
    getLineHistory(player, stat, sport, days),
    getLineMovement(player, stat, sport),
  ])

  return NextResponse.json({
    history,
    currentLine: movement?.currentLine ?? null,
    change24h: movement?.change ?? null,
    direction: movement?.direction ?? null,
    hasSignificantMove: movement?.hasSignificantMove ?? false,
  })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })
