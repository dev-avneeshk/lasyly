import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withSecurity, validateRequestBody, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createBetSchema = z.object({
  playerName: z.string().min(1).max(200),
  sport: z.enum(["NBA", "Tennis"]),
  statCategory: z.string().min(1).max(100),
  propLine: z.number().gt(0),
  direction: z.enum(["over", "under"]),
  confidenceScore: z.number().int().min(1).max(5),
  matchupGrade: z.enum(["A", "B", "C", "D", "F"]),
  odds: z.number().int().min(-10000).max(10000),
  stake: z.number().min(0.01).max(99999.99),
})

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

  // Check for injection patterns
  const injectionCheck = checkQueryParams({ sport, stat, minConfidence })
  if (injectionCheck) return injectionCheck

  // Build query - RLS ensures only user's bets are returned
  let query = supabase
    .from("bet_tracker")
    .select("*")
    .order("created_at", { ascending: false })

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

  const { data: bets, error } = await query

  if (error) {
    return NextResponse.json({ error: "Failed to fetch bets." }, { status: 500 })
  }

  // Compute BetTrackerStats
  const stats = computeBetTrackerStats(bets || [])

  return NextResponse.json({ bets: bets || [], stats })
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

  // Additional range validation (odds=0 is technically valid per schema but let's ensure non-zero for meaningful odds)
  if (data.odds === 0) {
    return NextResponse.json(
      { error: "Odds cannot be zero. Must be between -10000 and 10000 (excluding 0)." },
      { status: 400 }
    )
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
      matchup_grade: data.matchupGrade,
      odds: data.odds,
      stake: data.stake,
      status: "pending",
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: "Failed to create bet." }, { status: 500 })
  }

  return NextResponse.json(bet, { status: 201 })
}, { cacheControl: CACHE_CONTROL.SENSITIVE })

// ─── Stats Computation ───────────────────────────────────────────────────────

interface BetRow {
  id: string
  player_name: string
  sport: string
  stat_category: string
  prop_line: number
  direction: string
  confidence_score: number
  matchup_grade: string
  odds: number
  stake: number
  status: string
  created_at: string
  resolved_at?: string | null
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
  const resolved = bets.filter((b) => b.status !== "pending")
  const wins = resolved.filter((b) => b.status === "won")
  const losses = resolved.filter((b) => b.status === "lost")
  const pushes = resolved.filter((b) => b.status === "push")

  const totalPicks = resolved.length
  const winCount = wins.length
  const lossCount = losses.length
  const pushCount = pushes.length

  const winRate = totalPicks > 0 ? (winCount / totalPicks) * 100 : 0

  // ROI computation
  const totalStaked = resolved.reduce((sum, b) => sum + Number(b.stake), 0)

  let totalWinnings = 0
  // Won bets: stake * decimal_odds
  for (const bet of wins) {
    const decimalOdds = americanToDecimal(bet.odds)
    totalWinnings += Number(bet.stake) * decimalOdds
  }
  // Push bets: stake returned
  for (const bet of pushes) {
    totalWinnings += Number(bet.stake)
  }

  const roi = totalStaked > 0 ? ((totalWinnings - totalStaked) / totalStaked) * 100 : 0
  const netProfit = totalWinnings - totalStaked

  // Best signals: top 3 confidence+grade combos with >= 5 resolved picks
  const signalMap = new Map<string, { confidence: number; grade: string; wins: number; total: number }>()

  for (const bet of resolved) {
    const key = `${bet.confidence_score}-${bet.matchup_grade}`
    const existing = signalMap.get(key)
    if (existing) {
      existing.total++
      if (bet.status === "won") existing.wins++
    } else {
      signalMap.set(key, {
        confidence: bet.confidence_score,
        grade: bet.matchup_grade,
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
