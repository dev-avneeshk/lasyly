/**
 * POST /api/props/parlay
 *
 * Computes combined analytics for a set of parlay legs.
 * Accepts a list of prop legs, fetches game data and correlations,
 * then returns combined hit rate, correlation pairs, weak link, and per-leg flags.
 *
 * Requirements: 6.5, 6.6, 6.7, 6.8
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, validateRequestBody } from "@/lib/security/routeHelpers"
import {
  computeParlayStats,
  ParlayLeg,
  CorrelationPair,
} from "@/lib/analytics/parlay"

// ─── Request Validation ─────────────────────────────────────────────────────

const parlayLegSchema = z.object({
  propId: z.string().min(1).max(200),
  direction: z.enum(["over", "under"]),
})

const parlayRequestSchema = z.object({
  legs: z
    .array(parlayLegSchema)
    .min(1, "At least 1 leg is required")
    .max(10, "Maximum 10 legs allowed"),
})

type ParlayRequest = z.infer<typeof parlayRequestSchema>

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parses a propId into player name and stat key.
 * PropId format: "{player-name-kebab}-{stat}" e.g. "lebron-james-pts"
 * The stat is always the last segment after the final hyphen.
 */
function parsePropId(propId: string): { playerName: string; stat: string } | null {
  // Known stat keys that can appear at the end of a propId
  const knownStats = ["pts", "trb", "ast", "tp", "pra", "stl", "blk", "aces", "first_serve", "win_pct"]

  // Check for tennis-style propIds: "{player}-tennis-{stat}"
  const tennisMatch = propId.match(/^(.+)-tennis-(.+)$/)
  if (tennisMatch) {
    const playerKebab = tennisMatch[1]
    const stat = tennisMatch[2]
    const playerName = playerKebab.replace(/-/g, " ")
    return { playerName, stat }
  }

  // For NBA-style propIds, the stat is the last segment
  for (const stat of knownStats) {
    if (propId.endsWith(`-${stat}`)) {
      const playerKebab = propId.slice(0, propId.length - stat.length - 1)
      const playerName = playerKebab.replace(/-/g, " ")
      return { playerName, stat }
    }
  }

  return null
}

/**
 * Gets the stat value from an NBA player stats row.
 */
function getStatValue(
  row: { pts: number; trb: number; ast: number; tp: number; stl: number; blk: number },
  stat: string
): number {
  switch (stat) {
    case "pts": return row.pts ?? 0
    case "trb": return row.trb ?? 0
    case "ast": return row.ast ?? 0
    case "tp": return row.tp ?? 0
    case "stl": return row.stl ?? 0
    case "blk": return row.blk ?? 0
    case "pra": return (row.pts ?? 0) + (row.trb ?? 0) + (row.ast ?? 0)
    default: return 0
  }
}

/**
 * Computes the L10 hit rate for a set of game values against a prop line.
 */
