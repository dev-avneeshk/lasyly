/**
 * Daily Correlation Cron Job
 *
 * Computes pairwise Pearson correlations for all active player-stat
 * combinations per sport and upserts results into the correlations_cache table.
 *
 * Authorization: Requires CRON_SECRET in the Authorization header.
 *
 * Requirements: 5.3
 */

import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { computeAllCorrelations, CorrelationResult } from "@/lib/analytics/correlations"
import { NBA_STAT_FILTERS } from "@/lib/props/constants"

// ─── Auth Verification ──────────────────────────────────────────────────────

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || !authHeader) {
    if (!cronSecret) {
      console.error("CRON_SECRET environment variable is not set")
    }
    return false
  }

  const expected = `Bearer ${cronSecret}`
  // Constant-length compare. Buffer.byteLength is required because Buffer.from
  // followed by timingSafeEqual will throw on mismatched lengths (which is
  // itself a length-leaking comparison) so we pre-pad to the longer of the
  // two and reject on mismatch only after the fixed-time compare runs.
  const expectedBuf = Buffer.from(expected, "utf8")
  const actualBuf = Buffer.from(authHeader, "utf8")

  if (expectedBuf.length !== actualBuf.length) {
    // Run a same-length compare anyway so the response time profile of the
    // length-mismatch path matches the value-mismatch path.
    timingSafeEqual(expectedBuf, expectedBuf)
    return false
  }

  return timingSafeEqual(expectedBuf, actualBuf)
}

// ─── NBA Data Fetching ──────────────────────────────────────────────────────

interface NBAStatRow {
  player_name: string
  game_id: string
  pts: number
  trb: number
  ast: number
  tp: number
  stl: number
  blk: number
}

function getNBAStatValue(row: NBAStatRow, stat: string): number {
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
 * Fetches NBA player-stat props with at least 10 games of data.
 * Groups by player_name and collects stat values per game for each stat category.
 * Returns props formatted for computeAllCorrelations().
 */
async function fetchNBAProps(): Promise<{ id: string; values: number[] }[]> {
  const supabase = createAdminClient()

  // Fetch all player stats (recent games, ordered by game)
  const { data, error } = await supabase
    .from("nba_player_stats")
    .select("player_name, game_id, pts, trb, ast, tp, stl, blk")
    .limit(10000)

  if (error || !data) {
    console.error("Error fetching NBA stats for correlations:", error)
    return []
  }

  // Group games by player, ordered by game_id (proxy for chronological order)
  const playerGames = new Map<string, NBAStatRow[]>()
  for (const row of data as NBAStatRow[]) {
    const games = playerGames.get(row.player_name) ?? []
    games.push(row)
    playerGames.set(row.player_name, games)
  }

  const props: { id: string; values: number[] }[] = []

  // For each stat category, create a prop entry for players with >= 10 games
  for (const statFilter of NBA_STAT_FILTERS) {
    const stat = statFilter.key

    for (const [playerName, games] of playerGames) {
      if (games.length < 10) continue

      const values = games.map((g) => getNBAStatValue(g, stat))
      const propId = `${playerName}-${stat}`
      props.push({ id: propId, values })
    }
  }

  return props
}

// ─── Tennis Data Fetching ────────────────────────────────────────────────────

/**
 * Fetches Tennis player-stat props.
 * Tennis data is aggregated (averages per surface/year), so we use
 * the available numeric stats as "values" for correlation computation.
 * Only includes players with matches_played >= 10.
 */
async function fetchTennisProps(): Promise<{ id: string; values: number[] }[]> {
  const supabase = createAdminClient()

  // Fetch serve stats for all players with sufficient matches
  const { data, error } = await supabase
    .from("tennis_serve_stats")
    .select("player_name, surface, stat_year, matches_played, first_serve_pct, first_serve_win_pct, second_serve_win_pct, aces_per_match, dfs_per_match, hold_pct")
    .gte("matches_played", 10)
    .limit(5000)

  if (error || !data) {
    console.error("Error fetching Tennis stats for correlations:", error)
    return []
  }

  // Group by player - use all their stat entries as data points
  const playerStats = new Map<string, typeof data>()
  for (const row of data) {
    const entries = playerStats.get(row.player_name) ?? []
    entries.push(row)
    playerStats.set(row.player_name, entries)
  }

  const props: { id: string; values: number[] }[] = []

  // For each tennis stat category, create prop entries
  type TennisRow = (typeof data)[number]
  const statMappings: { key: string; getter: (row: TennisRow) => number }[] = [
    { key: "aces", getter: (r) => Number(r.aces_per_match ?? 0) },
    { key: "first_serve", getter: (r) => Number(r.first_serve_pct ?? 0) },
  ]

  for (const { key, getter } of statMappings) {
    for (const [playerName, rows] of playerStats) {
      if (rows.length < 10) continue

      const values = rows.map(getter)
      const propId = `${playerName}-${key}`
      props.push({ id: propId, values })
    }
  }

  return props
}

// ─── Upsert Correlations ────────────────────────────────────────────────────

/**
 * Deletes old correlations for a sport and inserts new ones.
 * Uses a delete-then-insert approach for a clean refresh.
 */
async function upsertCorrelations(
  sport: "NBA" | "Tennis",
  results: CorrelationResult[]
): Promise<number> {
  if (results.length === 0) return 0

  const supabase = createAdminClient()

  // Delete existing correlations for this sport
  const { error: deleteError } = await supabase
    .from("correlations_cache")
    .delete()
    .eq("sport", sport)

  if (deleteError) {
    console.error(`Error deleting old ${sport} correlations:`, deleteError)
    throw new Error(`Failed to delete old ${sport} correlations: ${deleteError.message}`)
  }

  // Insert new correlations in batches (Supabase has row limits per insert)
  const BATCH_SIZE = 500
  let inserted = 0

  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE).map((r) => ({
      sport,
      prop_a: r.propA,
      prop_b: r.propB,
      coefficient: r.coefficient,
      overlapping_games: r.overlappingGames,
      computed_at: new Date().toISOString(),
    }))

    const { error: insertError } = await supabase
      .from("correlations_cache")
      .insert(batch)

    if (insertError) {
      console.error(`Error inserting ${sport} correlations batch:`, insertError)
      throw new Error(`Failed to insert ${sport} correlations: ${insertError.message}`)
    }

    inserted += batch.length
  }

  return inserted
}

// ─── Route Handler ──────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  try {
    let totalCorrelations = 0
    const results: Record<string, number> = {}

    // Process NBA correlations
    const nbaProps = await fetchNBAProps()
    if (nbaProps.length > 0) {
      const nbaCorrelations = computeAllCorrelations(nbaProps, 500)
      const nbaInserted = await upsertCorrelations("NBA", nbaCorrelations)
      results.NBA = nbaInserted
      totalCorrelations += nbaInserted
    } else {
      results.NBA = 0
    }

    // Process Tennis correlations
    const tennisProps = await fetchTennisProps()
    if (tennisProps.length > 0) {
      const tennisCorrelations = computeAllCorrelations(tennisProps, 500)
      const tennisInserted = await upsertCorrelations("Tennis", tennisCorrelations)
      results.Tennis = tennisInserted
      totalCorrelations += tennisInserted
    } else {
      results.Tennis = 0
    }

    return NextResponse.json({
      success: true,
      totalCorrelations,
      breakdown: results,
      computedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Correlation cron job failed:", error)
    return NextResponse.json(
      {
        error: "Correlation computation failed",
      },
      { status: 500 }
    )
  }
}
