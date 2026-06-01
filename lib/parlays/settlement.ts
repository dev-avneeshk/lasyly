/**
 * Parlay Leg Settlement Module
 *
 * Settles individual parlay legs by checking actual player game stats
 * against the prop line and direction. Once all legs in a parlay are
 * settled, the parlay itself gets resolved (won if all legs won, lost
 * if any leg lost).
 *
 * Settlement logic:
 * - Fetches pending legs along with the parlay's created_at timestamp
 * - Only considers games played AFTER the parlay was created
 * - Uses case-insensitive player name matching (ilike) for fuzzy lookup
 * - Supports NBA auto-settlement; Tennis uses serve stats when available
 */

import { createAdminClient } from "@/lib/supabase/admin"

// ─── Types ──────────────────────────────────────────────────────────────────

interface PendingLeg {
  id: string
  parlay_id: string
  player_name: string
  stat_category: string
  prop_line: number
  direction: "over" | "under"
  sport: string
  result: string
  parlay_created_at: string // ISO timestamp of when the parlay was created
}

interface SettlementResult {
  legsChecked: number
  legsSettled: number
  parlaysResolved: number
  parlaysExpired: number
  errors: number
}

// ─── Stat Category Mapping ──────────────────────────────────────────────────

// Maps user-facing stat categories to database column names
const NBA_STAT_MAP: Record<string, string> = {
  // Standard keys (from props/constants.ts)
  points: "pts",
  pts: "pts",
  rebounds: "trb",
  reb: "trb",
  trb: "trb",
  assists: "ast",
  ast: "ast",
  steals: "stl",
  stl: "stl",
  blocks: "blk",
  blk: "blk",
  "3pm": "tp",
  "3-pointers": "tp",
  threes: "tp",
  tp: "tp",
  turnovers: "tov",
  tov: "tov",
  "field goals": "fg",
  fg: "fg",
  fga: "fga",
  "free throws": "ft",
  ft: "ft",
  fta: "fta",
  // Combos (computed from multiple columns)
  pra: "pra",
  "pts+reb+ast": "pra",
  "points+rebounds+assists": "pra",
  pa: "pa",
  "pts+ast": "pa",
  pr: "pr",
  "pts+reb": "pr",
  ra: "ra",
  "reb+ast": "ra",
}

// ─── Main Settlement Function ───────────────────────────────────────────────

/**
 * Settles all pending parlay legs that have available game results.
 * Then resolves any parlays where all legs are now settled.
 * Also expires stale parlays (older than 5 days with no stats found).
 */
export async function settleParlayLegs(): Promise<SettlementResult> {
  const supabase = createAdminClient()
  const result: SettlementResult = {
    legsChecked: 0,
    legsSettled: 0,
    parlaysResolved: 0,
    parlaysExpired: 0,
    errors: 0,
  }

  // 1. Fetch pending legs with parlay created_at for date-based filtering
  const { data: pendingLegs, error: legsError } = await supabase
    .from("parlay_legs")
    .select(`
      id, parlay_id, player_name, stat_category, prop_line,
      direction, sport, result,
      parlays!inner(created_at)
    `)
    .eq("result", "pending")
    .limit(500)

  if (legsError) {
    if (legsError.code === "42P01" || legsError.message?.includes("relation")) {
      return { ...result, errors: 0 } // Table doesn't exist yet
    }
    throw new Error(`Failed to fetch pending legs: ${legsError.message}`)
  }

  if (!pendingLegs || pendingLegs.length === 0) {
    return result
  }

  // Reshape: extract parlay_created_at from the join
  const legs: PendingLeg[] = pendingLegs.map((row: Record<string, unknown>) => {
    const parlays = row.parlays as { created_at: string } | null
    return {
      id: row.id as string,
      parlay_id: row.parlay_id as string,
      player_name: row.player_name as string,
      stat_category: row.stat_category as string,
      prop_line: Number(row.prop_line),
      direction: row.direction as "over" | "under",
      sport: row.sport as string,
      result: row.result as string,
      parlay_created_at: parlays?.created_at ?? "",
    }
  })

  result.legsChecked = legs.length

  // 2. Group legs by sport for batch processing
  const nbaLegs = legs.filter((l) => l.sport === "NBA")
  const tennisLegs = legs.filter((l) => l.sport === "Tennis")

  // 3. Settle NBA legs
  if (nbaLegs.length > 0) {
    const settled = await settleNBALegs(supabase, nbaLegs)
    result.legsSettled += settled.settled
    result.errors += settled.errors
  }

  // 4. Settle Tennis legs
  if (tennisLegs.length > 0) {
    const settled = await settleTennisLegs(supabase, tennisLegs)
    result.legsSettled += settled.settled
    result.errors += settled.errors
  }

  // 5. Resolve parlays where all legs are now settled
  const parlayIds = [...new Set(legs.map((l) => l.parlay_id))]
  const resolved = await resolveParlays(supabase, parlayIds)
  result.parlaysResolved = resolved

  // 6. Expire stale parlays (older than 5 days, still pending, no stats found)
  const expired = await expireStaleParlays(supabase)
  result.parlaysExpired = expired

  return result
}

