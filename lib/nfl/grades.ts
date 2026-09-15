/**
 * ManagerGrade — post-auction report card for a roster.
 *
 * Pure, deterministic, and driven ENTIRELY by engine data (roster, prices, the
 * value model, team profile). The frontend never invents grades; it renders
 * what this module computes. Mirrors the intent of the NBA arena's post-game
 * analysis, adapted for football units.
 *
 * Grades answer two questions per position group and overall:
 *   1. TALENT  — how good are the players you assembled? (value model)
 *   2. VALUE   — did you pay a fair price for that talent? (price vs estimate)
 *
 * Plus whole-roster reads: budget management, value hunting, roster balance.
 */

import type { NflPlayer, OwnedPlayer, RosterState, TeamId } from "./types"
import { orderedRoster } from "./roster"
import { playerValue, scaledOpeningBid } from "./value"
import { buildTeamProfile } from "./teamRating"

export type LetterGrade =
  | "A+" | "A" | "A-"
  | "B+" | "B" | "B-"
  | "C+" | "C" | "C-"
  | "D+" | "D" | "D-"
  | "F"

export interface PositionGrade {
  group: "QB" | "RB" | "WR" | "TE" | "DEF"
  label: string
  grade: LetterGrade
  /** 0-100 blended score behind the letter. */
  score: number
  /** Short human explanation grounded in the numbers. */
  note: string
}

export interface AuctionInsight {
  playerId: string
  playerName: string
  position: string
  price: number
  estimate: number
  /** estimate - price. Positive = bargain, negative = overpay. */
  delta: number
}

export interface ManagerGrade {
  team: TeamId
  overall: LetterGrade
  overallScore: number
  positions: PositionGrade[]
  budgetManagement: { grade: LetterGrade; note: string }
  valueHunting: { grade: LetterGrade; note: string }
  rosterBalance: { grade: LetterGrade; note: string }
  bestBuy: AuctionInsight | null
  biggestOverpay: AuctionInsight | null
  /** 0-100: how efficiently talent was acquired per dollar. */
  budgetEfficiency: number
  totalSpent: number
}

const GRADE_STEPS: { min: number; grade: LetterGrade }[] = [
  { min: 97, grade: "A+" },
  { min: 92, grade: "A" },
  { min: 88, grade: "A-" },
  { min: 84, grade: "B+" },
  { min: 79, grade: "B" },
  { min: 75, grade: "B-" },
  { min: 70, grade: "C+" },
  { min: 65, grade: "C" },
  { min: 60, grade: "C-" },
  { min: 55, grade: "D+" },
  { min: 50, grade: "D" },
  { min: 45, grade: "D-" },
  { min: 0, grade: "F" },
]

/** Map a 0-100 score to a letter grade. */
export function scoreToGrade(score: number): LetterGrade {
  const s = Math.max(0, Math.min(100, score))
  return (GRADE_STEPS.find((g) => s >= g.min) ?? GRADE_STEPS[GRADE_STEPS.length - 1]).grade
}

/** Estimated fair auction price for a player, in the league's budget units. */
export function estimatedPrice(player: NflPlayer, budget: number, rosterSize: number): number {
  // A contested market pays ~1.1× the opening reserve for a coveted player.
  return Math.max(1, Math.round(scaledOpeningBid(player, budget, rosterSize) * 1.1))
}

/** Which grade group a roster player belongs to. */
function groupFor(player: NflPlayer): PositionGrade["group"] {
  switch (player.position) {
    case "QB": return "QB"
    case "RB": return "RB"
    case "WR": return "WR"
    case "TE": return "TE"
    default: return "DEF" // EDGE / LB / CB / S
  }
}

const GROUP_LABEL: Record<PositionGrade["group"], string> = {
  QB: "Quarterback",
  RB: "Running Back",
  WR: "Wide Receiver",
  TE: "Tight End",
  DEF: "Defense",
}

/**
 * Talent grade for a set of owned players: blends the value model (0-100) of
 * the players with a small penalty for empty demand (handled by caller — every
 * slot is filled by finalize, so groups are always populated).
 */
