/**
 * NFL "Defense Allowed" API
 *
 * Returns, for a team + position, the per-game stats that team's defense
 * allows to that position, with league averages and ranks (1 = softest).
 * Powers the PropFinder-style Opponent panel on the NFL detail page.
 *
 * Query params:
 *   team     (required) — team abbreviation, e.g. "SF"
 *   position (required) — QB | RB | WR | TE
 *   season   (optional) — season year (e.g. 2025) or "all" (default all)
 *   split    (optional) — all | home | away (default all)
 */

import { NextResponse } from "next/server"
import { withSecurity, checkQueryParams, CACHE_CONTROL } from "@/lib/security/routeHelpers"
import {
  getNFLDefenseAllowed,
  NFLDefensePosition,
  DefenseSplit,
} from "@/lib/analytics/nfl-defense"

const VALID_POSITIONS = new Set(["QB", "RB", "WR", "TE"])
const VALID_SPLITS = new Set(["all", "home", "away"])

export const GET = withSecurity(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const team = (searchParams.get("team") ?? "").toUpperCase()
  const position = (searchParams.get("position") ?? "RB").toUpperCase()
  const seasonRaw = searchParams.get("season") ?? "all"
  const split = (searchParams.get("split") ?? "all") as DefenseSplit

  const injectionCheck = checkQueryParams({
    team: searchParams.get("team"),
    position: searchParams.get("position"),
    season: seasonRaw,
    split,
  })
  if (injectionCheck) return injectionCheck

  if (!team || team.length < 2 || team.length > 3) {
    return NextResponse.json({ error: "valid team abbreviation required" }, { status: 400 })
  }
  if (!VALID_POSITIONS.has(position)) {
    return NextResponse.json({ error: "position must be QB, RB, WR, or TE" }, { status: 400 })
  }
  if (!VALID_SPLITS.has(split)) {
    return NextResponse.json({ error: "split must be all, home, or away" }, { status: 400 })
  }

  const season: number | "all" =
    seasonRaw === "all" ? "all" : Number.isFinite(Number(seasonRaw)) ? Number(seasonRaw) : "all"

  const result = await getNFLDefenseAllowed(team, position as NFLDefensePosition, { season, split })

  // Build the summary cards (weakest / strongest / scoring) the UI shows.
  const cells = Object.values(result.byStat)
  const offenseCells = cells.filter((c) => c.offenseFriendly)
  // Weakest spot = the stat this defense allows most relative to league (rank closest to 1).
  const weakest = [...offenseCells].sort((a, b) => a.rank - b.rank)[0] ?? null
  // Strongest spot = the stat this defense concedes least (rank closest to rankOf).
  const strongest = [...offenseCells].sort((a, b) => b.rank - a.rank)[0] ?? null
  // Scoring spot = best TD matchup.
  const tdCells = offenseCells.filter((c) => c.key.endsWith("_td"))
  const scoring = [...tdCells].sort((a, b) => a.rank - b.rank)[0] ?? null

  return NextResponse.json({
    ...result,
    summary: {
      weakest: weakest && { label: weakest.label, rank: weakest.rank, rankOf: weakest.rankOf, perGame: weakest.perGame },
      strongest: strongest && { label: strongest.label, rank: strongest.rank, rankOf: strongest.rankOf, perGame: strongest.perGame },
      scoring: scoring && { label: scoring.label, rank: scoring.rank, rankOf: scoring.rankOf, perGame: scoring.perGame },
    },
    meta: { team, position, season, split, timestamp: new Date().toISOString() },
  })
}, { cacheControl: CACHE_CONTROL.PUBLIC_MEDIUM })
