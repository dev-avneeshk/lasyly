import { NextResponse } from "next/server"
import { getExpertsLeaderboard } from "@/lib/data/expertsLeaderboard"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { SPORT_FILTERS } from "@/app/(app)/marketplace/TipstersClient"

// Allowed categories mirror the marketplace sport chips. An enum, so arbitrary
// values can't mint new cache keys.
const CATEGORIES = SPORT_FILTERS

export const GET = withSecurity(async (request: Request) => {
  const url = new URL(request.url)
  const raw = url.searchParams.get("category")
  // Coerce unknown/malformed categories to "All"; never return 400 for this.
  const category = CATEGORIES.find((c) => c === raw) ?? "All"

  // Defense-in-depth: reject injection patterns in the raw value.
  const injectionCheck = checkQueryParams({ category: raw })
  if (injectionCheck) return injectionCheck

  return NextResponse.json(await getExpertsLeaderboard(category))
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })
