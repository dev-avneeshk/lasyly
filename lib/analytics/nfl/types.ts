/**
 * NFL Advanced Analytics — type definitions.
 *
 * These types model the *advanced* Week-1 2026 data captured from
 * Pro-Football-Reference box scores (see lib/analytics/nfl/week1-2026.ts).
 * They deliberately go beyond the flat `nfl_player_stats` box-score table
 * (which is ESPN-shaped) because PFR exposes fields ESPN does not: air yards,
 * aDOT, YBC/YAC splits, pressure/blitz rates, snap counts, drive summaries,
 * and league-wide team offense/defense tables.
 *
 * ── Provenance labels ───────────────────────────────────────────────────────
 * Per the master build spec, every metric is one of:
 *   RAW         — present verbatim in the source box score.
 *   DERIVED     — computed deterministically from RAW values (e.g. catch rate).
 *   AGGREGATED  — summed/averaged across multiple RAW rows.
 *   RANKED      — a rank/percentile within a comparison population.
 *   MODELED     — a custom analytical score (weights configurable, not official).
 *   UNAVAILABLE — not supported by the current source; must never be fabricated.
 *
 * The seed dataset stores only RAW values. Everything else is produced by the
 * pure functions in lib/analytics/nfl/derive.ts and is labeled accordingly.
 */

export type MetricLabel =
  | "RAW"
  | "DERIVED"
  | "AGGREGATED"
  | "RANKED"
  | "MODELED"
  | "UNAVAILABLE"

/** A value paired with its provenance so the UI can badge it honestly. */
export interface Labeled<T> {
  value: T
  label: MetricLabel
}

// ─── Game (RAW) ───────────────────────────────────────────────────────────────

export type RoofType = "outdoors" | "dome" | "retractable-closed" | "retractable-open"

/**
 * Game-level metadata. Betting line/total and weather are RAW when the source
 * lists them; some indoor games omit weather (kept null, never invented).
 */
export interface NflGameMeta {
  /** Stable synthetic id: "{season}-{week}-{away}-{home}", lowercased abbrs. */
  game_id: string
  season: number
  week: number
  /** ISO date (YYYY-MM-DD). */
  date: string
  home_team: string // abbreviation, e.g. "SEA"
  away_team: string
  home_score: number
  away_score: number
  stadium: string
  roof: RoofType
  surface: string
  attendance: number | null
  /** Minutes:seconds of real game duration, as listed (e.g. "3:02"). */
  duration: string | null
  /** Temperature in °F when reported, else null (e.g. indoor games). */
  temperature_f: number | null
  humidity_pct: number | null
  wind_mph: number | null
  /** Vegas closing spread from the favorite's perspective, negative = favored. */
  spread: number | null
  /** The favored team abbreviation the spread applies to. */
  spread_favorite: string | null
  over_under: number | null
  /** "over" | "under" | "push" | null — as the source graded it. */
  total_result: "over" | "under" | "push" | null
  went_to_ot: boolean
}

// ─── Team game line (RAW) ──────────────────────────────────────────────────────

/** One team's team-level totals for a single game (the "Team Stats" table). */
export interface NflTeamGameStat {
  game_id: string
  team: string
  opponent: string
  is_home: boolean
  first_downs: number
  rush_att: number
  rush_yds: number
  rush_td: number
  pass_cmp: number
  pass_att: number
  pass_yds: number
  pass_td: number
  pass_int: number
  sacked: number
  sacked_yds: number
  net_pass_yds: number
  total_yds: number
  fumbles: number
  fumbles_lost: number
  turnovers: number
  penalties: number
  penalty_yds: number
  third_down_att: number
  third_down_conv: number
  fourth_down_att: number
  fourth_down_conv: number
  /** Time of possession as listed, "MM:SS". */
  top: string
}

// ─── Player game stat (RAW) ────────────────────────────────────────────────────

/**
 * A single player's standard box-score line for a game (Passing/Rushing/
 * Receiving/Fumbles). Zero-filled per PFR convention; only the categories a
 * player recorded are non-zero.
 */
export interface NflPlayerGameStat {
  game_id: string
  player: string
  team: string
  opponent: string
  // Passing
  pass_cmp: number
  pass_att: number
  pass_yds: number
  pass_td: number
  pass_int: number
  pass_sacked: number
  pass_sacked_yds: number
  pass_long: number
  pass_rating: number | null
  // Rushing
  rush_att: number
  rush_yds: number
  rush_td: number
  rush_long: number
  // Receiving
  targets: number
  rec: number
  rec_yds: number
  rec_td: number
  rec_long: number
  // Fumbles
  fumbles: number
  fumbles_lost: number
}

