/**
 * Post-simulation analysis — turns raw unit ratings and box scores into the
 * human-readable layer the summary screen shows: scout reports, matchup notes,
 * and "why you won / almost lost".
 */

import type {
  NflGameResult,
  RosterState,
  ScoutReport,
  TeamAnalysisPoint,
  MatchupNote,
  TeamId,
} from "./types"
import { buildTeamProfile, type NflTeamProfile } from "./teamRating"
import { orderedRoster } from "./roster"
import { unitImpact } from "./value"

/** Attach scout reports, matchup notes, and analysis to a raw sim result. */
export function analyzeResult(
  raw: NflGameResult,
  rosterP1: RosterState,
  rosterP2: RosterState
): NflGameResult {
  const p1 = buildTeamProfile("P1", rosterP1)
  const p2 = buildTeamProfile("P2", rosterP2)

  return {
    ...raw,
    matchupNotes: buildMatchupNotes(p1, p2),
    scoutReports: {
      P1: buildScoutReport("P1", p1, rosterP2, p2),
      P2: buildScoutReport("P2", p2, rosterP1, p1),
    },
    analysis: {
      P1: buildAnalysis(raw, "P1", p1, p2),
      P2: buildAnalysis(raw, "P2", p2, p1),
    },
  }
}

const UNIT_LABELS: { key: keyof NflTeamProfile; label: string; favorsHigh: true }[] = [
  { key: "passingOffense", label: "Passing offense", favorsHigh: true },
  { key: "rushingOffense", label: "Rushing offense", favorsHigh: true },
  { key: "explosiveness", label: "Explosive plays", favorsHigh: true },
  { key: "passProtection", label: "Pass protection", favorsHigh: true },
  { key: "passRush", label: "Pass rush", favorsHigh: true },
  { key: "coverage", label: "Coverage", favorsHigh: true },
  { key: "runDefense", label: "Run defense", favorsHigh: true },
]

function buildMatchupNotes(p1: NflTeamProfile, p2: NflTeamProfile): MatchupNote[] {
  const notes: MatchupNote[] = []
  for (const { key, label } of UNIT_LABELS) {
    const a = p1[key] as number
    const b = p2[key] as number
    const gap = a - b
    if (Math.abs(gap) >= 8) {
      notes.push({ text: `${label} edge`, favors: gap > 0 ? "P1" : "P2" })
    }
  }
  return notes.slice(0, 6)
}

/** A team's OWN scout report on the OPPONENT it's about to face. */
function buildScoutReport(
  team: TeamId,
  _own: NflTeamProfile,
  oppRoster: RosterState,
  opp: NflTeamProfile
): ScoutReport {
  // Strongest / weakest OFFENSIVE-vs-DEFENSIVE area of the opponent.
  const offenseUnits: [string, number][] = [
    ["Passing offense", opp.passingOffense],
    ["Rushing offense", opp.rushingOffense],
    ["Explosive passing", opp.explosiveness],
  ]
  const defenseUnits: [string, number][] = [
    ["Pass rush", opp.passRush],
    ["Coverage", opp.coverage],
    ["Run defense", opp.runDefense],
  ]
  const all = [...offenseUnits, ...defenseUnits].sort((a, b) => b[1] - a[1])
  const strongest = all[0]
  const weakest = all[all.length - 1]

  // Likely strategy from opponent's offensive tilt.
  const likely =
    opp.passingOffense + opp.explosiveness > opp.rushingOffense + 20
      ? "Aggressive passing"
      : opp.rushingOffense > opp.passingOffense + 8
        ? "Run-heavy, control the clock"
        : "Balanced attack"

  // Biggest threat = highest role-impact skill player on the opponent.
  const skill = orderedRoster(oppRoster)
    .filter((o) => ["QB", "RB", "WR1", "WR2", "TE"].includes(o.slot))
    .sort((a, b) => unitImpact(b.player) - unitImpact(a.player))[0]

  return {
    team, // the team RECEIVING this scout report
    strongestArea: strongest[0],
    weakestArea: weakest[0],
    likelyStrategy: likely,
    biggestThreat: skill?.player.name ?? "Unknown",
  }
}

function buildAnalysis(
  raw: NflGameResult,
  team: TeamId,
  own: NflTeamProfile,
  opp: NflTeamProfile
): TeamAnalysisPoint[] {
  const points: TeamAnalysisPoint[] = []
  const won = raw.winner === team
  const box = raw.teamBox[team]
  const oppBox = raw.teamBox[team === "P1" ? "P2" : "P1"]

  const push = (text: string, positive: boolean) => points.push({ text, positive })

  // Unit edges vs the opponent.
  if (own.passingOffense - opp.coverage >= 8) push("WR separation advantage", true)
  if (own.passRush - opp.passProtection >= 8) push("Elite QB pressure", true)
  if (own.runDefense - opp.rushingOffense >= 8) push("Stout run defense", true)
  if (own.coverage - opp.passingOffense >= 8) push("Lockdown coverage", true)

  // Weaknesses that showed up.
  if (opp.rushingOffense - own.runDefense >= 8) push("Weak run defense", false)
  if (opp.explosiveness - own.coverage >= 10) push("Gave up explosive passes", false)
  if (opp.passRush - own.passProtection >= 8) push("Struggled to protect the QB", false)

  // Box-score reads.
  if (box.turnovers >= 2) push(`${box.turnovers} turnovers hurt`, false)
  if (oppBox.turnovers >= 2) push(`Forced ${oppBox.turnovers} turnovers`, true)
  if (box.thirdDownAtt > 0 && box.thirdDownConv / box.thirdDownAtt >= 0.45) push("Better third-down conversion", true)
  if (box.sacks >= 3) push(`${box.sacks} sacks`, true)

  // Ensure at least one point either way.
  if (points.length === 0) push(won ? "Balanced, mistake-free game" : "Close game, few edges", won)
  return points.slice(0, 6)
}