function talentScore(players: NflPlayer[]): number {
  if (players.length === 0) return 45
  const avg = players.reduce((s, p) => s + playerValue(p), 0) / players.length
  // playerValue is roughly 55..95; stretch to a fuller grade range.
  return Math.round(clamp((avg - 52) * (100 / 43), 20, 100))
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Build the full report card for one team's roster. */
export function gradeManager(
  team: TeamId,
  roster: RosterState,
  budget: number,
  rosterSize: number
): ManagerGrade {
  const owned = orderedRoster(roster)
  const totalSpent = owned.reduce((s, o) => s + o.price, 0)

  // ── Per-position talent + value ────────────────────────────────────────
  const groups: PositionGrade["group"][] = ["QB", "RB", "WR", "TE", "DEF"]
  const positions: PositionGrade[] = groups.map((group) => {
    const members = owned.filter((o) => groupFor(o.player) === group)
    const talent = talentScore(members.map((o) => o.player))

    // Value: did you pay near the estimate? Reward paying under, penalize over.
    const value = valueScoreFor(members, budget, rosterSize)

    // Position grade weights talent heavier than value (talent wins games).
    const score = Math.round(talent * 0.68 + value * 0.32)
    return {
      group,
      label: GROUP_LABEL[group],
      grade: scoreToGrade(score),
      score,
      note: positionNote(group, talent, value, members),
    }
  })

  // ── Whole-roster reads ────────────────────────────────────────────────
  const insights = owned
    .map((o) => toInsight(o, budget, rosterSize))
    .sort((a, b) => b.delta - a.delta)
  const bestBuy = insights.length > 0 && insights[0].delta > 0 ? insights[0] : insights[0] ?? null
  const biggestOverpay =
    insights.length > 0 && insights[insights.length - 1].delta < 0
      ? insights[insights.length - 1]
      : null

  // Value hunting: total estimated value acquired vs total paid.
  const totalEstimate = owned.reduce((s, o) => s + estimatedPrice(o.player, budget, rosterSize), 0)
  const budgetEfficiency = clamp(Math.round((totalEstimate / Math.max(1, totalSpent)) * 62), 20, 100)
  const valueHuntScore = clamp(Math.round(50 + (totalEstimate - totalSpent) * 2.2), 20, 100)

  // Budget management: penalize both leaving lots of money unspent AND spending
  // to the last dollar (no flexibility). Sweet spot is spending ~92-100%.
  const spentPct = totalSpent / Math.max(1, budget)
  const bmScore = clamp(Math.round(100 - Math.abs(0.95 - spentPct) * 220), 25, 100)

  // Roster balance from the team profile (offense vs defense evenness).
  const profile = buildTeamProfile(team, roster)
  const balanceScore = clamp(Math.round(profile.balance), 20, 100)

  const overallScore = Math.round(
    positions.reduce((s, p) => s + p.score, 0) / positions.length * 0.6 +
      valueHuntScore * 0.15 +
      bmScore * 0.12 +
      balanceScore * 0.13
  )

  return {
    team,
    overall: scoreToGrade(overallScore),
    overallScore,
    positions,
    budgetManagement: {
      grade: scoreToGrade(bmScore),
      note: budgetNote(spentPct, budget - totalSpent),
    },
    valueHunting: {
      grade: scoreToGrade(valueHuntScore),
      note:
        totalEstimate >= totalSpent
          ? `Acquired ~$${totalEstimate} of value for $${totalSpent}.`
          : `Paid $${totalSpent} for ~$${totalEstimate} of estimated value.`,
    },
    rosterBalance: {
      grade: scoreToGrade(balanceScore),
      note:
        balanceScore >= 80
          ? "Well-balanced across offense and defense."
          : profile.offenseOverall >= profile.defenseOverall
            ? "Offense-heavy build — defense lags behind."
            : "Defense-first build — offense could stall.",
    },
    bestBuy,
    biggestOverpay,
    budgetEfficiency,
    totalSpent,
  }
}

function valueScoreFor(members: OwnedPlayer[], budget: number, rosterSize: number): number {
  if (members.length === 0) return 55
  let scoreSum = 0
  for (const o of members) {
    const est = estimatedPrice(o.player, budget, rosterSize)
    const delta = est - o.price // + = bargain
    // Normalize delta against the estimate so it scales across budgets.
    const rel = delta / Math.max(1, est)
    scoreSum += clamp(70 + rel * 90, 20, 100)
  }
  return Math.round(scoreSum / members.length)
}

function toInsight(o: OwnedPlayer, budget: number, rosterSize: number): AuctionInsight {
  const estimate = estimatedPrice(o.player, budget, rosterSize)
  return {
    playerId: o.player.id,
    playerName: o.player.name,
    position: o.player.position,
    price: o.price,
    estimate,
    delta: estimate - o.price,
  }
}

function positionNote(
  group: PositionGrade["group"],
  talent: number,
  value: number,
  members: OwnedPlayer[],
): string {
  const name = members[0]?.player.name
  if (talent >= 85) return `Elite ${GROUP_LABEL[group].toLowerCase()} talent${name ? ` led by ${name}` : ""}.`
  if (talent >= 72) return `Solid, dependable ${GROUP_LABEL[group].toLowerCase()} group.`
  if (value >= 78) return `Modest talent but great value on the dollar.`
  if (talent < 55) return `Thin here — a clear weak spot to exploit.`
  return `Average ${GROUP_LABEL[group].toLowerCase()} production expected.`
}

function budgetNote(spentPct: number, leftover: number): string {
  if (spentPct >= 0.99) return "Spent to the last dollar — no flexibility late."
  if (spentPct >= 0.9) return "Efficient spending, nearly full allocation."
  if (leftover > 0) return `Left $${leftover} on the table — could've upgraded.`
  return "Balanced budget usage."
}
