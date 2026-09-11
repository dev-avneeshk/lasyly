/**
 * TeamRatingEngine — evaluates a full roster as a TEAM, not a sum of OVRs.
 *
 * Produces a `TeamProfile` capturing the qualities that actually decide games:
 * spacing, shot creation, playmaking, rim pressure, perimeter/interior defense,
 * rebounding, transition, size, switchability, and — crucially — usage overlap
 * (five ball-dominant stars cannibalize each other) and chemistry (two-way
 * balance + spacing + shared load).
 *
 * The simulation reads these profiles; the analyzer explains them.
 */

import type { RosterState, SeasonPlayer, TeamId } from "./types"
import { starters, bench } from "./roster"

const A = (p: SeasonPlayer) => p.attributes

export interface TeamProfile {
  team: TeamId
  // Offense
  spacing: number // 3pt gravity across the lineup
  shotCreation: number // ability to generate own shots
  playmaking: number // passing / assist creation
  rimPressure: number // getting to & finishing at the rim
  offense: number // blended offensive rating
  // Defense
  perimeterDefense: number
  interiorDefense: number
  rimProtection: number
  rebounding: number
  defense: number // blended defensive rating
  // Physical / structural
  athleticism: number
  size: number
  switchability: number
  transitionOffense: number
  transitionDefense: number
  // Meta
  usageOverlap: number // 0 (balanced) .. 99 (everyone wants the ball)
  chemistry: number // fit multiplier expressed 0-99
  benchStrength: number
  // Overall (used only for display / seeding, NOT as the sole win predictor)
  overall: number
}

/** Average of a field across players, weighted by minutes proxy. */
function avg(players: SeasonPlayer[], f: (p: SeasonPlayer) => number): number {
  if (players.length === 0) return 0
  return players.reduce((s, p) => s + f(p), 0) / players.length
}

