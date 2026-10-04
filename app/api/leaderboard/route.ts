import { NextResponse } from "next/server"
import { withSecurity, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { getLeaderboard } from "@/lib/data/leaderboard"

export const GET = withSecurity(async (request: Request) => {
  const url = new URL(request.url)
  // Enum, so arbitrary values can't mint cache keys.
  const sortBy = url.searchParams.get("sort") === "total_picks" ? "total_picks" : "win_rate"

  return NextResponse.json(await getLeaderboard(sortBy))
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })
