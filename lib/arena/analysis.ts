/**
 * GameResultAnalyzer — turns the raw simulation + team profiles into human
 * explanations: matchup notes, "why you won / why they lost", and enriched
 * top-performer lines. This is what makes results feel earned rather than
 * random.
 */

import type { GameResult, RosterState, TeamId, TeamAnalysisPoint } from "./types"
import { buildTeamProfile, type TeamProfile } from "./teamRating"
import { assignMatchups } from "./matchup"
import { teamTotalsFromLines } from "./boxscore"

function other(t: TeamId): TeamId {
  return t === "P1" ? "P2" : "P1"
}

/**
 * Enrich a GameResult (mutates matchupNotes + analysis) using both rosters.
 * Compares team profiles and the actual box score to justify the outcome.
 */
export function analyzeResult(
  result: GameResult,
  rosterP1: RosterState,
  rosterP2: RosterState
): GameResult {
  const profiles: Record<TeamId, TeamProfile> = {
    P1: buildTeamProfile("P1", rosterP1),
    P2: buildTeamProfile("P2", rosterP2),
  }
  const winner = result.winner
  const loser = other(winner)

  // ── Matchup notes: biggest edges in both directions ──────────────────────
  const setW = assignMatchups(winner === "P1" ? rosterP1 : rosterP2, winner === "P1" ? rosterP2 : rosterP1)
  const notes = setW.matchups
    .filter((m) => Math.abs(m.edge) >= 10)
    .sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))
    .slice(0, 3)
    .map((m) => ({ text: m.note, favors: (m.edge > 0 ? winner : loser) as TeamId }))
  result.matchupNotes = notes

  // ── Box-derived facts ─────────────────────────────────────────────────────
  const wTot = teamTotalsFromLines(result.boxScore, winner)
  const lTot = teamTotalsFromLines(result.boxScore, loser)
  const wBox = result.teamBox[winner]
  const lBox = result.teamBox[loser]

  // ── Why the winner won ────────────────────────────────────────────────────
  const winPts: TeamAnalysisPoint[] = []
  const wp = profiles[winner]
  const lp = profiles[loser]

  if (wp.offense - lp.defense > 6) winPts.push({ text: "Offense consistently beat their defense", positive: true })
  if (wp.spacing - lp.spacing > 6) winPts.push({ text: "Better spacing opened cleaner looks", positive: true })
  if (wBox.paintPoints > lBox.paintPoints + 6) winPts.push({ text: `Dominated the paint (${wBox.paintPoints} vs ${lBox.paintPoints})`, positive: true })
  if (wTot.reb > lTot.reb + 4) winPts.push({ text: `Won the rebounding battle (${wTot.reb} vs ${lTot.reb})`, positive: true })
  if (wp.defense - lp.offense > 6) winPts.push({ text: "Defense contained their scorers", positive: true })
  if (wTot.ast >= lTot.ast + 3) winPts.push({ text: `Superior ball movement (${wTot.ast} assists)`, positive: true })
  if (wBox.fastBreakPoints > lBox.fastBreakPoints + 4) winPts.push({ text: `Ran in transition (${wBox.fastBreakPoints} fast-break points)`, positive: true })
  if (wp.chemistry - lp.chemistry > 8) winPts.push({ text: "Cleaner lineup fit and chemistry", positive: true })
  // Standout individual
  const wStar = result.topPerformers.find((t) => t.team === winner)
  if (wStar) winPts.push({ text: `${wStar.name} led the way — ${wStar.line}`, positive: true })
  if (winPts.length === 0) winPts.push({ text: "Executed better in the clutch", positive: true })

  // ── Why the loser lost ────────────────────────────────────────────────────
  const losePts: TeamAnalysisPoint[] = []
  if (lp.perimeterDefense < 62) losePts.push({ text: "Poor perimeter defense gave up open shots", positive: false })
  if (lp.usageOverlap > 40) losePts.push({ text: "Too much offensive overlap — stars competed for touches", positive: false })
  if (lTot.tov > wTot.tov + 3) losePts.push({ text: `Turned it over too much (${lTot.tov} turnovers)`, positive: false })
  if (lp.rimProtection < 60) losePts.push({ text: "No rim protection at the basket", positive: false })
  if (lp.spacing < 62) losePts.push({ text: "Spacing was cramped — defenders sagged off", positive: false })
  if (lp.rebounding < wp.rebounding - 4) losePts.push({ text: "Got beaten on the glass", positive: false })
  if (lp.chemistry < 50) losePts.push({ text: "Lineup fit never came together", positive: false })
  if (losePts.length === 0) losePts.push({ text: "Couldn't get enough stops down the stretch", positive: false })

  result.analysis = {
    [winner]: winPts.slice(0, 5),
    [loser]: losePts.slice(0, 5),
  } as Record<TeamId, TeamAnalysisPoint[]>

  return result
}
