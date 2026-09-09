/**
 * NBA Ranking Engine — TypeScript Type Definitions
 *
 * All interfaces used throughout the ranking system.
 * These match the Supabase table schemas exactly so that
 * computed objects can be directly inserted without transformation.
 */

// ─── Position ────────────────────────────────────────────────────────────────

export type NBAPosition = "PG" | "SG" | "SF" | "PF" | "C"

// ─── Ranking Types ───────────────────────────────────────────────────────────

export type RankingType =
  | "overall"
  | "offense"
  | "defense"
  | "scoring"
  | "playmaking"
  | "rebounding"
  | "shooting"
  | "two_way"
  | "young"
  | "breakout"
  | "decline"

export type RankingMode = "historical" | "projected"

// ─── Tiers ───────────────────────────────────────────────────────────────────

export type RankingTier =
  | "Ω — Apex"
  | "X — Mythic"
  | "S — Elite"
  | "A — Dominant"
  | "B — Impact"
  | "C — Rotation"
  | "D — Limited"
  | "E — Fringe"

// ─── Ranking Version ─────────────────────────────────────────────────────────

export type RankingStatus = "draft" | "published" | "archived"

export interface RankingVersion {
  ranking_version: string    // '2026-27-v1'
  season: string             // '2026-27'
  ranking_mode: RankingMode  // 'historical' or 'projected'
  algorithm_version: string  // 'nba-ranking-v1'
  status: RankingStatus
  weights: RankingWeights
  generated_at: string | null
  published_at: string | null
  player_count: number | null
  team_count: number | null
  notes: string | null
}

// ─── Ranking Weights (Configurable) ──────────────────────────────────────────

export interface OverallWeights {
  impact: number
  offense: number
  defense: number
  playmaking: number
  roleVolume: number
}

export interface TeamPowerWeights {
  core: number
  depth: number
  star: number
  teamAvail: number
  continuity: number
}

export interface SeasonWeights {
  [season: string]: number  // e.g., { "2025-26": 0.60, "2024-25": 0.25, "2023-24": 0.15 }
}

export interface ProjectionWeights {
  k_T: number
  k_A: number
  k_Age: number
  k_Role: number
  k_Team: number
}

export interface RankingWeights {
  overall: OverallWeights
  team: TeamPowerWeights
  seasons: SeasonWeights
  projection: ProjectionWeights
}

// ─── Raw Stats Input Per Player ───────────────────────────────────────────────

/** Per-game stats from nba_player_season_stats where stat_type = 'per_game' */
export interface PlayerPerGameStats {
  pts: number | null
  trb: number | null
  ast: number | null
  stl: number | null
  blk: number | null
  tov: number | null
  fg: number | null
  fga: number | null
  fg_pct: number | null
  fg3: number | null
  fg3a: number | null
  fg3_pct: number | null
  ft: number | null
  fta: number | null
  ft_pct: number | null
  orb: number | null
  drb: number | null
  mp: number | null   // minutes per game
  efg_pct: number | null
  pf: number | null
}

/** Advanced stats from nba_player_season_stats where stat_type = 'advanced' */
export interface PlayerAdvancedStats {
  per: number | null       // Player Efficiency Rating
  ts_pct: number | null    // True Shooting %
  usg_pct: number | null   // Usage Rate %
  obpm: number | null      // Offensive BPM
  dbpm: number | null      // Defensive BPM
  bpm: number | null       // BPM
  vorp: number | null      // Value Over Replacement
  ws: number | null        // Win Shares
  ws_per_48: number | null
  ows: number | null       // Offensive Win Shares
  dws: number | null       // Defensive Win Shares
  orb_pct: number | null
  drb_pct: number | null
  trb_pct: number | null
  ast_pct: number | null
  stl_pct: number | null
  blk_pct: number | null
  tov_pct: number | null
  off_rtg: number | null   // Offensive Rating
  def_rtg: number | null   // Defensive Rating
  fg3a_per_fga_pct: number | null
  ast_tov: number | null  // computed from per_game: ast / tov
}

/** Shooting profile from nba_player_advanced_stats */
export interface PlayerShootingProfile {
  fga_pct_0_3ft: number | null
  fga_pct_3_10ft: number | null
  fga_pct_10_16ft: number | null
  fga_pct_16_3pt: number | null
  fga_pct_3pt: number | null
  pct_2p_assisted: number | null
  pct_3p_assisted: number | null
  trb_pct: number | null
  orb_pct: number | null
  drb_pct: number | null
  ast_pct: number | null
  pga: number | null
  games_played: number | null
}

/** Per-100 possession stats */
export interface PlayerPer100Stats {
  pts: number | null
  trb: number | null
  ast: number | null
  stl: number | null
  blk: number | null
  ast_tov: number | null
  off_rtg: number | null
  def_rtg: number | null
}

// ─── Full Input Per Player ────────────────────────────────────────────────────

export interface PlayerRankingInput {
  player_name: string
  player_id: string | null            // from nba_players table (may be null for new players)
  position: NBAPosition | null
  age: number | null
  birth_date: string | null

