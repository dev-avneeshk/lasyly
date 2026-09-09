/**
 * Player of the Week — types.
 *
 * POTW is a SEPARATE system from the season-long LPI ranking. It measures a
 * rolling 7-day window of actual game production, not projected season value.
 */

/** One player's box score in a single game within the window. */
export interface PotwGameLine {
  game_id: string
  game_date: string
  team: string
  opponent: string | null
  minutes: number          // parsed from "MM:SS" to decimal minutes
  pts: number
  trb: number
  ast: number
  stl: number
  blk: number
  tov: number
  fga: number
  fta: number
  won: boolean             // did the player's team win this game
}

/** All of a player's games in the window, plus identity. */
export interface PotwPlayerWindow {
  player_name: string
  player_id: string | null
  team: string | null
  position: string | null
  games: PotwGameLine[]
}

/** Computed POTW result for one player. */
export interface PotwPlayerScore {
  player_name: string
  player_id: string | null
  team: string | null
  position: string | null

  potw_score: number
  production_score: number
  efficiency_score: number
  availability_score: number
  team_success_score: number

  games_in_window: number
  team_wins_in_window: number
  pts_per_g: number
  trb_per_g: number
  ast_per_g: number
  stl_per_g: number
  blk_per_g: number
  ts_pct: number
}

export interface PotwResult {
  window_start: string
  window_end: string
  season: string
  conference: "ALL" | "East" | "West"
  winner: PotwPlayerScore
  runners_up: Array<{ player_name: string; team: string | null; potw_score: number }>
  headline: string
}

export interface PotwConfig {
  /** Minimum games a player must have played in the window to be eligible. */
  min_games_in_window: number
  /** Minimum total minutes across the window. */
  min_minutes_in_window: number
  window_days: number
}

export const DEFAULT_POTW_CONFIG: PotwConfig = {
  min_games_in_window: 2,
  min_minutes_in_window: 40,
  window_days: 7,
}