/** Top-N average (for "how good is your best rim protector" style reads). */
function topAvg(players: SeasonPlayer[], f: (p: SeasonPlayer) => number, n: number): number {
  const vals = players.map(f).sort((a, b) => b - a).slice(0, n)
  if (vals.length === 0) return 0
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

/**
 * Usage overlap: how much the lineup's shot-creation demand exceeds one ball.
 * We sum usage above a baseline; more high-usage players ⇒ higher overlap ⇒
 * diminishing returns on offense.
 */
function computeUsageOverlap(players: SeasonPlayer[]): number {
  const usages = players.map((p) => A(p).usage).sort((a, b) => b - a)
  // Only ~1.6 "ball-dominant" roles fit cleanly; penalize excess.
  let overlap = 0
  usages.forEach((u, i) => {
    const weight = i < 2 ? 0 : (i - 1) * 0.35 // 3rd, 4th, 5th options add friction
    overlap += Math.max(0, u - 70) * weight
  })
  return Math.min(99, overlap / 2)
}

/**
 * Chemistry: rewards spacing, two-way balance, and shared playmaking; punishes
 * heavy usage overlap and a lineup with no rim protection or no shooting.
 */
function computeChemistry(players: SeasonPlayer[], usageOverlap: number): number {
  const spacing = avg(players, (p) => A(p).threePointShooting)
  const shooters = players.filter((p) => A(p).threePointShooting >= 72).length
  const playmakers = players.filter((p) => A(p).playmaking >= 78).length
  const rimProtect = topAvg(players, (p) => A(p).rimProtection, 1)
  const twoWay = avg(players, (p) => Math.min(A(p).perimeterDefense, A(p).scoring))

  let score = 55
  score += (spacing - 60) * 0.35
  score += Math.min(shooters, 4) * 3 // reward multiple shooters
  score += playmakers >= 1 ? 6 : -8 // need at least one creator
  score += rimProtect >= 75 ? 6 : rimProtect < 55 ? -8 : 0
  score += (twoWay - 55) * 0.15
  score -= usageOverlap * 0.35 // ball-hog tax
  return clamp(score)
}

function clamp(v: number, lo = 1, hi = 99): number {
  return Math.max(lo, Math.min(hi, v))
}

export function buildTeamProfile(team: TeamId, roster: RosterState): TeamProfile {
  const start = starters(roster).map((o) => o.player)
  const benchPlayer = bench(roster)?.player

  const usageOverlap = computeUsageOverlap(start)
  const chemistry = computeChemistry(start, usageOverlap)

  const spacing = clamp(avg(start, (p) => A(p).threePointShooting))
  const shotCreation = clamp(topAvg(start, (p) => A(p).scoring * 0.6 + A(p).ballHandling * 0.4, 3))
  const playmaking = clamp(topAvg(start, (p) => A(p).playmaking, 2) * 0.7 + avg(start, (p) => A(p).passing) * 0.3)
  const rimPressure = clamp(topAvg(start, (p) => A(p).finishing * 0.6 + A(p).athleticism * 0.4, 3))

  const perimeterDefense = clamp(avg(start, (p) => A(p).perimeterDefense))
  const interiorDefense = clamp(topAvg(start, (p) => A(p).interiorDefense, 2))
  const rimProtection = clamp(topAvg(start, (p) => A(p).rimProtection, 1) * 0.7 + avg(start, (p) => A(p).block) * 0.3)
  const rebounding = clamp(avg(start, (p) => A(p).rebounding))

  const athleticism = clamp(avg(start, (p) => A(p).athleticism))
  const size = clamp(avg(start, (p) => A(p).strength * 0.4 + A(p).rebounding * 0.3 + A(p).interiorDefense * 0.3))
  const switchability = clamp(avg(start, (p) => Math.min(A(p).perimeterDefense, A(p).interiorDefense) * 0.6 + A(p).athleticism * 0.4))
  const transitionOffense = clamp(avg(start, (p) => A(p).speed * 0.5 + A(p).athleticism * 0.5))
  const transitionDefense = clamp(avg(start, (p) => A(p).speed * 0.4 + A(p).basketballIQ * 0.3 + A(p).stamina * 0.3))

  const chemMult = 0.9 + (chemistry / 99) * 0.2 // 0.9 .. 1.1

  // Blended offense: talent × spacing × chemistry, minus overlap friction.
  const rawOffense =
    shotCreation * 0.34 +
    spacing * 0.24 +
    playmaking * 0.2 +
    rimPressure * 0.22
  const offense = clamp(rawOffense * chemMult - usageOverlap * 0.12)

  const rawDefense =
    perimeterDefense * 0.32 +
    interiorDefense * 0.24 +
    rimProtection * 0.24 +
    rebounding * 0.2
  const defense = clamp(rawDefense * (0.95 + (chemistry / 99) * 0.1))

  const benchStrength = benchPlayer
    ? clamp(benchPlayer.overall * 0.6 + (A(benchPlayer).perimeterDefense + A(benchPlayer).scoring) / 2 * 0.4)
    : 40

  const overall = Math.round((offense + defense) / 2)

  return {
    team,
    spacing,
    shotCreation,
    playmaking,
    rimPressure,
    offense,
    perimeterDefense,
    interiorDefense,
    rimProtection,
    rebounding,
    defense,
    athleticism,
    size,
    switchability,
    transitionOffense,
    transitionDefense,
    usageOverlap,
    chemistry,
    benchStrength,
    overall,
  }
}

/**
 * Effective per-player usage share for the STARTERS after accounting for
 * overlap: five high-usage stars each get a smaller slice than they'd want.
 * Returns a map playerId → share (sums to ~1 across starters).
 */
export function usageShares(roster: RosterState): Record<string, number> {
  const start = starters(roster)
  const weights = start.map((o) => Math.pow(A(o.player).usage / 100, 1.6))
  const total = weights.reduce((s, w) => s + w, 0) || 1
  const out: Record<string, number> = {}
  start.forEach((o, i) => {
    out[o.player.id] = weights[i] / total
  })
  return out
}
