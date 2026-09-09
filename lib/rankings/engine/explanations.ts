/**
 * NBA Ranking Engine — Explanation Generator
 *
 * Generates human-readable explanation text for player and team rankings.
 * Template-based — no LLM. Fast, deterministic, and consistent.
 *
 * All outputs are written into the ranking row for fast UI reads.
 */

import { TIER_THRESHOLDS } from "../config"
import type {
  PlayerScoreBreakdown,
  RankingTier,
  NBAPosition,
} from "../types"

// ─── Tier Assignment ──────────────────────────────────────────────────────────

/**
 * Assigns a tier label from a score (0-100).
 * Checked in descending order from highest threshold.
 */
export function assignTier(score: number): RankingTier {
  for (const { tier, min } of TIER_THRESHOLDS) {
    if (score >= min) return tier
  }
  return "E — Fringe"
}

// ─── Strength/Weakness Labels ─────────────────────────────────────────────────

/** Returns an array of strength labels based on component scores */
export function getStrengths(breakdown: PlayerScoreBreakdown): string[] {
  const strengths: string[] = []
  const { offense_score, defense_score, scoring_score, playmaking_score,
          rebounding_score, shooting_score, two_way_score } = breakdown

  if (two_way_score >= 80)         strengths.push("Elite Two-Way Player")
  else if (two_way_score >= 70)    strengths.push("Solid Two-Way Player")

  if (scoring_score >= 85)         strengths.push("Elite Scorer")
  else if (scoring_score >= 75)    strengths.push("Consistent Scorer")

  if (playmaking_score >= 85)      strengths.push("Elite Playmaker")
  else if (playmaking_score >= 75) strengths.push("Quality Playmaker")

  if (rebounding_score >= 85)      strengths.push("Elite Rebounder")
  else if (rebounding_score >= 75) strengths.push("Reliable Rebounder")

  if (defense_score >= 85)         strengths.push("Elite Defender")
  else if (defense_score >= 75)    strengths.push("Quality Defender")

  if (shooting_score >= 85)        strengths.push("Elite Shooter")
  else if (shooting_score >= 75)   strengths.push("Reliable Shooter")

  if (offense_score >= 85)         strengths.push("Offensive Cornerstone")

  return strengths.slice(0, 4)  // max 4 strengths
}

/** Returns an array of weakness labels based on below-average component scores */
export function getWeaknesses(breakdown: PlayerScoreBreakdown): string[] {
  const weaknesses: string[] = []
  const { defense_score, rebounding_score, shooting_score, playmaking_score,
          availability_score } = breakdown

  if (defense_score < 40)         weaknesses.push("Below-Average Defender")
  else if (defense_score < 30)    weaknesses.push("Defensive Liability")

  if (rebounding_score < 30)      weaknesses.push("Poor Rebounder")
  else if (rebounding_score < 40) weaknesses.push("Below-Average Rebounder")

  if (shooting_score < 35)        weaknesses.push("Limited Shooter")

  if (playmaking_score < 35)      weaknesses.push("Limited Playmaker")

  if (availability_score < 50)    weaknesses.push("Health/Availability Concern")

  return weaknesses.slice(0, 3)  // max 3 weaknesses
}

// ─── Player Explanation ───────────────────────────────────────────────────────

export function generatePlayerExplanation(
  playerName: string,
  rank: number,
  score: number,
  tier: RankingTier,
  position: NBAPosition | null,
  team: string | null,
  historicalTeam: string | null,
  rankChange: number | null,
  isNew: boolean,
  isProjection: boolean,
  breakdown: PlayerScoreBreakdown
): { explanation: string; outlook: string } {
  const seasonLabel = isProjection ? "2026-27" : "2025-26"
  const tierDesc = getTierDescription(tier)
  const posLabel = position ? `${position} ` : ""

  // Movement context
  let movementText = ""
  if (isNew) {
    movementText = `First time ranked in Lasyly's Top 100. `
  } else if (rankChange !== null) {
    if (rankChange > 5)      movementText = `Shot up ${rankChange} spots from last season. `
    else if (rankChange > 0) movementText = `Moved up ${rankChange} spots from last season. `
    else if (rankChange < -5) movementText = `Dropped ${Math.abs(rankChange)} spots from last season. `
    else if (rankChange < 0)  movementText = `Fell ${Math.abs(rankChange)} spots from last season. `
    else                     movementText = `Holds steady from last season. `
  }

  // Team change context
  const teamChangeText =
    team && historicalTeam && team !== historicalTeam
      ? `Moves from ${historicalTeam} to ${team} for ${seasonLabel}. `
      : team
      ? `Remains with ${team}. `
      : ""

  // Primary strength narrative
  const primaryStrength = getPrimaryStrengthNarrative(breakdown)

  const explanation = [
    `Ranked #${rank} overall ${isProjection ? "entering" : "in"} ${seasonLabel}.`,
    `${tierDesc} ${posLabel}with ${primaryStrength}.`,
    movementText,
    teamChangeText,
  ].filter(Boolean).join(" ").trim()

  // Outlook (projection-only)
  const outlook = isProjection
    ? generateOutlook(playerName, breakdown, rankChange)
    : ""

  return { explanation, outlook }
}