  // Team assignment
  historical_team: string | null      // 2025-26 team
  projected_team: string | null       // 2026-27 team (may differ from historical)

  // Per-season data (primary season)
  current_season: string              // '2025-26'
  games_played: number
  games_started: number
  minutes_per_game: number
  // Stats (primary season = 2025-26)
  per_game: PlayerPerGameStats | null
  advanced: PlayerAdvancedStats | null
  shooting_profile: PlayerShootingProfile | null
  per_100: PlayerPer100Stats | null



  lpi_25_26?: number | null
  lpi_23_24?: number | null

  // Multi-season data (for projection weighting)
  prior_seasons: PriorSeasonData[]

  // Game-level data for consistency calculation
  game_log_pts: number[]              // last 20 game values
  game_log_trb: number[]
  game_log_ast: number[]

  // Team context for 2026-27 projection
  projected_team_stats: TeamContextData | null
}

export interface PriorSeasonData {
  season: string
  games_played: number
  per_game: PlayerPerGameStats | null
  advanced: PlayerAdvancedStats | null
  per_100: PlayerPer100Stats | null
}

export interface TeamContextData {
  team: string
  off_rtg: number | null     // team offensive rating
  def_rtg: number | null     // team defensive rating
  pace: number | null        // team pace
  league_avg_off_rtg: number
  league_avg_def_rtg: number
  league_avg_pace: number
}

// ─── Score Breakdowns ─────────────────────────────────────────────────────────

export interface PlayerScoreBreakdown {
  player_name: string
  player_id: string | null
  position: NBAPosition | null
  age: number | null

  // Component scores (all 0-100)
  impact_score: number
  role_volume_score: number
  offense_score: number
  defense_score: number
  scoring_score: number
  playmaking_score: number
  rebounding_score: number
  shooting_score: number
  availability_score: number
  team_context_score: number

  // Derived
  two_way_score: number

  // Adjustments (for projected rankings only)
  age_adjustment: number      // small delta applied to projected score
  multi_season_score: number  // weighted multi-season performance score

  // Final scores
  historical_overall_score: number    // 2025-26 actual
  projected_overall_score: number     // 2026-27 projection

  // Confidence
  confidence: number                  // 0-100 public metadata scale
  low_confidence: boolean
  /** LPI components that had zero available factors and were weight-redistributed. */
  missing_components: string[]
  /** LPI components computed from a minority of their expected input factors. */
  degraded_components: string[]
  games_played: number
  minutes_per_game: number
  factors_used?: Record<string, string[]>
}

// ─── Final Ranking Row (matches DB schema) ────────────────────────────────────

export interface NBAPlayerRankingRow {
  player_id: string | null
  player_name: string
  position: NBAPosition | null
  age: number | null
  season: string
  ranking_mode: RankingMode
  ranking_type: RankingType
  ranking_version: string
  rank: number
  score: number
  tier: RankingTier
  previous_rank: number | null
  rank_change: number | null
  team: string | null
  historical_team: string | null
  projected_team: string | null
  is_published: boolean
  published_at: string | null
  confidence: number | null
  is_new: boolean
  low_confidence: boolean
  games_played: number | null
  minutes_per_game: number | null
  impact_score: number | null
  role_volume_score: number | null
  offense_score: number | null
  defense_score: number | null
  scoring_score: number | null
  playmaking_score: number | null
  rebounding_score: number | null
  shooting_score: number | null
  two_way_score: number | null
  availability_score: number | null
  team_context_score: number | null
  age_adjustment: number | null
  multi_season_weight: Record<string, number> | null
  explanation: string | null
  strengths: string[] | null
  weaknesses: string[] | null
  outlook: string | null
  signature: string | null
  player_class: string | null
  potential: string | null
  ceiling: string | null
  status: string | null
}

// ─── Team Input ───────────────────────────────────────────────────────────────

export interface TeamRankingInput {
  team: string
  team_full_name: string
  season: string

  // Roster
  roster_2026_27: Array<{
    player_name: string
    score: number          // projected overall score
    role: "starter" | "rotation" | "bench"
  }>

  // 2025-26 roster for continuity calculation
  roster_2025_26: string[]

  // Team stats from nba_team_stats
  off_rtg: number | null
  def_rtg: number | null
  pace: number | null
  net_rtg: number | null

  // Previous season record
  previous_wins: number | null
  previous_losses: number | null
}

export interface NBATeamRankingRow {
  team: string
  team_full_name: string | null
  season: string
  ranking_mode: RankingMode
  ranking_version: string
  ranking_type: string
  rank: number
  power_score: number
  tier: string | null
  offensive_score: number | null
  defensive_score: number | null
  depth_score: number | null
  star_power_score: number | null
  net_score: number | null
  previous_rank: number | null
  rank_change: number | null
  projected_wins: number | null
  projected_win_pct: number | null
  is_published: boolean
  published_at: string | null
  key_additions: string[] | null
  key_losses: string[] | null
  returning_core_pct: number | null
  explanation: string | null
  why_ranked_here: string | null
  team_class: string | null
}