// ─── Advanced receiving (RAW) ──────────────────────────────────────────────────

/** PFR "Advanced Receiving" line. Fields absent in the source stay null. */
export interface NflAdvReceiving {
  game_id: string
  player: string
  team: string
  targets: number
  rec: number
  yds: number
  td: number
  first_downs: number
  /** Yards before catch. */
  ybc: number
  ybc_per_rec: number | null
  /** Yards after catch. */
  yac: number
  yac_per_rec: number | null
  /** Average depth of target. */
  adot: number | null
  broken_tackles: number
  rec_per_broken: number | null
  drops: number
  drop_pct: number | null
  /** Interceptions on targets thrown to this receiver. */
  int_on_target: number
  /** Passer rating when targeted. */
  rating_when_targeted: number | null
}

// ─── Advanced rushing (RAW) ────────────────────────────────────────────────────

export interface NflAdvRushing {
  game_id: string
  player: string
  team: string
  att: number
  yds: number
  td: number
  first_downs: number
  ybc: number
  ybc_per_att: number | null
  yac: number
  yac_per_att: number | null
  broken_tackles: number
  att_per_broken: number | null
}

// ─── Advanced passing (RAW) ────────────────────────────────────────────────────

export interface NflAdvPassing {
  game_id: string
  player: string
  team: string
  cmp: number
  att: number
  yds: number
  first_downs: number
  first_down_pct: number | null
  /** Intended air yards. */
  iay: number
  iay_per_att: number | null
  /** Completed air yards. */
  cay: number
  cay_per_cmp: number | null
  cay_per_att: number | null
  yac: number
  yac_per_cmp: number | null
  drops: number
  drop_pct: number | null
  bad_throws: number
  bad_throw_pct: number | null
  sacked: number
  blitzed: number
  hurried: number
  hits: number
  pressured: number
  pressured_pct: number | null
  scrambles: number
  yds_per_scramble: number | null
}

// ─── Snap counts (RAW) ─────────────────────────────────────────────────────────

export interface NflSnapCount {
  game_id: string
  player: string
  team: string
  pos: string
  off_snaps: number
  off_pct: number
  def_snaps: number
  def_pct: number
  st_snaps: number
  st_pct: number
}

// ─── Drives (RAW) ──────────────────────────────────────────────────────────────

export interface NflDrive {
  game_id: string
  team: string
  drive_num: number
  quarter: number
  /** Clock at drive start, "MM:SS". */
  start_clock: string
  /** Line of scrimmage at start, e.g. "SEA 24". */
  start_los: string
  plays: number
  /** Drive length as listed, "MM:SS". */
  length: string
  net_yds: number
  result: string
}

// ─── League team offense / defense (RAW, season-to-date) ────────────────────────

/**
 * A row from the league-wide "Team Offense" / "Team Defense" tables. These are
 * season totals (Week 1 = one game for most teams) and provide the comparison
 * population needed for league baselines, ranks and percentiles.
 */
export interface NflTeamSeasonUnit {
  team: string
  games: number
  points: number
  total_yds: number
  plays: number
  yds_per_play: number
  turnovers: number
  fumbles_lost: number
  first_downs: number
  pass_cmp: number
  pass_att: number
  pass_yds: number
  pass_td: number
  pass_int: number
  net_yds_per_att: number
  rush_att: number
  rush_yds: number
  rush_td: number
  rush_yds_per_att: number
  penalties: number
  penalty_yds: number
  /** Percentage of drives ending in a score. */
  score_pct: number
  /** Percentage of drives ending in a turnover. */
  turnover_pct: number
  /** PFR expected points contributed (offense/defense total). */
  exp_points: number
}

// ─── Container for the whole Week-1 dataset ─────────────────────────────────────

export interface NflWeekDataset {
  season: number
  week: number
  /** Source attribution — Pro-Football-Reference box scores. */
  source: string
  games: NflGameMeta[]
  teamGameStats: NflTeamGameStat[]
  playerGameStats: NflPlayerGameStat[]
  advReceiving: NflAdvReceiving[]
  advRushing: NflAdvRushing[]
  advPassing: NflAdvPassing[]
  snapCounts: NflSnapCount[]
  drives: NflDrive[]
  /** League-wide season-to-date units (comparison population). */
  teamOffense: NflTeamSeasonUnit[]
  teamDefense: NflTeamSeasonUnit[]
}