// ─── Team Explanation ─────────────────────────────────────────────────────────

export function generateTeamExplanation(
  team: string,
  rank: number,
  powerScore: number,
  rankChange: number | null,
  keyAdditions: string[],
  keyLosses: string[],
  isProjection: boolean
): { explanation: string; why_ranked_here: string } {
  const seasonLabel = isProjection ? "2026-27" : "2025-26"
  const tier = assignTier(powerScore)

  let movementText = ""
  if (rankChange !== null) {
    if (rankChange > 3)       movementText = `Jumped ${rankChange} spots in the power rankings. `
    else if (rankChange > 0)  movementText = `Moved up ${rankChange} spots. `
    else if (rankChange < -3) movementText = `Fell ${Math.abs(rankChange)} spots after roster changes. `
    else if (rankChange < 0)  movementText = `Slid ${Math.abs(rankChange)} spots. `
  }

  const additionsText = keyAdditions.length > 0
    ? `Added ${keyAdditions.slice(0, 2).join(" and ")}. `
    : ""

  const lossesText = keyLosses.length > 0
    ? `Lost ${keyLosses.slice(0, 2).join(" and ")}. `
    : ""

  const explanation = [
    `The ${team} rank #${rank} entering ${seasonLabel}.`,
    movementText,
    additionsText,
    lossesText,
  ].filter(Boolean).join(" ").trim()

  const why_ranked_here = getTeamRankingRationale(tier, powerScore, keyAdditions, keyLosses)

  return { explanation, why_ranked_here }
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

function getTierDescription(tier: RankingTier): string {
  switch (tier) {
    case "Ω — Apex":       return "The absolute summit of the league"
    case "X — Mythic":     return "Generationally dominant player"
    case "S — Elite":      return "League-defining elite talent"
    case "A — Dominant":   return "Dominant high-level NBA player"
    case "B — Impact":     return "Significant high-level NBA contributor"
    case "C — Rotation":   return "Strong NBA rotation player"
    case "D — Limited":    return "Limited NBA-level impact"
    case "E — Fringe":     return "Fringe NBA contributor"
  }
}

function getPrimaryStrengthNarrative(breakdown: PlayerScoreBreakdown): string {
  const { offense_score, defense_score, scoring_score, playmaking_score,
          rebounding_score, shooting_score } = breakdown

  const categories = [
    { label: "elite scoring and offensive creation", score: scoring_score + offense_score },
    { label: "dominant playmaking and vision",        score: playmaking_score * 1.5 },
    { label: "elite rebounding and interior presence", score: rebounding_score * 1.5 },
    { label: "defensive versatility and impact",      score: defense_score * 1.5 },
    { label: "elite shooting and floor spacing",       score: shooting_score * 1.5 },
    { label: "high offensive floor and consistency",   score: offense_score },
  ]

  // Return label of highest combined score
  return categories.sort((a, b) => b.score - a.score)[0].label
}

function generateOutlook(
  playerName: string,
  breakdown: PlayerScoreBreakdown,
  rankChange: number | null
): string {
  const age = breakdown.age
  const ageText =
    age && age <= 23 ? `At ${age}, ${playerName} has elite developmental upside heading into 2026-27.` :
    age && age <= 27 ? `In the prime at ${age}, ${playerName} is expected to maintain at a high level.` :
    age && age <= 31 ? `At ${age}, ${playerName} enters a pivotal stage of their career.` :
    age            ? `At ${age}, ${playerName} faces age-related questions but remains impactful.` :
    `${playerName} is projected to remain a key contributor in 2026-27.`

  const trajectory =
    (rankChange ?? 0) > 5  ? "Projection shows significant upside potential." :
    (rankChange ?? 0) > 0  ? "Trending in the right direction entering the season." :
    (rankChange ?? 0) < -5 ? "Some regression expected based on multi-season trends." :
    (rankChange ?? 0) < 0  ? "Slight downward projection, though remains impactful." :
    "Projections are stable based on consistent multi-season performance."

  return `${ageText} ${trajectory}`
}

function getTeamRankingRationale(
  tier: RankingTier,
  powerScore: number,
  keyAdditions: string[],
  keyLosses: string[]
): string {
  const baseRationale =
    tier === "Ω — Apex" || tier === "X — Mythic"
      ? "This roster has elite star power and competitive depth."
      : tier === "S — Elite" || tier === "A — Dominant"
      ? "This is a legitimate playoff contender with high-end talent."
      : tier === "B — Impact" || tier === "C — Rotation"
      ? "A solid team with quality starters and competitive depth."
      : "This roster has fringe playoff potential heading into the season."

  const additionImpact = keyAdditions.length > 0
    ? ` The additions of ${keyAdditions.slice(0, 2).join(" and ")} meaningfully improve this team's ceiling.`
    : ""

  const lossImpact = keyLosses.length > 0
    ? ` The departure of ${keyLosses.slice(0, 1).join(", ")} creates a gap that offsets some of the gains.`
    : ""

  return `${baseRationale}${additionImpact}${lossImpact}`
}

// ─── Power Profile Generators ─────────────────────────────────────────────────

export function generateSignature(breakdown: PlayerScoreBreakdown): string {
  const b = breakdown
  if (b.scoring_score >= 90 && b.playmaking_score >= 85) return "THE ENGINE"
  if (b.scoring_score >= 90) return "THE EXECUTOR"
  if (b.shooting_score >= 90) return "THE SNIPER"
  if (b.playmaking_score >= 90) return "THE ARCHITECT"
  if (b.defense_score >= 90 && b.rebounding_score >= 80) return "THE ANCHOR"
  if (b.defense_score >= 90) return "THE SENTINEL"
  if (b.rebounding_score >= 90) return "THE GLASS"
  if (b.two_way_score >= 85) return "THE TWO-WAY"
  if (b.playmaking_score >= 80 && b.two_way_score >= 80) return "THE CATALYST"

  if (b.offense_score > b.defense_score + 15) return "THE OFFENSIVE THREAT"
  if (b.defense_score > b.offense_score + 15) return "THE SPECIALIST"
  return "THE GENERALIST"
}

export function generatePlayerClass(breakdown: PlayerScoreBreakdown): string {
  return generateSignature(breakdown)
}

export function generatePotential(age: number | null, rankChange: number | null, score: number): string {
  if (!age) return "UNKNOWN"
  if (score >= 90) return "ELITE"
  if (age <= 23 && (rankChange ?? 0) > 5) return "ELITE"
  if (age <= 25 && (rankChange ?? 0) > 0) return "HIGH"
  if (age > 30) return "STABLE"
  return "MODERATE"
}

export function generateCeiling(currentTier: RankingTier, potential: string): string {
  if (potential === "ELITE" || potential === "HIGH") {
    const tiers: RankingTier[] = [
      "E — Fringe", "D — Limited", "C — Rotation", "B — Impact", 
      "A — Dominant", "S — Elite", "X — Mythic", "Ω — Apex"
    ]
    const idx = tiers.indexOf(currentTier)
    if (idx !== -1 && idx < tiers.length - 1) return tiers[idx + 1]
  }
  return currentTier
}

export function generateStatus(rankChange: number | null, isNew: boolean): string {
  if (isNew) return "NEW"
  if (rankChange === null) return "STABLE"
  if (rankChange >= 10) return "BREAKOUT"
  if (rankChange >= 3) return "ASCENDING"
  if (rankChange <= -10) return "DECLINING"
  if (rankChange <= -3) return "FADING"
  return "STABLE"
}

export function generateTeamClass(offensive_score: number | null, defensive_score: number | null, star_power_score: number | null): string {
  const o = offensive_score ?? 50
  const d = defensive_score ?? 50
  const s = star_power_score ?? 50
  if (o >= 90 && d >= 90) return "THE EMPIRE"
  if (d >= 90) return "THE FORTRESS"
  if (o >= 90) return "THE ENGINE"
  if (s >= 90) return "THE LEGION"
  if (o >= 75 && d >= 75) return "THE BALANCED"
  return "THE ASCENDANTS"
}