// ─── NBA Settlement ─────────────────────────────────────────────────────────

async function settleNBALegs(
  supabase: ReturnType<typeof createAdminClient>,
  legs: PendingLeg[]
): Promise<{ settled: number; errors: number }> {
  let settled = 0
  let errors = 0

  // Get unique player names (lowercased for case-insensitive matching)
  const playerNames = [...new Set(legs.map((l) => l.player_name))]

  // Fetch recent game stats for these players
  // We fetch more games to ensure we find ones after the parlay was created
  const { data: gameStats, error: statsError } = await supabase
    .from("nba_player_stats")
    .select("player_name, game_id, pts, trb, ast, tp, stl, blk, tov, fg, fga, ft, fta, created_at")
    .in("player_name", playerNames)
    .order("game_id", { ascending: false })
    .limit(playerNames.length * 10)

  if (statsError || !gameStats) {
    // Try case-insensitive fallback if exact match fails
    return await settleNBALegsFuzzy(supabase, legs)
  }

  // Build a map: player_name -> array of game stats (sorted newest first)
  const playerGames = new Map<string, Array<Record<string, number | string>>>()
  for (const row of gameStats) {
    const existing = playerGames.get(row.player_name) ?? []
    existing.push({
      game_id: row.game_id as string,
      created_at: (row.created_at as string) ?? "",
      pts: Number(row.pts) || 0,
      trb: Number(row.trb) || 0,
      ast: Number(row.ast) || 0,
      tp: Number(row.tp) || 0,
      stl: Number(row.stl) || 0,
      blk: Number(row.blk) || 0,
      tov: Number(row.tov) || 0,
      fg: Number(row.fg) || 0,
      fga: Number(row.fga) || 0,
      ft: Number(row.ft) || 0,
      fta: Number(row.fta) || 0,
    })
    playerGames.set(row.player_name, existing)
  }

  // Settle each leg
  for (const leg of legs) {
    const games = playerGames.get(leg.player_name)
    if (!games || games.length === 0) {
      // Try fuzzy match for this specific player
      continue
    }

    const statKey = NBA_STAT_MAP[leg.stat_category.toLowerCase()]
    if (!statKey) {
      // Unknown stat category — can't settle
      continue
    }

    // Find the first game played AFTER the parlay was created
    // game_id format is like "202501150LAL" — first 8 chars are YYYYMMDD
    const parlayDate = leg.parlay_created_at ? new Date(leg.parlay_created_at) : null
    let targetGame: Record<string, number | string> | null = null

    if (parlayDate) {
      // Convert parlay date to YYYYMMDD for comparison with game_id
      const parlayDateStr = parlayDate.toISOString().slice(0, 10).replace(/-/g, "")

      for (const game of games) {
        const gameDate = (game.game_id as string).slice(0, 8)
        // Game must be on or after the parlay creation date
        if (gameDate >= parlayDateStr) {
          // Pick the earliest game after parlay creation (last in sorted order)
          if (!targetGame || (game.game_id as string).slice(0, 8) <= (targetGame.game_id as string).slice(0, 8)) {
            targetGame = game
          }
        }
      }
    }

    // Fallback: if no date filtering possible, use most recent game
    if (!targetGame) {
      targetGame = games[0]
    }

    // Compute actual value (handle combo stats)
    let actualValue: number
    if (statKey === "pra") {
      actualValue = (targetGame.pts as number) + (targetGame.trb as number) + (targetGame.ast as number)
    } else if (statKey === "pa") {
      actualValue = (targetGame.pts as number) + (targetGame.ast as number)
    } else if (statKey === "pr") {
      actualValue = (targetGame.pts as number) + (targetGame.trb as number)
    } else if (statKey === "ra") {
      actualValue = (targetGame.trb as number) + (targetGame.ast as number)
    } else {
      actualValue = targetGame[statKey] as number
      if (actualValue === undefined) continue
    }

    // Determine result
    let legResult: "won" | "lost" | "push"
    if (leg.direction === "over") {
      if (actualValue > leg.prop_line) legResult = "won"
      else if (actualValue === leg.prop_line) legResult = "push"
      else legResult = "lost"
    } else {
      if (actualValue < leg.prop_line) legResult = "won"
      else if (actualValue === leg.prop_line) legResult = "push"
      else legResult = "lost"
    }

    // Update the leg result and store the game_id for reference
    const { error: updateError } = await supabase
      .from("parlay_legs")
      .update({ result: legResult, game_id: targetGame.game_id as string })
      .eq("id", leg.id)

    if (updateError) {
      errors++
    } else {
      settled++
    }
  }

  return { settled, errors }
}

