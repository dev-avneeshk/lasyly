/**
 * NBA game simulations exported from the Lasyly prediction engine (a local, offline model; see
 * .agents/tasks/nba-engine-2026-10-21/site-export/export_slates.py). Each game is simulated thousands of
 * times possession by possession; `prediction` holds averages over those runs and `featured` is ONE
 * simulated game (the run closest to the typical result) with its full box score and play-by-play.
 */

export interface SimTeam {
  /** Basketball-Reference abbreviation, e.g. "UTA", "CHO", "BRK". */
  abbr: string
  name: string
  /** ESPN logo slug (https://a.espncdn.com/i/teamlogos/nba/500/<espn>.png). */
  espn: string
  /** Win-loss record before this game, e.g. "3-1". */
  record: string
}

/** Averages over all simulated runs of one game. Margin is home minus away. */
export interface SimPrediction {
  pHome: number
  home: number
  away: number
  margin: number
  /** 10th / 90th percentile of the simulated margin (80% range). */
  marginLo: number
  marginHi: number
  total: number
  totalLo: number
  totalHi: number
  overtime: number
  /** Share of runs decided by 20 or more points. */
  blowout: number
  possessions: number
  fouls: number
  fta: number
  foulOuts: number
}

export interface SimBaseline {
  pHome: number
  home: number
  away: number
  total: number
}

/** Average line when the player plays, plus his chance to play. */
export interface SimProjection {
  name: string
  role: string
  pPlay: number
  min: number
  pts: number
  reb: number
  ast: number
  tp: number
}

export interface SimBoxRow {
  name: string
  min: string
  pts: number
  fg: string
  tp: string
  ft: string
  oreb: number
  dreb: number
  reb: number
  ast: number
  stl: number
  blk: number
  /** A number for players; the team row can read like "15 (+2 team)". */
  tov: string
  pf: number
}

export interface SimBoxTeam {
  players: SimBoxRow[]
  totals: SimBoxRow
  /** e.g. "FG 46.7%, 3P 30.8%, FT 86.2%; team turnovers (not charged to a player): 2; ..." */
  shooting: string
  dnp: string[]
}

/**
 * [period, clock, offense team, text, "home-away" score]. An empty period marks a start or
 * end-of-period row. Text containing "[inferred]" is a point the engine scored without logging it.
 */
export type SimPlay = [string, string, string, string, string]

export interface SimFeaturedGame {
  simNumber: number
  seed: string
  lineScore: { labels: string[]; home: number[]; away: number[] }
  final: { home: number; away: number }
  notes: string
  box: { home: SimBoxTeam; away: SimBoxTeam }
  plays: SimPlay[]
}

export interface SimGame {
  /** Basketball-Reference game id, e.g. "202610310UTA". */
  id: string
  /** US game date, YYYY-MM-DD. */
  date: string
  /** Tip-off, ISO 8601 UTC. */
  tipoff: string | null
  home: SimTeam
  away: SimTeam
  prediction: SimPrediction
  /** The engine's previous version on the same games, for comparison. */
  baseline: SimBaseline
  projections: { home: SimProjection[]; away: SimProjection[] }
  featured: SimFeaturedGame
  builtAt: string
  minutesBeforeTip: number | null
  /** The real final score, when the game had been played at export time. */
  final: { home: number; away: number } | null
  /**
   * This game's featured model when it differs from the slate's (a slate re-run part-way with a newer model;
   * games that had already tipped off keep the older one). Absent means `SimSlate.models.featured`.
   */
  model?: string
}

export interface SimSlate {
  /** US game date, YYYY-MM-DD. */
  date: string
  sport: "NBA"
  models: { featured: string; baseline: string }
  sims: number
  builtAt: string
  games: SimGame[]
}
