/**
 * NFL 1v1 Auction ("Drive to Win") — core type system.
 *
 * The data layer is decoupled from the engine. Player ratings are season-scoped
 * DESIGNER ESTIMATES (0-99) — a game-balance model, not official stats. To add a
 * season, drop a new data file producing `NflPlayer[]` and register it.
 */

export type Season = "2025" | (string & {})

/** On-field NFL positions used by the auction pool. */
export type Position = "QB" | "RB" | "WR" | "TE" | "EDGE" | "LB" | "CB" | "S"

/**
 * Roster slots: 5 offense + 4 defense = 9. Two WR slots both accept a WR; every
 * other slot maps 1:1 to its position.
 */
export type RosterSlot =
  | "QB" | "RB" | "WR1" | "WR2" | "TE" // offense
  | "EDGE" | "LB" | "CB" | "S" // defense

export const OFFENSE_SLOTS: RosterSlot[] = ["QB", "RB", "WR1", "WR2", "TE"]
export const DEFENSE_SLOTS: RosterSlot[] = ["EDGE", "LB", "CB", "S"]
export const ROSTER_SLOTS: RosterSlot[] = [...OFFENSE_SLOTS, ...DEFENSE_SLOTS]

export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "EDGE", "LB", "CB", "S"]

/** Which on-field position a given slot requires. */
export const SLOT_POSITION: Record<RosterSlot, Position> = {
  QB: "QB",
  RB: "RB",
  WR1: "WR",
  WR2: "WR",
  TE: "TE",
  EDGE: "EDGE",
  LB: "LB",
  CB: "CB",
  S: "S",
}

/**
 * Per-player attributes (0-99). Position-relevant: the sim only reads the
 * attributes that apply to a player's role, so the data files stay terse over a
 * shared BASE.
 */
export interface PlayerAttributes {
  // Passing (QB)
  armStrength: number
  shortAccuracy: number
  deepAccuracy: number
  pocketAwareness: number
  decisionMaking: number
  // Rushing (RB / mobile QB)
  speed: number
  agility: number
  power: number
  vision: number
  // Receiving (WR / TE / RB)
  catching: number
  routeRunning: number
  separation: number
  contestedCatch: number
  yac: number
  // Blocking (TE / — protection proxy)
  runBlock: number
  passBlock: number
  // Pass rush (EDGE / LB)
  passRush: number
  // Run defense (EDGE / LB / S)
  runStop: number
  tackling: number
  strength: number
  // Coverage (CB / S / LB)
  coverage: number
  ballHawk: number
  // Universal
  awareness: number
  stamina: number
  consistency: number
  clutch: number
  mobility: number
}

export type PlayerTier = 1 | 2 | 3 | 4

export interface NflPlayer {
  id: string
  name: string
  team: string
  season: Season
  position: Position
  overall: number
  tier: PlayerTier
  startingBid: number
  /** ESPN player id (stable) → used to build a CDN headshot URL. Optional. */
  espnId?: number
  attributes: PlayerAttributes
  strengths: string[]
  weaknesses: string[]
}

export interface OwnedPlayer {
  player: NflPlayer
  price: number
  slot: RosterSlot
}

export type TeamId = "P1" | "P2"

export interface RosterState {
  slots: Record<RosterSlot, OwnedPlayer | null>
}

// ─── Auction / game state ────────────────────────────────────────────────────

export type GameStatus =
  | "lobby"
  | "auction"
  | "lineup"
  | "simulating"
  | "complete"

export interface AuctionLot {
  player: NflPlayer
  currentBid: number
  highBidder: TeamId | null
  openingBid: number
}

export interface BidRecord {
  playerId: string
  playerName: string
  bidder: TeamId
  amount: number
  ts: number
}

export interface AuctionResult {
  playerId: string
  playerName: string
  winner: TeamId
  price: number
}

export type AIDifficulty = "easy" | "medium" | "hard"

export type AIPersonality =
  | "balanced"
  | "aggressive"
  | "value"
  | "superstar"
  | "defense"
  | "offense"

export interface NflGameConfig {
  season: Season
  budgetPerPlayer: number
  rosterSize: number
  auctionTimerSeconds: number
  auctionTimerResetSeconds: number
  bidIncrement: number
  difficulty: AIDifficulty
  aiPersonality: AIPersonality
}

export const DEFAULT_CONFIG: NflGameConfig = {
  season: "2025",
  budgetPerPlayer: 25,
  rosterSize: 9,
  auctionTimerSeconds: 10,
  auctionTimerResetSeconds: 5,
  bidIncrement: 1,
  difficulty: "medium",
  aiPersonality: "balanced",
}

export const BUDGET_PRESETS = [25, 50, 100] as const
export type BudgetPreset = (typeof BUDGET_PRESETS)[number]

export function bidIncrementForBudget(budget: number): number {
  if (budget >= 100) return 5
  if (budget >= 50) return 2
  return 1
}

// ─── Simulation output ───────────────────────────────────────────────────────

/** A single player's stat line from the drive sim. Fields are role-dependent. */
export interface PlayerStatLine {
  playerId: string
  name: string
  team: TeamId
  slot: RosterSlot
  // Passing
  passYds: number
  passTd: number
  int: number
  completions: number
  attempts: number
  // Rushing
  rushYds: number
  rushTd: number
  carries: number
  // Receiving
  recYds: number
  recTd: number
  receptions: number
  targets: number
  // Defense
  tackles: number
  sacks: number
  interceptions: number
  forcedIncompletions: number
}

export interface TeamBox {
  team: TeamId
  points: number
  totalYards: number
  passYards: number
  rushYards: number
  firstDowns: number
  thirdDownAtt: number
  thirdDownConv: number
  turnovers: number
  sacks: number
  timeOfPossession: number // seconds
  drives: number
}

export interface QuarterScore {
  quarter: number
  p1: number
  p2: number
}

export type ScoringKind = "TD_PASS" | "TD_RUN" | "FG" | "SAFETY" | "TD_DEF"

export interface ScoringPlay {
  quarter: number
  clock: number // seconds remaining in quarter
  team: TeamId
  kind: ScoringKind
  yards: number
  p1Score: number
  p2Score: number
  text: string
  big?: boolean
}

export interface MatchupNote {
  text: string
  favors: TeamId
}

export interface TeamAnalysisPoint {
  text: string
  positive: boolean
}

export interface ScoutReport {
  team: TeamId
  strongestArea: string
  weakestArea: string
  likelyStrategy: string
  biggestThreat: string
}

export type ComparisonKey =
  | "passingOffense"
  | "rushingOffense"
  | "passProtection"
  | "explosiveness"
  | "passRush"
  | "coverage"
  | "runDefense"
  | "balance"

export interface NflGameResult {
  season: Season
  winner: TeamId
  finalScore: { p1: number; p2: number }
  quarters: QuarterScore[]
  scoringPlays: ScoringPlay[]
  box: PlayerStatLine[]
  teamBox: Record<TeamId, TeamBox>
  mvp: { playerId: string; name: string; team: TeamId; line: string }
  topPerformers: { playerId: string; name: string; team: TeamId; line: string }[]
  matchupNotes: MatchupNote[]
  analysis: Record<TeamId, TeamAnalysisPoint[]>
  scoutReports: Record<TeamId, ScoutReport>
  teamComparison: Record<ComparisonKey, { p1: number; p2: number }>
  /** Single most game-changing scoring play, for the summary headline. */
  gameChangingPlay: ScoringPlay | null
}