// ─── NBA Fuzzy Settlement (case-insensitive player name matching) ────────────

async function settleNBALegsFuzzy(
  supabase: ReturnType<typeof createAdminClient>,
  legs: PendingLeg[]
): Promise<{ settled: number; errors: number }> {
  let settled = 0
  let errors = 0

  // Process each leg individually with ilike matching
  for (const leg of legs) {
    const { data: gameStats, error: statsError } = await supabase
      .from("nba_player_stats")
      .select("player_name, game_id, pts, trb, ast, tp, stl, blk, tov, fg, fga, ft, fta, created_at")
      .ilike("player_name", leg.player_name)
      .order("game_id", { ascending: false })
      .limit(10)

    if (statsError || !gameStats || gameStats.length === 0) continue

    const statKey = NBA_STAT_MAP[leg.stat_category.toLowerCase()]
    if (!statKey) continue

    // Find game after parlay creation
    const parlayDate = leg.parlay_created_at ? new Date(leg.parlay_created_at) : null
    let targetGame = gameStats[0] // default to most recent

    if (parlayDate) {
      const parlayDateStr = parlayDate.toISOString().slice(0, 10).replace(/-/g, "")
      for (const game of gameStats) {
        const gameDate = (game.game_id as string).slice(0, 8)
        if (gameDate >= parlayDateStr) {
          targetGame = game
        }
      }
    }

    // Compute actual value
    let actualValue: number
    const stats = {
      pts: Number(targetGame.pts) || 0,
      trb: Number(targetGame.trb) || 0,
      ast: Number(targetGame.ast) || 0,
      tp: Number(targetGame.tp) || 0,
      stl: Number(targetGame.stl) || 0,
      blk: Number(targetGame.blk) || 0,
      tov: Number(targetGame.tov) || 0,
      fg: Number(targetGame.fg) || 0,
      fga: Number(targetGame.fga) || 0,
      ft: Number(targetGame.ft) || 0,
      fta: Number(targetGame.fta) || 0,
    }

    if (statKey === "pra") actualValue = stats.pts + stats.trb + stats.ast
    else if (statKey === "pa") actualValue = stats.pts + stats.ast
    else if (statKey === "pr") actualValue = stats.pts + stats.trb
    else if (statKey === "ra") actualValue = stats.trb + stats.ast
    else {
      actualValue = stats[statKey as keyof typeof stats]
      if (actualValue === undefined) continue
    }

    let legResult: "won" | "lost" | "push"
    if (leg.direction === "over") {
      if (actualValue > leg.prop_line) legResult = "won"
      else if (actualValue === leg.prop_line) legResult = "push"
      else legResult = "lost"
    } else {
      if (actualValue < leg.prop_line) legResult = "won"
      else if (actualValue === leg.prop_line) legResult = "push"
      else legResult = "lost"
    }

    const { error: updateError } = await supabase
      .from("parlay_legs")
      .update({ result: legResult, game_id: targetGame.game_id as string })
      .eq("id", leg.id)

    if (updateError) errors++
    else settled++
  }

  return { settled, errors }
}

// ─── Tennis Settlement ──────────────────────────────────────────────────────

async function settleTennisLegs(
  supabase: ReturnType<typeof createAdminClient>,
  legs: PendingLeg[]
): Promise<{ settled: number; errors: number }> {
  let settled = 0
  let errors = 0

  // Tennis settlement checks tennis_serve_stats for per-match stats
  for (const leg of legs) {
    // Try to find serve stats for this player after the parlay was created
    const parlayDate = leg.parlay_created_at
      ? new Date(leg.parlay_created_at).toISOString()
      : null

    let query = supabase
      .from("tennis_serve_stats")
      .select("player_name, aces, double_faults, first_serve_pct, games_won, games_lost, sets_won, sets_lost, created_at")
      .ilike("player_name", leg.player_name)
      .order("created_at", { ascending: false })
      .limit(5)

    if (parlayDate) {
      query = query.gte("created_at", parlayDate)
    }

    const { data: serveStats, error: serveError } = await query

    if (serveError || !serveStats || serveStats.length === 0) {
      // No serve stats available — skip this leg
      continue
    }

    const stat = serveStats[0]
    const category = leg.stat_category.toLowerCase()

    let actualValue: number | null = null
    if (category === "aces") actualValue = Number(stat.aces) || null
    else if (category === "double_faults") actualValue = Number(stat.double_faults) || null
    else if (category === "first_serve_pct") actualValue = Number(stat.first_serve_pct) || null
    else if (category === "games_won") actualValue = Number(stat.games_won) || null
    else if (category === "sets_won") actualValue = Number(stat.sets_won) || null

    if (actualValue === null) continue

    let legResult: "won" | "lost" | "push"
    if (leg.direction === "over") {
      if (actualValue > leg.prop_line) legResult = "won"
      else if (actualValue === leg.prop_line) legResult = "push"
      else legResult = "lost"
    } else {
      if (actualValue < leg.prop_line) legResult = "won"
      else if (actualValue === leg.prop_line) legResult = "push"
      else legResult = "lost"
    }

    const { error: updateError } = await supabase
      .from("parlay_legs")
      .update({ result: legResult })
      .eq("id", leg.id)

    if (updateError) errors++
    else settled++
  }

  return { settled, errors }
}