function computeL10HitRate(values: number[], propLine: number): number {
  const l10 = values.slice(0, 10)
  if (l10.length === 0) return 0
  const overCount = l10.filter((v) => v >= propLine).length
  return (overCount / l10.length) * 100
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export const POST = withSecurity(async (request: Request) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  // Validate request body
  const [data, errorResponse] = validateRequestBody<ParlayRequest>(body, parlayRequestSchema)
  if (errorResponse) return errorResponse

  const supabase = createAdminClient()

  // Parse all propIds and group by sport
  const parsedLegs = data.legs.map((leg) => ({
    ...leg,
    parsed: parsePropId(leg.propId),
  }))

  const invalidLegs = parsedLegs.filter((l) => !l.parsed)
  if (invalidLegs.length > 0) {
    return NextResponse.json(
      {
        error: "Invalid propId format",
        invalidPropIds: invalidLegs.map((l) => l.propId),
      },
      { status: 400 }
    )
  }

  // Build ParlayLeg objects by fetching game data for each leg
  const parlayLegs: ParlayLeg[] = []

  for (const leg of parsedLegs) {
    const { playerName, stat } = leg.parsed!
    const isTennis = leg.propId.includes("-tennis-")

    if (isTennis) {
      // Tennis props don't have per-game data in the same way
      // Use tennis_serve_stats as available data points
      const { data: tennisData } = await supabase
        .from("tennis_serve_stats")
        .select("stat_year, aces_per_match, first_serve_pct")
        .ilike("player_name", playerName)
        .order("stat_year", { ascending: false })
        .limit(20)

      const gameData: { date: string; value: number }[] = (tennisData ?? []).map((row) => {
        let value = 0
        if (stat === "aces") value = Number(row.aces_per_match ?? 0)
        else if (stat === "first_serve") value = Number(row.first_serve_pct ?? 0)
        return { date: String(row.stat_year), value }
      })

      // Compute a prop line from median of values
      const values = gameData.map((g) => g.value)
      const propLine = values.length > 0
        ? values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
        : 0

      const l10HitRate = computeL10HitRate(values, propLine)

      parlayLegs.push({
        propId: leg.propId,
        player: playerName,
        statCategory: stat,
        propLine,
        direction: leg.direction,
        l10HitRate,
        gameData,
      })
    } else {
      // NBA: fetch player game stats with game dates
      const { data: playerStats } = await supabase
        .from("nba_player_stats")
        .select("pts, trb, ast, tp, stl, blk, game_id")
        .ilike("player_name", playerName)
        .limit(20)

      if (!playerStats || playerStats.length === 0) {
        // Player not found, add with empty data
        parlayLegs.push({
          propId: leg.propId,
          player: playerName,
          statCategory: stat,
          propLine: 0,
          direction: leg.direction,
          l10HitRate: 0,
          gameData: [],
        })
        continue
      }

      // Fetch game dates for these stats
      const gameIds = Array.from(new Set(playerStats.map((r) => r.game_id)))
      const { data: gamesData } = await supabase
        .from("nba_games")
        .select("id, game_date")
        .in("id", gameIds.slice(0, 100))

      const gameDateMap = new Map<string, string>()
      for (const g of gamesData ?? []) {
        gameDateMap.set(g.id, g.game_date)
      }

      // Build game data sorted by date descending
      const gameData: { date: string; value: number }[] = playerStats
        .filter((row) => gameDateMap.has(row.game_id))
        .map((row) => ({
          date: gameDateMap.get(row.game_id)!,
          value: getStatValue(row, stat),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))

      // Compute prop line from median of values
      const values = gameData.map((g) => g.value)
      const sortedValues = [...values].sort((a, b) => a - b)
      const propLine = sortedValues.length > 0
        ? sortedValues[Math.floor(sortedValues.length / 2)]
        : 0

      const l10HitRate = computeL10HitRate(values, propLine)

      parlayLegs.push({
        propId: leg.propId,
        player: playerName,
        statCategory: stat,
        propLine,
        direction: leg.direction,
        l10HitRate,
        gameData,
      })
    }
  }

  // Fetch correlation data for all leg pairs from correlations_cache
  const propIds = parlayLegs.map((l) => l.propId)
  const correlations: CorrelationPair[] = []

  if (propIds.length >= 2) {
    // Build prop identifiers for correlation lookup
    // Correlations are stored as "{player}-{stat}" format
    const propIdentifiers = parlayLegs.map((l) => `${l.player}-${l.statCategory}`)

    // Query correlations where both prop_a and prop_b are in our set
    const { data: correlationData } = await supabase
      .from("correlations_cache")
      .select("prop_a, prop_b, coefficient")
      .in("prop_a", propIdentifiers)
      .in("prop_b", propIdentifiers)

    if (correlationData) {
      for (const row of correlationData) {
        // Map correlation identifiers back to propIds
        const legA = parlayLegs.find(
          (l) => `${l.player}-${l.statCategory}` === row.prop_a
        )
        const legB = parlayLegs.find(
          (l) => `${l.player}-${l.statCategory}` === row.prop_b
        )

        if (legA && legB) {
          correlations.push({
            propA: legA.propId,
            propB: legB.propId,
            coefficient: Number(row.coefficient),
          })
        }
      }
    }
  }

  // Compute parlay stats
  const result = computeParlayStats(parlayLegs, correlations)

  return NextResponse.json(result)
})