// ─── Pipeline Config ──────────────────────────────────────────────────────────

export interface RankingConfig {
  season: string                         // target season to rank ('2026-27')
  historical_season: string              // completed season to use as primary data ('2025-26')
  ranking_version: string                // version string ('2026-27-v1')
  ranking_mode: RankingMode
  algorithm_version: string              // 'nba-ranking-v1'
  weights: RankingWeights
  ranking_types: RankingType[]
  min_games_for_ranking: number          // e.g., 20
  min_minutes_for_ranking: number        // e.g., 400 total minutes
  /**
   * Resolved qualification thresholds for THIS run. Ramps down early in the
   * season (see resolveQualification). Optional so existing callers that build
   * a config by hand still work — undefined falls back to the full 20/400 bar.
   */
  qualification?: { games: number; minutes: number }
  min_games_for_top100: number           // e.g., 5
  top_n: number                          // e.g., 100 for Top 100
  is_projection: boolean                 // true for 2026-27, false for 2025-26 historical
  dry_run: boolean                       // if true, compute but don't write to DB
}

// ─── League Context (for normalization) ──────────────────────────────────────

/** All player values for a given metric — used for percentile normalization */
export interface LeagueMetricContext {
  pts_per_g: number[]
  trb_per_g: number[]
  ast_per_g: number[]
  stl_per_g: number[]
  blk_per_g: number[]
  tov_per_g: number[]
  fg3_per_g: number[]
  fg3a_per_g: number[]
  fta_per_g: number[]
  fg_pct: number[]
  fg3_pct: number[]
  ft_pct: number[]
  ts_pct: number[]
  efg_pct: number[]
  usg_pct: number[]
  obpm: number[]
  dbpm: number[]
  bpm: number[]
  per: number[]
  ws: number[]
  ws_per_48: number[]
  dws: number[]
  vorp: number[]
  // LPI v2 workload populations (Role & Volume component)
  minutes_played: number[]
  minutes_per_game: number[]
  off_rtg: number[]
  def_rtg: number[]
  orb_pct: number[]
  drb_pct: number[]
  trb_pct: number[]
  ast_pct: number[]
  stl_pct: number[]
  blk_pct: number[]
  tov_pct: number[]
  ast_tov: number[]
  pts_per_100: number[]
  fg3a_rate: number[]    // fg3a_per_g / fga_per_g
  // Role-segmented versions for role-aware normalization (GUARD/WING/BIG)
  // Partial because some roles may have insufficient sample sizes
  trb_pct_by_role: Partial<Record<"GUARD" | "WING" | "BIG", number[]>>
  orb_pct_by_role: Partial<Record<"GUARD" | "WING" | "BIG", number[]>>
  drb_pct_by_role: Partial<Record<"GUARD" | "WING" | "BIG", number[]>>
  stl_pct_by_role: Partial<Record<"GUARD" | "WING" | "BIG", number[]>>
  blk_pct_by_role: Partial<Record<"GUARD" | "WING" | "BIG", number[]>>
  ast_pct_by_role: Partial<Record<"GUARD" | "WING" | "BIG", number[]>>
}

// ─── Pipeline Result ──────────────────────────────────────────────────────────

export interface PipelineResult {
  season: string
  ranking_version: string
  ranking_mode: RankingMode
  algorithm_version: string
  player_rankings_computed: number
  team_rankings_computed: number
  warnings: string[]
  errors: string[]
  duration_ms: number
  dry_run: boolean
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface RankingListResponse {
  season: string
  ranking_type: RankingType
  ranking_version: string
  total: number
  rankings: RankingListItem[]
}

export interface RankingListItem {
  rank: number
  player_name: string
  player_id: string | null
  team: string | null
  historical_team: string | null
  position: string | null
  age: number | null
  score: number
  tier: RankingTier
  previous_rank: number | null
  rank_change: number | null
  is_new: boolean
  is_published: boolean
  confidence: number | null
  low_confidence: boolean
  offense_score: number | null
  defense_score: number | null
  scoring_score: number | null
  playmaking_score: number | null
  rebounding_score: number | null
  shooting_score: number | null
  two_way_score: number | null
  explanation: string | null
  strengths: string[] | null
  weaknesses: string[] | null
  signature: string | null
  player_class: string | null
  potential: string | null
  ceiling: string | null
  status: string | null
}

export interface TeamRankingListResponse {
  season: string
  ranking_version: string
  total: number
  rankings: TeamRankingListItem[]
}

export interface TeamRankingListItem {
  rank: number
  team: string
  team_full_name: string | null
  power_score: number
  tier: string | null
  offensive_score: number | null
  defensive_score: number | null
  depth_score: number | null
  star_power_score: number | null
  previous_rank: number | null
  rank_change: number | null
  projected_wins: number | null
  key_additions: string[] | null
  key_losses: string[] | null
  explanation: string | null
  team_class: string | null
}