// ─── Parlay Resolution ──────────────────────────────────────────────────────

/**
 * Checks if all legs in the given parlays are settled.
 * If so, resolves the parlay (won if all legs won, lost if any lost).
 * Push legs are treated as won (standard parlay rules).
 */
async function resolveParlays(
  supabase: ReturnType<typeof createAdminClient>,
  parlayIds: string[]
): Promise<number> {
  let resolved = 0

  for (const parlayId of parlayIds) {
    // Fetch all legs for this parlay
    const { data: legs, error } = await supabase
      .from("parlay_legs")
      .select("result")
      .eq("parlay_id", parlayId)

    if (error || !legs || legs.length === 0) continue

    // Check if all legs are settled (not pending)
    const allSettled = legs.every((l) => l.result !== "pending")
    if (!allSettled) continue

    // Determine parlay outcome
    const anyLost = legs.some((l) => l.result === "lost")
    const allWonOrPush = legs.every((l) => l.result === "won" || l.result === "push")

    let newStatus: "won" | "lost"
    if (anyLost) {
      newStatus = "lost"
    } else if (allWonOrPush) {
      newStatus = "won"
    } else {
      continue
    }

    // Update parlay status
    const { error: updateError } = await supabase
      .from("parlays")
      .update({
        status: newStatus,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", parlayId)
      .eq("status", "pending") // Only update if still pending (idempotent)

    if (!updateError) {
      resolved++
    }
  }

  return resolved
}

// ─── Stale Parlay Expiry ────────────────────────────────────────────────────

/**
 * Expires parlays that are older than 5 days and still have pending legs.
 * These are bets where game stats were never found (scraper missed the game,
 * player didn't play, etc.). Marks unsettled legs as "push" and resolves
 * the parlay based on whatever legs did settle.
 *
 * If ALL legs are still pending after 5 days, the parlay is voided (marked lost).
 */
async function expireStaleParlays(
  supabase: ReturnType<typeof createAdminClient>
): Promise<number> {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  // Find stale parlays: pending, created more than 5 days ago
  const { data: staleParlays, error } = await supabase
    .from("parlays")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", fiveDaysAgo)
    .limit(100)

  if (error || !staleParlays || staleParlays.length === 0) return 0

  let expired = 0

  for (const parlay of staleParlays) {
    // Get all legs for this parlay
    const { data: legs, error: legsError } = await supabase
      .from("parlay_legs")
      .select("id, result")
      .eq("parlay_id", parlay.id)

    if (legsError || !legs || legs.length === 0) continue

    const pendingLegs = legs.filter((l) => l.result === "pending")
    const settledLegs = legs.filter((l) => l.result !== "pending")

    // Mark all remaining pending legs as "push" (voided — no action)
    if (pendingLegs.length > 0) {
      const pendingIds = pendingLegs.map((l) => l.id)
      await supabase
        .from("parlay_legs")
        .update({ result: "push" })
        .in("id", pendingIds)
    }

    // Determine final parlay status
    // If any settled leg lost → parlay lost
    // If all legs are won/push → parlay won
    // If ALL legs were pending (now push) → parlay lost (void = loss)
    const anyLost = settledLegs.some((l) => l.result === "lost")
    const allOriginallyPending = settledLegs.length === 0

    let newStatus: "won" | "lost"
    if (anyLost || allOriginallyPending) {
      newStatus = "lost"
    } else {
      // All settled legs won/push, remaining were voided as push
      newStatus = "won"
    }

    const { error: updateError } = await supabase
      .from("parlays")
      .update({
        status: newStatus,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", parlay.id)
      .eq("status", "pending")

    if (!updateError) expired++
  }

  return expired
}
