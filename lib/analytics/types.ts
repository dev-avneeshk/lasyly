/**
 * Shared types for the analytics engine.
 * Re-exports base types and defines enhanced analytics interfaces.
 */

import { PropCardData } from "@/lib/props/types"
import { HitRateWindow } from "./hit-rates"

// ─── Matchup Grade ──────────────────────────────────────────────────────────

export type Grade = "A" | "B" | "C" | "D" | "F"

// ─── Confidence Score ───────────────────────────────────────────────────────

export interface ConfidenceBreakdown {
  l5HitRate: number       // normalized 0-1
  l10HitRate: number      // normalized 0-1
  matchupGrade: number    // normalized 0-1
  sampleSize: number      // normalized 0-1
  finalScore: number      // weighted sum 0-1
  stars: number           // 1-5
}

// ─── Correlations ───────────────────────────────────────────────────────────

export interface CorrelatedProp {
  propId: string
  player: string
  statCategory: string
  coefficient: number     // 0.50 - 1.00
}

// ─── Line Movement ──────────────────────────────────────────────────────────

export interface LineMovementData {
  currentLine: number
  previousLine: number    // 24h ago
  change: number          // absolute difference
  direction: "up" | "down"
  hasSignificantMove: boolean // >= 10% move
  history: { timestamp: string; value: number }[]
}

// ─── Sentiment ──────────────────────────────────────────────────────────────

export interface SentimentData {
  overPct: number         // 0-100
  underPct: number        // 0-100
  totalVotes: number
  userVote: "over" | "under" | null
  hasMinVotes: boolean    // true if >= 5 votes
}

// ─── Enhanced Prop Card ─────────────────────────────────────────────────────

export interface EnhancedPropCardData extends PropCardData {
  /** Multi-window hit rates */
  hitRateWindows: HitRateWindow[]

  /** Matchup grade (null if insufficient data) */
  matchupGrade: Grade | null

  /** Confidence score breakdown (null if insufficient data) */
  confidence: ConfidenceBreakdown | null

  /** Top correlated props */
  correlations: CorrelatedProp[]

  /** Line movement data (null if no history) */
  lineMovement: LineMovementData | null

  /** Community sentiment (null if not loaded) */
  sentiment: SentimentData | null

  /** Direction for this prop (over/under) */
  direction: "over" | "under"

  /** Venue context for the upcoming game */
  venue: "home" | "away" | null

  /** Upcoming opponent team name */
  upcomingOpponent: string | null

  /** Whether the "without player" filter has been applied at data level */
  withoutPlayerApplied: boolean
}

// ─── Advanced Filters ───────────────────────────────────────────────────────

export interface AdvancedFilterState {
  withoutPlayer: string           // NBA only, teammate name
  homeAway: "all" | "home" | "away"
  opposingTeam: string | null
  opposingPlayer: string | null   // optional
  minConfidence: number           // 1-5
  direction: "over" | "under" | "all"
  hitRateMin: number              // 0-100, step 5
  hitRateMax: number              // 0-100, step 5
}
