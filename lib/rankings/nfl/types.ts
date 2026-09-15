/**
 * NFL Ranking Engine — type definitions.
 *
 * NFL rankings are computed daily from the same nfl_player_stats box-score
 * table that feeds NFL props. The output row shape is deliberately aligned with
 * the NBA-shaped RankingListItem the rankings UI already renders (offense /
 * defense / scoring / playmaking / two_way subscores, NBA-style tier labels),
 * so the frontend needs no NFL-specific card.
 */

import type { RankingTier } from "@/lib/rankings/types"

/** Raw per-game box score row (subset of nfl_player_stats we consume). */
export interface NflStatRow {
  player_name: string
  athlete_id: string | null
  team: string | null
  position: string | null
  game_date: string
  pass_yds: number
  pass_td: number
  pass_int: number
  pass_att: number
  pass_c: number
  pass_rtg: number
  rush_att: number
  rush_yds: number
  rush_td: number
  rec: number
  rec_yds: number
  rec_td: number
  targets: number
  fumbles_lost: number
  tackles_total: number
  sacks: number
  def_int: number
  def_td: number
  passes_def: number
}

/** A player's aggregated season profile, prior to scoring. */
export interface NflPlayerAggregate {
  player_name: string
  athlete_id: string | null
  team: string | null
  position: NflRankPosition
  games: number

  // Season totals
  passYds: number
  passTd: number
  passInt: number
  passAtt: number
  passComp: number
  rushYds: number
  rushTd: number
  rushAtt: number
  recYds: number
  recTd: number
  rec: number
  targets: number
  fumblesLost: number

  // Defensive totals
  tackles: number
  sacks: number
  defInt: number
  defTd: number
  passesDef: number

  // Derived rate/efficiency
  passerRating: number  // averaged QBR/rating when available
}

export type NflRankPosition = "QB" | "RB" | "WR" | "TE" | "DEF" | "FLEX"

/** Component subscores (0-100) plus the final overall score. */
export interface NflPlayerScore {
  player_name: string
  athlete_id: string | null
  team: string | null
  position: NflRankPosition
  games: number

  offense_score: number
  defense_score: number
  scoring_score: number
  playmaking_score: number
  efficiency_score: number
  two_way_score: number
  availability_score: number

  overall_score: number
  confidence: number
  low_confidence: boolean

  strengths: string[]
  weaknesses: string[]
  signature: string
  explanation: string
}

/** A finished ranking row ready to upsert into nfl_player_rankings. */
export interface NflRankingRow {
  player_name: string
  athlete_id: string | null
  position: string | null
  team: string | null
  season: string
  ranking_type: NflRankingType
  ranking_version: string
  rank: number
  score: number
  tier: RankingTier
  previous_rank: number | null
  rank_change: number | null
  is_new: boolean
  is_published: boolean
  published_at: string | null
  confidence: number | null
  low_confidence: boolean
  games_played: number | null
  offense_score: number | null
  defense_score: number | null
  scoring_score: number | null
  playmaking_score: number | null
  efficiency_score: number | null
  two_way_score: number | null
  availability_score: number | null
  explanation: string | null
  strengths: string[] | null
  weaknesses: string[] | null
  signature: string | null
  status: string | null
}

export type NflRankingType = "overall" | "offense" | "defense" | "scoring" | "playmaking"

export interface NflPipelineResult {
  season: string
  ranking_version: string
  algorithm_version: string
  player_rankings_computed: number
  warnings: string[]
  errors: string[]
  duration_ms: number
  dry_run: boolean
}
