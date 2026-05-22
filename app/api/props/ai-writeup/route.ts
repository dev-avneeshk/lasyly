/**
 * GET /api/props/ai-writeup
 *
 * Returns an AI-generated analysis writeup for a given prop.
 * Checks ai_writeup_cache for a valid cached writeup (not expired, line change <= 5%).
 * On cache miss, calls OpenAI gpt-4o-mini with a structured prompt and caches the result
 * with a 6-hour expiry.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import { computeHitRates } from "@/lib/analytics/hit-rates"

// ─── Constants ──────────────────────────────────────────────────────────────

/** Cache expiry duration: 6 hours in milliseconds */
const CACHE_EXPIRY_MS = 6 * 60 * 60 * 1000

/** OpenAI API timeout: 15 seconds */
const OPENAI_TIMEOUT_MS = 15_000

/** Minimum games required for AI writeup generation */
const MIN_GAMES_FOR_WRITEUP = 3

/** Line change threshold for cache invalidation (5%) */
const LINE_CHANGE_THRESHOLD = 0.05

/** Maximum writeup length in characters */
const MAX_WRITEUP_CHARS = 500

/** Maps user-facing stat categories to NBA database column names */
const NBA_STAT_COLUMNS: Record<string, string> = {
  pts: "pts",
  points: "pts",
  reb: "trb",
  rebounds: "trb",
  ast: "ast",
  assists: "ast",
  stl: "stl",
  steals: "stl",
  blk: "blk",
  blocks: "blk",
  "3pm": "tp",
  threes: "tp",
  tov: "tov",
  turnovers: "tov",
  fg: "fg",
  fga: "fga",
  ft: "ft",
  fta: "fta",
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parses a propId into player name and stat category.
 * Format: "{playerName}-{stat}" e.g. "LeBron James-pts"
 */
function parsePropId(propId: string): { player: string; stat: string } | null {
  const lastDash = propId.lastIndexOf("-")
  if (lastDash <= 0) return null
  return {
    player: propId.substring(0, lastDash),
    stat: propId.substring(lastDash + 1),
  }
}

/**
 * Fetches the last 10 game stat values for a player in a given stat category.
 */
async function fetchPlayerGameStats(
  player: string,
  stat: string,
  sport: "NBA" | "Tennis"
): Promise<{ values: number[]; opponent: string | null } | null> {
  const supabase = createAdminClient()

  if (sport === "NBA") {
    const column = NBA_STAT_COLUMNS[stat.toLowerCase()] ?? stat.toLowerCase()

    const { data, error } = await supabase
      .from("nba_player_stats")
      .select(`${column}, opponent, nba_games!inner(game_date)`)
      .eq("player_name", player)
      .order("nba_games(game_date)", { ascending: false })
      .limit(10)

    if (error || !data || data.length === 0) return null

    const values = (data as any[]).map((row) => Number(row[column]) || 0)
    const opponent = (data as any[])[0]?.opponent ?? null

    return { values, opponent }
  }

  // Tennis: use aggregate stats
  const { data, error } = await supabase
    .from("tennis_serve_stats")
    .select("*")
    .eq("player_name", player)
    .order("matches_played", { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return null

  const statColumn = stat.toLowerCase()
  const value = Number((data[0] as any)[statColumn]) || 0
  return { values: [value], opponent: null }
}

/**
 * Gets the current prop line for a player-stat combination from line history.
 */
async function getCurrentPropLine(
  player: string,
  stat: string,
  sport: string
): Promise<number | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("prop_line_history")
    .select("line_value")
    .eq("player_name", player)
    .eq("stat_category", stat)
    .eq("sport", sport)
    .order("recorded_at", { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return null
  return Number(data[0].line_value)
}

/**
 * Gets the matchup grade for a player's upcoming opponent.
 */
async function getMatchupGrade(
  player: string,
  stat: string,
  sport: string
): Promise<string | null> {
  // Use the correlations or engine data if available
  // For simplicity, we compute a basic grade from defensive stats
  const supabase = createAdminClient()

  if (sport !== "NBA") return null

  const column = NBA_STAT_COLUMNS[stat.toLowerCase()] ?? stat.toLowerCase()

  // Get the player's most recent opponent
  const { data: playerData } = await supabase
    .from("nba_player_stats")
    .select("opponent, nba_games!inner(game_date)")
    .eq("player_name", player)
    .order("nba_games(game_date)", { ascending: false })
    .limit(1)

  if (!playerData || playerData.length === 0) return null

  const opponent = (playerData as any[])[0].opponent

  // Get all teams' defensive stats (points allowed in this stat category)
  const { data: allStats } = await supabase
    .from("nba_player_stats")
    .select(`opponent, ${column}`)

  if (!allStats || allStats.length === 0) return null

  // Aggregate by opponent team
  const teamTotals = new Map<string, { total: number; count: number }>()
  for (const row of allStats as any[]) {
    const team = row.opponent as string
    const value = Number(row[column]) || 0
    const existing = teamTotals.get(team) || { total: 0, count: 0 }
    existing.total += value
    existing.count += 1
    teamTotals.set(team, existing)
  }

  const teamAverages = Array.from(teamTotals.entries())
    .filter(([, v]) => v.count >= 3)
    .map(([team, v]) => ({ team, avg: v.total / v.count }))
    .sort((a, b) => b.avg - a.avg) // Higher = more favorable

  if (teamAverages.length < 5) return null

  const opponentIdx = teamAverages.findIndex((t) => t.team === opponent)
  if (opponentIdx === -1) return null

  const percentile = (opponentIdx + 1) / teamAverages.length
  if (percentile <= 0.2) return "A"
  if (percentile <= 0.4) return "B"
  if (percentile <= 0.6) return "C"
  if (percentile <= 0.8) return "D"
  return "F"
}

/**
 * Gets line movement description for the prompt.
 */
async function getLineMovementDescription(
  player: string,
  stat: string,
  sport: string
): Promise<string> {
  const supabase = createAdminClient()

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from("prop_line_history")
    .select("line_value, recorded_at")
    .eq("player_name", player)
    .eq("stat_category", stat)
    .eq("sport", sport)
    .order("recorded_at", { ascending: false })
    .limit(10)

  if (!data || data.length < 2) return "No movement data"

  const current = Number(data[0].line_value)
  const olderEntries = data.filter(
    (row: any) => new Date(row.recorded_at).getTime() <= new Date(twentyFourHoursAgo).getTime()
  )
  const previous = olderEntries.length > 0
    ? Number(olderEntries[0].line_value)
    : Number(data[data.length - 1].line_value)

  if (current === previous) return "No movement"

  const change = current - previous
  const direction = change > 0 ? "up" : "down"
  return `Line moved ${direction} ${Math.abs(change).toFixed(1)} (from ${previous} to ${current})`
}

/**
 * Calls OpenAI gpt-4o-mini with the analysis prompt.
 * Uses fetch() with AbortController for 15s timeout.
 */
async function callOpenAI(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error("[ai-writeup] OPENAI_API_KEY not configured")
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error("[ai-writeup] OpenAI API error:", response.status, response.statusText)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content) return null

    // Truncate to max chars if needed
    return content.length > MAX_WRITEUP_CHARS
      ? content.substring(0, MAX_WRITEUP_CHARS)
      : content
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === "AbortError") {
      console.error("[ai-writeup] OpenAI request timed out (15s)")
    } else {
      console.error("[ai-writeup] OpenAI request failed:", error.message)
    }
    return null
  }
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const propId = searchParams.get("propId")
  const sport = (searchParams.get("sport") ?? "NBA") as "NBA" | "Tennis"

  // 1. Validate propId is provided
  if (!propId) {
    return NextResponse.json(
      {
        error: "Missing required query parameter: propId",
        code: "MISSING_PARAMS",
      },
      { status: 400 }
    )
  }

  // Check for injection patterns
  const injectionCheck = checkQueryParams({ propId, sport: searchParams.get("sport") })
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

  // Parse propId into player and stat
  const parsed = parsePropId(propId)
  if (!parsed) {
    return NextResponse.json(
      {
        error: "Invalid propId format. Expected '{player}-{stat}'.",
        code: "INVALID_PARAM",
      },
      { status: 400 }
    )
  }

  const { player, stat } = parsed
  const supabase = createAdminClient()

  // 2. Fetch player game stats to check minimum games requirement
  const playerStats = await fetchPlayerGameStats(player, stat, sport)

  // 7. If player has < 3 games: return insufficient data error
  if (!playerStats || playerStats.values.length < MIN_GAMES_FOR_WRITEUP) {
    return NextResponse.json({
      writeup: null,
      cached: false,
      error: "Insufficient data for analysis",
    })
  }

  // 3. Check ai_writeup_cache for valid cached writeup
  const now = new Date().toISOString()
  const { data: cachedWriteup } = await supabase
    .from("ai_writeup_cache")
    .select("writeup, prop_line_at_generation, expires_at")
    .eq("prop_identifier", propId)
    .eq("sport", sport)
    .gt("expires_at", now)
    .limit(1)
    .single()

  if (cachedWriteup) {
    // Check if current prop line has changed > 5% from prop_line_at_generation
    const currentLine = await getCurrentPropLine(player, stat, sport)
    const lineAtGeneration = Number(cachedWriteup.prop_line_at_generation)

    if (currentLine !== null && lineAtGeneration > 0) {
      const lineChange = Math.abs(currentLine - lineAtGeneration) / lineAtGeneration
      if (lineChange <= LINE_CHANGE_THRESHOLD) {
        // 4. Cache hit: valid and not invalidated
        return NextResponse.json({
          writeup: cachedWriteup.writeup,
          cached: true,
        })
      }
      // Cache invalidated due to line change > 5%, fall through to regenerate
    } else {
      // No current line data to compare, serve cached version
      return NextResponse.json({
        writeup: cachedWriteup.writeup,
        cached: true,
      })
    }
  }

  // 5. Cache miss or invalidated — generate new writeup
  const gameValues = playerStats.values
  const opponent = playerStats.opponent ?? "Unknown"

  // Get current prop line
  const currentPropLine = await getCurrentPropLine(player, stat, sport)
  // Fallback: compute median of last 10 games as prop line
  const propLine = currentPropLine ?? computeMedianLine(gameValues)

  // Compute L5 and L10 hit rates
  const hitRates = computeHitRates(gameValues, propLine)
  const l5Window = hitRates.find((w) => w.window === "L5")
  const l10Window = hitRates.find((w) => w.window === "L10")
  const l5HitRate = l5Window?.available ? l5Window.hitRate : 0
  const l10HitRate = l10Window?.available ? l10Window.hitRate : 0

  // Get matchup grade
  const grade = await getMatchupGrade(player, stat, sport)

  // Get line movement description
  const movement = await getLineMovementDescription(player, stat, sport)

  // Build the prompt
  const prompt = `You are a sports betting analyst. Write a 3-5 sentence analysis (max 500 chars) for this prop:
Player: ${player}, Stat: ${stat}, Line: ${propLine}
Last 10 games: ${gameValues.join(", ")}
L5 hit rate: ${l5HitRate}%, L10 hit rate: ${l10HitRate}%
Matchup grade: ${grade ?? "N/A"} vs ${opponent}
Line movement: ${movement}

Cover: recent form trend, matchup quality, and whether the line offers value.
Be concise and actionable. No disclaimers.`

  // Call OpenAI with 15s timeout
  const writeup = await callOpenAI(prompt)

  // 6. If OpenAI fails or times out
  if (!writeup) {
    return NextResponse.json({
      writeup: null,
      cached: false,
      error: "Analysis unavailable",
    })
  }

  // Store result in ai_writeup_cache with 6h expiry
  const expiresAt = new Date(Date.now() + CACHE_EXPIRY_MS).toISOString()

  await supabase
    .from("ai_writeup_cache")
    .upsert(
      {
        prop_identifier: propId,
        sport,
        writeup,
        prop_line_at_generation: propLine,
        generated_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "prop_identifier,sport" }
    )

  return NextResponse.json({
    writeup,
    cached: false,
  })
}, { cacheControl: CACHE_CONTROL.PUBLIC_SHORT })

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Computes the median of an array of numbers as a fallback prop line.
 */
function computeMedianLine(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}
