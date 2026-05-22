/**
 * Line Movement Monitor module.
 *
 * Records prop line history and computes line movement data
 * (direction, absolute change, significant movement flag).
 *
 * Uses the `prop_line_history` table (append-only log).
 *
 * Requirements: 8.1, 8.2, 8.3, 8.6
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { LineMovementData } from "./types"

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum data points returned for chart rendering */
const MAX_HISTORY_POINTS = 100

/** Default number of days to fetch line history */
const DEFAULT_HISTORY_DAYS = 7

/** Threshold for significant movement (10% from earliest in 24h) */
const SIGNIFICANT_MOVE_THRESHOLD = 0.10

// ─── Record Line History ────────────────────────────────────────────────────

/**
 * Records a line value for a player-stat combination.
 * Append-only — never updates existing rows.
 *
 * Called by the scraper hook each time a prop line is scraped.
 *
 * @param player - Player name
 * @param sport - Sport ("NBA" or "Tennis")
 * @param stat - Stat category (e.g., "pts", "aces")
 * @param lineValue - The prop line value
 */
export async function recordLineHistory(
  player: string,
  sport: "NBA" | "Tennis",
  stat: string,
  lineValue: number
): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase.from("prop_line_history").insert({
    player_name: player,
    sport,
    stat_category: stat,
    line_value: lineValue,
  })

  if (error) {
    throw new Error(`Failed to record line history: ${error.message}`)
  }
}

// ─── Get Line Movement ──────────────────────────────────────────────────────

/**
 * Computes line movement data for a player-stat combination.
 *
 * Fetches the past 7 days of line history and computes:
 * - currentLine: most recent line value
 * - previousLine: line value from ~24h ago (closest record)
 * - change: absolute difference rounded to 1 decimal
 * - direction: "up" if current > previous, "down" otherwise
 * - hasSignificantMove: true if |current - earliest_in_24h| / earliest_in_24h >= 10%
 * - history: array of { timestamp, value } for chart rendering (max 100 points)
 *
 * @param player - Player name
 * @param stat - Stat category
 * @param sport - Sport ("NBA" or "Tennis")
 * @returns LineMovementData or null if no history exists
 */
export async function getLineMovement(
  player: string,
  stat: string,
  sport: "NBA" | "Tennis"
): Promise<LineMovementData | null> {
  const supabase = createAdminClient()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - DEFAULT_HISTORY_DAYS)

  const { data, error } = await supabase
    .from("prop_line_history")
    .select("line_value, recorded_at")
    .eq("player_name", player)
    .eq("stat_category", stat)
    .eq("sport", sport)
    .gte("recorded_at", sevenDaysAgo.toISOString())
    .order("recorded_at", { ascending: true })
    .limit(MAX_HISTORY_POINTS)

  if (error) {
    throw new Error(`Failed to fetch line history: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return null
  }

  // Build history array for chart rendering
  const history = data.map((row) => ({
    timestamp: row.recorded_at,
    value: Number(row.line_value),
  }))

  return computeLineMovementFromHistory(history)
}

// ─── Get Line History ───────────────────────────────────────────────────────

/**
 * Fetches raw line history for chart rendering.
 *
 * @param player - Player name
 * @param stat - Stat category
 * @param sport - Sport ("NBA" or "Tennis")
 * @param days - Number of days to look back (default 7)
 * @returns Array of { timestamp, value } capped at 100 data points
 */
export async function getLineHistory(
  player: string,
  stat: string,
  sport: "NBA" | "Tennis",
  days: number = DEFAULT_HISTORY_DAYS
): Promise<{ timestamp: string; value: number }[]> {
  const supabase = createAdminClient()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data, error } = await supabase
    .from("prop_line_history")
    .select("line_value, recorded_at")
    .eq("player_name", player)
    .eq("stat_category", stat)
    .eq("sport", sport)
    .gte("recorded_at", startDate.toISOString())
    .order("recorded_at", { ascending: true })
    .limit(MAX_HISTORY_POINTS)

  if (error) {
    throw new Error(`Failed to fetch line history: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return []
  }

  return data.map((row) => ({
    timestamp: row.recorded_at,
    value: Number(row.line_value),
  }))
}

// ─── Pure Computation Helpers (exported for testing) ────────────────────────

/**
 * Computes line movement metrics from a history array.
 * Pure function — no side effects.
 *
 * @param history - Array of { timestamp, value } sorted ascending by timestamp
 * @param referenceTime - The "now" reference time for 24h calculations
 * @returns LineMovementData or null if history is empty
 */
export function computeLineMovementFromHistory(
  history: { timestamp: string; value: number }[],
  referenceTime: Date = new Date()
): LineMovementData | null {
  if (history.length === 0) {
    return null
  }

  const currentLine = history[history.length - 1].value
  const twentyFourHoursAgo = new Date(referenceTime.getTime() - 24 * 60 * 60 * 1000)
  const previousLine = findClosestValue(history, twentyFourHoursAgo)

  const change = Math.round(Math.abs(currentLine - previousLine) * 10) / 10
  const direction: "up" | "down" = currentLine > previousLine ? "up" : "down"

  const earliestIn24h = findEarliestIn24h(history, referenceTime)
  let hasSignificantMove = false

  if (earliestIn24h !== null && earliestIn24h !== 0) {
    const moveFromEarliest = Math.abs(currentLine - earliestIn24h) / earliestIn24h
    hasSignificantMove = moveFromEarliest >= SIGNIFICANT_MOVE_THRESHOLD
  }

  return {
    currentLine,
    previousLine,
    change,
    direction,
    hasSignificantMove,
    history,
  }
}

/**
 * Finds the value in the history array closest to the target timestamp.
 * If no records exist before the target, returns the earliest available value.
 */
export function findClosestValue(
  history: { timestamp: string; value: number }[],
  targetTime: Date
): number {
  if (history.length === 0) {
    return 0
  }

  let closestIdx = 0
  let closestDiff = Infinity

  for (let i = 0; i < history.length; i++) {
    const recordTime = new Date(history[i].timestamp)
    const diff = Math.abs(recordTime.getTime() - targetTime.getTime())
    if (diff < closestDiff) {
      closestDiff = diff
      closestIdx = i
    }
  }

  return history[closestIdx].value
}

/**
 * Finds the earliest recorded value within the last 24 hours relative to referenceTime.
 * Returns null if no records exist within 24h.
 */
export function findEarliestIn24h(
  history: { timestamp: string; value: number }[],
  referenceTime: Date = new Date()
): number | null {
  const twentyFourHoursAgo = new Date(referenceTime.getTime() - 24 * 60 * 60 * 1000)

  for (const entry of history) {
    const recordTime = new Date(entry.timestamp)
    if (recordTime >= twentyFourHoursAgo) {
      return entry.value
    }
  }

  return null
}
