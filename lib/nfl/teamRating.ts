/**
 * NflTeamRating — evaluates a full roster as a TEAM across offensive and
 * defensive units, not a sum of OVRs. The simulation reads these unit ratings;
 * the analyzer explains them.
 *
 * Units:
 *   Offense — passingOffense, rushingOffense, explosiveness, passProtection
 *   Defense — passRush, coverage, runDefense
 *   Meta    — balance, qbDependence, overall
 */

import type { NflPlayer, RosterState, TeamId } from "./types"
import { playerInSlot } from "./roster"

const A = (p: NflPlayer) => p.attributes

export interface NflTeamProfile {
  team: TeamId
  // Offense
  passingOffense: number
  rushingOffense: number
  explosiveness: number
  passProtection: number
  offenseOverall: number
  // Defense
  passRush: number
  coverage: number
  runDefense: number
  defenseOverall: number
  // Meta
  balance: number // 0 (lopsided) .. 99 (even)
  qbDependence: number // how much the offense leans on the QB
  overall: number
}

function clamp(v: number, lo = 1, hi = 99): number {
  return Math.max(lo, Math.min(hi, v))
}

export function buildTeamProfile(team: TeamId, roster: RosterState): NflTeamProfile {
  const qb = playerInSlot(roster, "QB")
  const rb = playerInSlot(roster, "RB")
  const wr1 = playerInSlot(roster, "WR1")
  const wr2 = playerInSlot(roster, "WR2")
  const te = playerInSlot(roster, "TE")
  const edge = playerInSlot(roster, "EDGE")
  const lb = playerInSlot(roster, "LB")
  const cb = playerInSlot(roster, "CB")
  const s = playerInSlot(roster, "S")

  const receivers = [wr1, wr2, te].filter((p): p is NflPlayer => p !== null)

  // ── Offense ──────────────────────────────────────────────────────────────
  const qbPass = qb
    ? A(qb).shortAccuracy * 0.32 + A(qb).deepAccuracy * 0.22 + A(qb).decisionMaking * 0.24 + A(qb).pocketAwareness * 0.22
    : 45
  const receiverQuality =
    receivers.length > 0
      ? receivers.reduce((sum, p) => sum + (A(p).separation * 0.4 + A(p).catching * 0.4 + A(p).routeRunning * 0.2), 0) /
        receivers.length
      : 45
  const passingOffense = clamp(qbPass * 0.6 + receiverQuality * 0.4)

  const rushingOffense = clamp(
    rb ? A(rb).vision * 0.28 + A(rb).power * 0.24 + A(rb).speed * 0.24 + A(rb).agility * 0.24 : 45
  )

  // Explosiveness: deep passing × receiver speed/yac + back home-run ability.
  const wrSpeed = receivers.length > 0 ? Math.max(...receivers.map((p) => A(p).speed)) : 45
  const wrYac = receivers.length > 0 ? Math.max(...receivers.map((p) => A(p).yac)) : 45
  const explosiveness = clamp(
    (qb ? A(qb).deepAccuracy : 45) * 0.4 + wrSpeed * 0.3 + wrYac * 0.15 + (rb ? A(rb).speed : 45) * 0.15
  )

  // Pass protection proxy: TE blocking + QB pocket/mobility (no OL in this game).
  const passProtection = clamp(
    (te ? (A(te).passBlock * 0.5 + A(te).runBlock * 0.2) : 40) +
      (qb ? A(qb).pocketAwareness * 0.2 + A(qb).mobility * 0.1 : 20)
  )

  const offenseOverall = clamp(
    passingOffense * 0.42 + rushingOffense * 0.24 + explosiveness * 0.2 + passProtection * 0.14
  )

  // ── Defense ──────────────────────────────────────────────────────────────
  const passRush = clamp(
    (edge ? A(edge).passRush * 0.6 + A(edge).power * 0.1 : 40) +
      (lb ? A(lb).passRush * 0.15 : 0) +
      (s ? A(s).passRush * 0.05 : 0)
  )

  const coverageUnit = [cb, s, lb].filter((p): p is NflPlayer => p !== null)
  const coverage = clamp(
    coverageUnit.length > 0
      ? coverageUnit.reduce((sum, p) => sum + (A(p).coverage * 0.7 + A(p).ballHawk * 0.3), 0) / coverageUnit.length
      : 45
  )

  const runUnit = [edge, lb, s].filter((p): p is NflPlayer => p !== null)
  const runDefense = clamp(
    runUnit.length > 0
      ? runUnit.reduce((sum, p) => sum + (A(p).runStop * 0.6 + A(p).tackling * 0.4), 0) / runUnit.length
      : 45
  )

  const defenseOverall = clamp(passRush * 0.34 + coverage * 0.36 + runDefense * 0.3)

  // ── Meta ───────────────────────────────────────────────────────────────
  const balance = clamp(99 - Math.abs(offenseOverall - defenseOverall) * 1.4)
  // QB dependence: strong QB with weak surrounding cast = high dependence.
  const qbDependence = clamp(qb ? Math.max(0, A(qb).decisionMaking - receiverQuality) + 40 : 40)
  const overall = Math.round((offenseOverall + defenseOverall) / 2)

  return {
    team,
    passingOffense,
    rushingOffense,
    explosiveness,
    passProtection,
    offenseOverall,
    passRush,
    coverage,
    runDefense,
    defenseOverall,
    balance,
    qbDependence,
    overall,
  }
}
