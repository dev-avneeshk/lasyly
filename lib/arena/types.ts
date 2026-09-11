/**
 * NBA 1v1 Auction Draft — core type system.
 *
 * The data layer is intentionally decoupled from the engine. Player ratings are
 * *season-scoped*: a player object represents how good that player is DURING a
 * given season (e.g. "2025-26"), not their historical peak. To add a new season,
 * drop a new data file that produces `SeasonPlayer[]` — no engine changes needed.
 */

export type Season = "2025-26" | (string & {})

/** Standard basketball positions. */
export type Position = "PG" | "SG" | "SF" | "PF" | "C"

/** A roster slot. Five starters (one per position) + one flexible bench slot. */
export type RosterSlot = Position | "BENCH"

export const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"]
export const ROSTER_SLOTS: RosterSlot[] = ["PG", "SG", "SF", "PF", "C", "BENCH"]

/**
 * Detailed per-player attributes on a 0-99 scale.
 *
 * These drive the simulation. OVR is NOT the only thing that matters — two
 * players with the same OVR can play completely differently based on these.
 */
export interface PlayerAttributes {
  // Scoring
  scoring: number
  threePointShooting: number
  midrange: number
  finishing: number
  freeThrow: number
  // Creation
  playmaking: number
  ballHandling: number
  passing: number
  // Rebounding
  rebounding: number
  // Defense
  interiorDefense: number
  perimeterDefense: number
  rimProtection: number
  steal: number
  block: number
  // Physical
  speed: number
  athleticism: number
  strength: number
  stamina: number
  // Mental / situational
  clutch: number
  basketballIQ: number
  decisionMaking: number
  // Role
  usage: number // how ball-dominant this player wants to be (0-99)
  efficiency: number // scoring efficiency (TS%-like, 0-99)
  turnoverRisk: number // higher = more turnovers (0-99)
}

export type PlayerTier = 1 | 2 | 3 | 4

/**
 * A season-scoped player. `overall` and `attributes` reflect the player's
 * ability *in that season*. `startingBid` is a suggested opening price derived
 * from tier — the live auction may resolve higher or lower.
 */
export interface SeasonPlayer {
  id: string
  name: string
  team: string
  season: Season
  primaryPosition: Position
  secondaryPositions: Position[]
  overall: number
  tier: PlayerTier
  startingBid: number
  /** Official NBA person id — used to build the CDN headshot URL. */
  nbaId?: number
  attributes: PlayerAttributes
  strengths: string[]
  weaknesses: string[]
}

/** A player once acquired: the player plus who owns them and what they cost. */
export interface OwnedPlayer {
  player: SeasonPlayer
  price: number
  slot: RosterSlot
}

export type TeamId = "P1" | "P2"

/** Which slots a roster still needs filled. */
export interface RosterState {
  slots: Record<RosterSlot, OwnedPlayer | null>
}

// ─── Auction / Game State ────────────────────────────────────────────────────

export type GameStatus =
  | "lobby"
  | "auction"
  | "lineup"
  | "simulating"
  | "complete"

export interface AuctionLot {
  /** The player currently up for bid. */
  player: SeasonPlayer
  currentBid: number
  /** Who currently holds the high bid, or null at open. */
  highBidder: TeamId | null
  /** Suggested opening bid for this lot. */
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

export interface ArenaGameConfig {
  season: Season
  budgetPerPlayer: number
  rosterSize: number
  starters: number
  bench: number
  /** Auction countdown in seconds; resets (shorter) after each bid. */
  auctionTimerSeconds: number
  auctionTimerResetSeconds: number
  /** Fixed amount each "Bid" click adds to the current bid. */
  bidIncrement: number
  /** CPU difficulty. Maps internally to strategy strength. */
  difficulty: AIDifficulty
  aiPersonality: AIPersonality
}

export const DEFAULT_CONFIG: ArenaGameConfig = {
  season: "2025-26",
  budgetPerPlayer: 25,
  rosterSize: 6,
  starters: 5,
  bench: 1,
  auctionTimerSeconds: 10,
  auctionTimerResetSeconds: 5,
  bidIncrement: 1,
  difficulty: "medium",
  aiPersonality: "balanced",
}

/** Player-facing CPU difficulty. */
export type AIDifficulty = "easy" | "medium" | "hard"

/** Preset budgets exposed in the lobby, each a distinct "league". */
export const BUDGET_PRESETS = [25, 50, 100] as const
export type BudgetPreset = (typeof BUDGET_PRESETS)[number]

/** Bid increment scales with the league so higher budgets bid in bigger steps. */
export function bidIncrementForBudget(budget: number): number {
  if (budget >= 100) return 5
  if (budget >= 50) return 2
  return 1
}

export type AIPersonality =
  | "balanced"
  | "aggressive"
  | "value"
  | "superstar"
  | "defense"
  | "offense"

/**
 * The best-performing CPU personality at each difficulty, measured by a
 * personality-vs-personality round robin with both seats locked to the same
 * difficulty (see __tests__/arena/cpu-vs-cpu.sim.test.ts; 750 games per
 * personality per difficulty across all three budgets).
 *
 *   easy   → defense    (51.7%) weak CPUs under-value stoppers, so they're cheap
 *   medium → superstar  (52.7%) concentrating budget on studs beats spreading it
 *   hard   → aggressive (50.8%) evenly-matched sharks must pay up to land studs
 *
 * The spread between personalities is small (~47–53%); difficulty is by far the
 * dominant factor, so treat this as a tiebreaker rather than a big lever.
 */
export function bestPersonalityForDifficulty(d: AIDifficulty): AIPersonality {
  switch (d) {
    case "hard": return "aggressive"
    case "medium": return "superstar"
    case "easy":
    default: return "defense"
  }
}

// ─── Simulation output ───────────────────────────────────────────────────────

export interface PlayerBoxLine {
  playerId: string
  name: string
  team: TeamId
  slot: RosterSlot
  min: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
}

export interface TeamBox {
  team: TeamId
  points: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  reb: number
  ast: number
  tov: number
  stl: number
  blk: number
  paintPoints: number
  fastBreakPoints: number
  secondChancePoints: number
}

export interface QuarterScore {
  quarter: number
  p1: number
  p2: number
}

export interface GameMoment {
  /** Quarter (1-4, 5+ = OT). */
  quarter: number
  /** Seconds remaining in the quarter when the moment happened. */
  clock: number
  team: TeamId
  p1Score: number
  p2Score: number
  /** Highlight-worthy moments get emphasized in the UI. */
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

export interface GameResult {
  season: Season
  winner: TeamId
  finalScore: { p1: number; p2: number }
  quarters: QuarterScore[]
  moments: GameMoment[]
  boxScore: PlayerBoxLine[]
  teamBox: Record<TeamId, TeamBox>
  mvp: { playerId: string; name: string; team: TeamId }
  topPerformers: { playerId: string; name: string; team: TeamId; line: string }[]
  matchupNotes: MatchupNote[]
  analysis: Record<TeamId, TeamAnalysisPoint[]>
  teamComparison: Record<
    "offense" | "defense" | "shooting" | "rebounding" | "playmaking" | "athleticism" | "bench" | "chemistry",
    { p1: number; p2: number }
  >
}
