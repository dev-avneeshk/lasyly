/**
 * GET /api/rankings
 * Returns ranked player list for a given season + ranking type.
 *
 * Query params:
 *   season       — '2026-27' (default: latest published)
 *   type         — 'overall' | 'offense' | 'defense' | etc. (default: 'overall')
 *   limit        — max rows to return (default: 100, max: 200)
 *   offset       — pagination offset (default: 0)
 *   published    — 'true' | 'false' (default: 'true')
 *
 * Cached at 300s TTL (rankings change only on recalculation runs).
 */

import { NextRequest, NextResponse } from "next/server"
import { cached } from "@/lib/cache"
import type { RankingListResponse, RankingType } from "@/lib/rankings/types"
import { getNbaRankings } from "@/lib/rankings/nba/read"
import {
  getNflRankings,
  isNflRankingType,
  currentNflSeason,
  NFL_RANKING_TYPES,
  type NflRankingType,
} from "@/lib/rankings/nfl/read"

const VALID_RANKING_TYPES: RankingType[] = [
  "overall", "offense", "defense", "scoring",
  "playmaking", "rebounding", "shooting", "two_way", "young", "breakout",
]

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 100
const CACHE_TTL_MS = 300_000  // 5 minutes

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const sport = (searchParams.get("sport") ?? "NBA").toUpperCase()
  const limit = Math.min(parseInt(searchParams.get("limit") ?? `${DEFAULT_LIMIT}`), MAX_LIMIT)
  const offset = parseInt(searchParams.get("offset") ?? "0")

  // ─── NFL branch ─────────────────────────────────────────────────────────────
  // NFL rankings live in their own table (nfl_player_rankings), are regenerated
  // daily, and use a smaller ranking-type set. They return the same
  // RankingListResponse shape so the UI needs no NFL-specific rendering.
  if (sport === "NFL") {
    const nflSeason = searchParams.get("season") ?? currentNflSeason()
    const nflTypeRaw = searchParams.get("type") ?? "overall"
    if (!isNflRankingType(nflTypeRaw)) {
      return NextResponse.json(
        { error: `Invalid NFL ranking type. Valid types: ${NFL_RANKING_TYPES.join(", ")}` },
        { status: 400 }
      )
    }
    const nflType = nflTypeRaw as NflRankingType
    const nflCacheKey = `rankings:nfl:${nflSeason}:${nflType}:${limit}:${offset}`
    const nflResult = await cached<RankingListResponse>(
      nflCacheKey,
      () => getNflRankings({ season: nflSeason, type: nflType, limit, offset }),
      CACHE_TTL_MS
    )
    return NextResponse.json(nflResult, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    })
  }

  // ─── NBA (default) ────────────────────────────────────────────────────────
  const season = searchParams.get("season") ?? "2026-27"
  const mode = (searchParams.get("mode") ?? "projected") as "historical" | "projected"
  const type = (searchParams.get("type") ?? "overall") as RankingType
  const publishedOnly = searchParams.get("published") !== "false"

  // Validate ranking type
  if (!VALID_RANKING_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid ranking type. Valid types: ${VALID_RANKING_TYPES.join(", ")}` },
      { status: 400 }
    )
  }

  const cacheKey = `rankings:${season}:${mode}:${type}:${limit}:${offset}:${publishedOnly}`

  const result = await cached<RankingListResponse>(
    cacheKey,
    () => getNbaRankings({ season, mode, type, limit, offset, publishedOnly }),
    CACHE_TTL_MS
  )

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  })
}
