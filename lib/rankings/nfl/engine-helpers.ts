/**
 * NFL Ranking Engine — row construction helpers.
 *
 * Bridges the pure scoring engine (engine.ts) to the DB-ready ranking rows.
 * Kept separate from engine.ts so the scoring math stays pure/testable and this
 * layer owns the ranking_type selection, score spreading, and row mapping.
 */

import type { NflRankingConfig } from "./pipeline"
import {
  ALGORITHM_VERSION,
  aggregatePlayer,
  buildPositionContexts,
  resolveMinGames,
  scorePlayer,
  spreadScores,
  tierForScore,
  percentile,
} from "./engine"
import type {
  NflPlayerAggregate,
  NflPlayerScore,
  NflRankingRow,
  NflRankingType,
} from "./types"

export { ALGORITHM_VERSION, aggregatePlayer, resolveMinGames }

/** Score every aggregate in bulk against shared per-position contexts. */
export function scoreAll(aggs: NflPlayerAggregate[], maxGames: number): NflPlayerScore[] {
  const ctx = buildPositionContexts(aggs)
  return aggs.map((a) => scorePlayer(a, ctx, maxGames))
}

/** The metric each ranking_type sorts on. */
function metricFor(type: NflRankingType, s: NflPlayerScore): number {
  switch (type) {
    case "overall":
      return s.overall_score
    case "offense":
      return s.offense_score
    case "defense":
      return s.defense_score
    case "scoring":
      return s.scoring_score
    case "playmaking":
      return s.playmaking_score
  }
}

/** Whether a player is eligible for a given board (keeps defense boards clean). */
function eligibleFor(type: NflRankingType, s: NflPlayerScore): boolean {
  switch (type) {
    case "defense":
      return s.position === "DEF" || s.defense_score >= 25
    case "offense":
    case "scoring":
    case "playmaking":
      return s.position !== "DEF"
    case "overall":
      return true
  }
}

const TOP_N: Record<NflRankingType, number> = {
  overall: 200,
  offense: 150,
  defense: 120,
  scoring: 150,
  playmaking: 150,
}

/**
 * Produce the full set of ranking rows across all ranking types, with ranks,
 * spread scores, tiers, and rank_change vs the prior version.
 */
export function buildRankedRowsInput(
  qualified: NflPlayerAggregate[],
  maxGames: number,
  config: NflRankingConfig,
  priorRanks: Map<string, Map<NflRankingType, number>>
): NflRankingRow[] {
  const scores = scoreAll(qualified, maxGames)
  const now = new Date().toISOString()
  const rows: NflRankingRow[] = []

  for (const type of config.ranking_types) {
    const pool = scores
      .filter((s) => eligibleFor(type, s))
      .sort((a, b) => metricFor(type, b) - metricFor(type, a))
      .slice(0, TOP_N[type])

    if (pool.length === 0) continue

    // Spread the sorting metric across a readable band for display.
    const spread = spreadScores(pool.map((s) => metricFor(type, s)))

    pool.forEach((s, idx) => {
      const rank = idx + 1
      const prev = priorRanks.get(s.player_name)?.get(type) ?? null
      rows.push({
        player_name: s.player_name,
        athlete_id: s.athlete_id,
        position: s.position,
        team: s.team,
        season: config.season,
        ranking_type: type,
        ranking_version: config.ranking_version,
        rank,
        score: spread[idx],
        tier: tierForScore(spread[idx]),
        previous_rank: prev,
        rank_change: prev !== null ? prev - rank : null,
        is_new: prev === null,
        is_published: true,
        published_at: now,
        confidence: s.confidence / 100, // stored as 0..1 (NUMERIC(4,3))
        low_confidence: s.low_confidence,
        games_played: s.games,
        offense_score: s.offense_score,
        defense_score: s.defense_score,
        scoring_score: s.scoring_score,
        playmaking_score: s.playmaking_score,
        efficiency_score: s.efficiency_score,
        two_way_score: s.two_way_score,
        availability_score: s.availability_score,
        explanation: s.explanation,
        strengths: s.strengths,
        weaknesses: s.weaknesses,
        signature: s.signature,
        status: prev === null ? "NEW" : prev > rank ? "ASCENDING" : "STABLE",
      })
    })
  }

  return rows
}

// Re-export for tests.
export { percentile, tierForScore, spreadScores }
