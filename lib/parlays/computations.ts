import type { ParlayWithLegs, ParlayStats } from "@/lib/types/parlay"

/**
 * Compute potential payout from stake and odds.
 *
 * Convention:
 * - odds >= 100 or <= -100 → American odds
 * - otherwise → decimal multiplier
 *
 * American positive: payout = stake × (odds / 100) + stake
 * American negative: payout = stake × (100 / |odds|) + stake
 * Decimal: payout = stake × odds
 */
export function computePayout(stake: number, odds: number): number {
  if (odds >= 100) {
    // Positive American odds
    return stake * (odds / 100) + stake
  }
  if (odds <= -100) {
    // Negative American odds
    return stake * (100 / Math.abs(odds)) + stake
  }
  // Decimal odds (between -100 and 100 exclusive, but typically >= 1.01)
  return stake * odds
}

/**
 * Format odds for display.
 *
 * - odds >= 100 → "+{odds}" (positive American)
 * - odds <= -100 → "{odds}" (negative American, already has minus)
 * - otherwise → "{odds}x" (decimal multiplier)
 */
export function formatOdds(odds: number): string {
  if (odds >= 100) {
    return `+${odds}`
  }
  if (odds <= -100) {
    return `${odds}`
  }
  return `${odds}x`
}

/**
 * Compute streak information from a list of parlays.
 *
 * - Filters to resolved parlays only (status !== "pending")
 * - Sorts by resolved_at ascending
 * - best: longest consecutive "won" run
 * - current: count of consecutive same-status from most recent resolved backwards
 */
export function computeStreak(parlays: ParlayWithLegs[]): {
  best: number
  current: { count: number; type: "won" | "lost" | null }
} {
  const resolved = parlays
    .filter((p) => p.status !== "pending" && p.resolved_at !== null)
    .sort(
      (a, b) =>
        new Date(a.resolved_at!).getTime() - new Date(b.resolved_at!).getTime()
    )

  if (resolved.length === 0) {
    return { best: 0, current: { count: 0, type: null } }
  }

  // Compute best streak (longest consecutive "won" sequence)
  let best = 0
  let currentWonRun = 0
  for (const p of resolved) {
    if (p.status === "won") {
      currentWonRun++
      if (currentWonRun > best) {
        best = currentWonRun
      }
    } else {
      currentWonRun = 0
    }
  }

  // Compute current streak (from most recent resolved backwards)
  const lastStatus = resolved[resolved.length - 1].status as "won" | "lost"
  let currentCount = 0
  for (let i = resolved.length - 1; i >= 0; i--) {
    if (resolved[i].status === lastStatus) {
      currentCount++
    } else {
      break
    }
  }

  return {
    best,
    current: { count: currentCount, type: lastStatus },
  }
}

/**
 * Compute comprehensive parlay statistics.
 *
 * - win_rate = (won / (won + lost)) × 100 rounded to 1 decimal. null when both are 0.
 * - net_profit_loss = sum of (stake × (odds - 1)) for won parlays minus sum of stake for lost parlays.
 *   Only parlays with both stake and odds defined. Rounded to 2 decimals.
 * - avg_legs = average number of legs across all parlays, rounded to 1 decimal. null if no parlays.
 * - most_common_sport = most frequent sport across all legs. If tied, use the one from the most recently resolved parlay.
 * - best_streak = longest consecutive "won" sequence ordered by resolved_at ascending
 * - current_streak = count of consecutive same-status from most recent resolved backwards
 * - by_leg_count: bucket parlays into "2-leg", "3-leg", "4+-leg". Win rate per bucket = won/total resolved in bucket, rounded to nearest integer. null if no resolved in bucket.
 */
