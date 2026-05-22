/**
 * GET /api/props/correlations
 *
 * Returns top correlated props for a given propId from the correlations_cache table.
 * Filters to correlations with coefficient > 0.5, ordered by coefficient descending,
 * limited to top 10 results.
 *
 * Query Parameters:
 *   - propId (required): The prop identifier (e.g., "LeBron James-pts")
 *
 * Response:
 *   { correlations: CorrelatedProp[], meta: { propId, computedAt } }
 *
 * Requirements: 5.2
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { CorrelatedProp } from "@/lib/analytics/types"

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const propId = searchParams.get("propId")

  if (!propId) {
    return NextResponse.json(
      { error: "Missing required query parameter: propId" },
      { status: 400 }
    )
  }

  // Check for injection patterns
  const injectionCheck = checkQueryParams({ propId })
  if (injectionCheck) return injectionCheck

  const supabase = createAdminClient()

  // Query correlations_cache where prop_a or prop_b matches the propId
  // and coefficient > 0.5, ordered by coefficient descending, limit 10
  const { data, error } = await supabase
    .from("correlations_cache")
    .select("prop_a, prop_b, coefficient, computed_at")
    .or(`prop_a.eq.${propId},prop_b.eq.${propId}`)
    .gt("coefficient", 0.5)
    .order("coefficient", { ascending: false })
    .limit(10)

  if (error) {
    console.error("Error fetching correlations:", error)
    return NextResponse.json(
      { error: "Failed to fetch correlations" },
      { status: 500 }
    )
  }

  // Map results to CorrelatedProp[] format
  const correlations: CorrelatedProp[] = (data ?? []).map((row) => {
    // The correlated prop is the one that isn't the queried propId
    const correlatedPropId = row.prop_a === propId ? row.prop_b : row.prop_a
    const { player, statCategory } = parsePropIdentifier(correlatedPropId)

    return {
      propId: correlatedPropId,
      player,
      statCategory,
      coefficient: Number(row.coefficient),
    }
  })

  // Determine computedAt from the most recent row, or current time if no data
  const computedAt = data && data.length > 0
    ? data[0].computed_at
    : new Date().toISOString()

  return NextResponse.json({
    correlations,
    meta: {
      propId,
      computedAt,
    },
  })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parses a prop identifier (e.g., "LeBron James-pts") into player name and stat category.
 * The format is "{player_name}-{stat_key}" where player_name may contain spaces/hyphens.
 * We split on the last hyphen to handle names with hyphens (e.g., "Shai Gilgeous-Alexander-pts").
 */
function parsePropIdentifier(propId: string): { player: string; statCategory: string } {
  const lastHyphenIndex = propId.lastIndexOf("-")

  if (lastHyphenIndex === -1) {
    return { player: propId, statCategory: "" }
  }

  const player = propId.substring(0, lastHyphenIndex)
  const statCategory = propId.substring(lastHyphenIndex + 1)

  return { player, statCategory }
}
