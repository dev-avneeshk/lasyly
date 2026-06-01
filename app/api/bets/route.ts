import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { SupabaseClient } from "@supabase/supabase-js"

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createBetSchema = z.object({
  playerName: z.string().min(1).max(200),
  sport: z.enum(["NBA", "Tennis"]),
  statCategory: z.string().min(1).max(100),
  propLine: z.number().gt(0).lte(999.5),
  direction: z.enum(["over", "under"]),
  confidenceScore: z.number().int().min(1).max(5),
  matchupGrade: z.enum(["A", "B", "C", "D", "F"]).optional(),
  odds: z.number().int().min(-10000).max(10000).optional(),
  stake: z.number().min(0.01).max(99999.99).optional(),
  isMonitored: z.boolean().optional().default(false),
})

// Valid stat categories per sport for bet_tracker
const VALID_BET_STATS: Record<string, string[]> = {
  NBA: ["pts", "trb", "ast", "tp", "fg", "fga", "ft", "fta", "stl", "blk", "tov", "pra"],
  Tennis: ["aces", "double_faults", "win_pct", "first_serve_pct", "sets_won", "games_won"],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert American odds to decimal odds.
 * Positive odds: (odds / 100) + 1
 * Negative odds: (100 / |odds|) + 1
 */
function americanToDecimal(odds: number): number {
  if (odds >= 0) {
    return (odds / 100) + 1
  }
  return (100 / Math.abs(odds)) + 1
}

// ─── GET /api/bets ───────────────────────────────────────────────────────────

export const GET = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to view bets." },
      { status: 401 }
    )
  }

  const url = new URL(request.url)
  const sport = url.searchParams.get("sport")
  const stat = url.searchParams.get("stat")
  const minConfidence = url.searchParams.get("minConfidence")
  const page = url.searchParams.get("page")
  const limit = url.searchParams.get("limit")

  // Check for injection patterns
  const injectionCheck = checkQueryParams({ sport, stat, minConfidence, page, limit })
  if (injectionCheck) return injectionCheck

  // Pagination defaults
  const pageNum = Math.max(1, parseInt(page || "1", 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(limit || "50", 10) || 50))
  const offset = (pageNum - 1) * pageSize

  // Build query - RLS ensures only user's bets are returned
  let query = supabase
    .from("bet_tracker")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (sport) {
    query = query.eq("sport", sport)
  }
  if (stat) {
    query = query.eq("stat_category", stat)
  }
  if (minConfidence) {
    const minConf = parseInt(minConfidence, 10)
    if (!isNaN(minConf) && minConf >= 1 && minConf <= 5) {
      query = query.gte("confidence_score", minConf)
    }
  }

  // Fetch paginated bets and stats in parallel
  const [betsResult, statsResult] = await Promise.all([
    query,
    fetchBetStats(supabase, user.id),
  ])

  if (betsResult.error) {
    return NextResponse.json({ error: "Failed to fetch bets." }, { status: 500 })
  }

  const totalCount = betsResult.count ?? 0

  return NextResponse.json({
    bets: betsResult.data || [],
    stats: statsResult,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

// ─── POST /api/bets ──────────────────────────────────────────────────────────

export const POST = withSecurity(async (request: Request) => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to log a bet." },
      { status: 401 }
    )
  }

  const body = await request.json()
  const [data, validationError] = validateRequestBody(body, createBetSchema)
  if (validationError) return validationError

  // Validate stat category against the sport
  const allowedStats = VALID_BET_STATS[data.sport]
  if (allowedStats && !allowedStats.includes(data.statCategory)) {
    return NextResponse.json(
      { error: `Invalid stat category "${data.statCategory}" for ${data.sport}. Allowed: ${allowedStats.join(", ")}.` },
      { status: 400 }
    )
  }

  // For non-monitored bets, odds and stake are required
  if (!data.isMonitored) {
    if (!data.odds || data.odds === 0) {
      return NextResponse.json(
        { error: "Odds are required for non-monitored bets. Must be between -10000 and 10000 (excluding 0)." },
        { status: 400 }
      )
    }
    if (!data.stake) {
      return NextResponse.json(
        { error: "Stake is required for non-monitored bets." },
        { status: 400 }
      )
    }
  }

  const { data: bet, error: insertError } = await supabase
    .from("bet_tracker")
    .insert({
      user_id: user.id,
      player_name: data.playerName,
      sport: data.sport,
      stat_category: data.statCategory,
      prop_line: data.propLine,
      direction: data.direction,
      confidence_score: data.confidenceScore,
      matchup_grade: data.matchupGrade ?? null,
      odds: data.odds ?? null,
      stake: data.stake ?? null,
      status: "pending",
      is_monitored: data.isMonitored ?? false,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: "Failed to create bet." }, { status: 500 })
  }

  return NextResponse.json(bet, { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

// ─── Stats Computation ───────────────────────────────────────────────────────

/**
 * Fetch bet stats using a lightweight aggregation query.
 * Only fetches resolved, non-monitored bets for stats computation.
 * As the table grows, this avoids pulling all rows into memory.
 */
async function fetchBetStats(supabase: SupabaseClient, userId: string): Promise<BetTrackerStats> {
  // Fetch only resolved, non-monitored bets with minimal columns needed for stats
  const { data: resolved, error } = await supabase
    .from("bet_tracker")
    .select("status, odds, stake, confidence_score, matchup_grade")
    .eq("is_monitored", false)
    .neq("status", "pending")

  if (error || !resolved) {
    return { totalPicks: 0, wins: 0, losses: 0, pushes: 0, winRate: 0, roi: 0, netProfit: 0, bestSignals: [] }
  }

  return computeBetTrackerStats(resolved)
}

interface BetRow {
  status: string
  odds: number | null
  stake: number | null
  confidence_score: number
  matchup_grade: string | null
  [key: string]: unknown
}

interface BetTrackerStats {
  totalPicks: number
  wins: number
  losses: number
  pushes: number
  winRate: number
  roi: number
  netProfit: number
  bestSignals: { confidence: number; grade: string; winRate: number; count: number }[]
}

function computeBetTrackerStats(bets: BetRow[]): BetTrackerStats {
  const wins = bets.filter((b) => b.status === "won")
  const losses = bets.filter((b) => b.status === "lost")
  const pushes = bets.filter((b) => b.status === "push")

  const totalPicks = bets.length
  const winCount = wins.length
  const lossCount = losses.length
  const pushCount = pushes.length

  const winRate = totalPicks > 0 ? (winCount / totalPicks) * 100 : 0

  // ROI computation — only count bets with valid stake
  const resolved = bets.filter((b) => b.stake != null)
  const totalStaked = resolved.reduce((sum, b) => sum + Number(b.stake), 0)

  let totalWinnings = 0
  for (const bet of wins) {
    if (bet.odds != null && bet.stake != null) {
      const decimalOdds = americanToDecimal(bet.odds)
      totalWinnings += Number(bet.stake) * decimalOdds
    }
  }
  for (const bet of pushes) {
    if (bet.stake != null) {
      totalWinnings += Number(bet.stake)
    }
  }

  const roi = totalStaked > 0 ? ((totalWinnings - totalStaked) / totalStaked) * 100 : 0
  const netProfit = totalWinnings - totalStaked

  // Best signals: top 3 confidence+grade combos with >= 5 resolved picks
  const signalMap = new Map<string, { confidence: number; grade: string; wins: number; total: number }>()

  for (const bet of bets) {
    const grade = bet.matchup_grade ?? "N/A"
    const key = `${bet.confidence_score}-${grade}`
    const existing = signalMap.get(key)
    if (existing) {
      existing.total++
      if (bet.status === "won") existing.wins++
    } else {
      signalMap.set(key, {
        confidence: bet.confidence_score,
        grade,
        wins: bet.status === "won" ? 1 : 0,
        total: 1,
      })
    }
  }

  const bestSignals = Array.from(signalMap.values())
    .filter((s) => s.total >= 5)
    .map((s) => ({
      confidence: s.confidence,
      grade: s.grade,
      winRate: (s.wins / s.total) * 100,
      count: s.total,
    }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3)

  return {
    totalPicks,
    wins: winCount,
    losses: lossCount,
    pushes: pushCount,
    winRate: Math.round(winRate * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    bestSignals,
  }
}