export function computeParlayStats(parlays: ParlayWithLegs[]): ParlayStats {
  const total = parlays.length
  const won = parlays.filter((p) => p.status === "won").length
  const lost = parlays.filter((p) => p.status === "lost").length
  const pending = parlays.filter((p) => p.status === "pending").length

  // Win rate
  const win_rate =
    won + lost === 0
      ? null
      : Math.round(((won / (won + lost)) * 100) * 10) / 10

  // Net profit/loss — only parlays with both stake and odds defined
  let profit = 0
  let lossSum = 0
  for (const p of parlays) {
    if (p.stake != null && p.odds != null) {
      if (p.status === "won") {
        profit += p.stake * (p.odds - 1)
      } else if (p.status === "lost") {
        lossSum += p.stake
      }
    }
  }
  const net_profit_loss = Math.round((profit - lossSum) * 100) / 100

  // Average legs
  const avg_legs =
    total === 0
      ? null
      : Math.round((parlays.reduce((sum, p) => sum + p.legs.length, 0) / total) * 10) / 10

  // Most common sport
  const most_common_sport = computeMostCommonSport(parlays)

  // Streaks
  const { best, current } = computeStreak(parlays)

  // By leg count buckets
  const by_leg_count = computeByLegCount(parlays)

  return {
    total,
    won,
    lost,
    pending,
    win_rate,
    net_profit_loss,
    avg_legs,
    most_common_sport,
    best_streak: best,
    current_streak: current,
    by_leg_count,
  }
}

function computeMostCommonSport(parlays: ParlayWithLegs[]): string | null {
  // Count sport frequency across all legs
  const sportCounts = new Map<string, number>()
  for (const p of parlays) {
    for (const leg of p.legs) {
      sportCounts.set(leg.sport, (sportCounts.get(leg.sport) || 0) + 1)
    }
  }

  if (sportCounts.size === 0) {
    return null
  }

  const maxCount = Math.max(...sportCounts.values())
  const tiedSports = [...sportCounts.entries()]
    .filter(([, count]) => count === maxCount)
    .map(([sport]) => sport)

  if (tiedSports.length === 1) {
    return tiedSports[0]
  }

  // Tie-break: use the sport from the most recently resolved parlay among tied sports
  const resolved = parlays
    .filter((p) => p.resolved_at !== null)
    .sort(
      (a, b) =>
        new Date(b.resolved_at!).getTime() - new Date(a.resolved_at!).getTime()
    )

  for (const p of resolved) {
    for (const leg of p.legs) {
      if (tiedSports.includes(leg.sport)) {
        return leg.sport
      }
    }
  }

  // If no resolved parlays, just return the first tied sport
  return tiedSports[0]
}

function computeByLegCount(parlays: ParlayWithLegs[]): ParlayStats["by_leg_count"] {
  const buckets: Record<"2-leg" | "3-leg" | "4+-leg", { won: number; total: number }> = {
    "2-leg": { won: 0, total: 0 },
    "3-leg": { won: 0, total: 0 },
    "4+-leg": { won: 0, total: 0 },
  }

  for (const p of parlays) {
    // Only count resolved parlays for bucket stats
    if (p.status === "pending") continue

    const legCount = p.legs.length
    let bucket: "2-leg" | "3-leg" | "4+-leg"
    if (legCount === 2) {
      bucket = "2-leg"
    } else if (legCount === 3) {
      bucket = "3-leg"
    } else {
      bucket = "4+-leg"
    }

    buckets[bucket].total++
    if (p.status === "won") {
      buckets[bucket].won++
    }
  }

  return {
    "2-leg": {
      won: buckets["2-leg"].won,
      total: buckets["2-leg"].total,
      win_rate:
        buckets["2-leg"].total === 0
          ? null
          : Math.round((buckets["2-leg"].won / buckets["2-leg"].total) * 100),
    },
    "3-leg": {
      won: buckets["3-leg"].won,
      total: buckets["3-leg"].total,
      win_rate:
        buckets["3-leg"].total === 0
          ? null
          : Math.round((buckets["3-leg"].won / buckets["3-leg"].total) * 100),
    },
    "4+-leg": {
      won: buckets["4+-leg"].won,
      total: buckets["4+-leg"].total,
      win_rate:
        buckets["4+-leg"].total === 0
          ? null
          : Math.round((buckets["4+-leg"].won / buckets["4+-leg"].total) * 100),
    },
  }
}
