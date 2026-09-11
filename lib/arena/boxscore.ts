/**
 * BoxScoreGenerator helpers — derive team totals from player lines and provide
 * a consistency check used by tests (team totals must equal the sum of lines).
 */

import type { PlayerBoxLine, TeamBox, TeamId } from "./types"

export function teamTotalsFromLines(lines: PlayerBoxLine[], team: TeamId) {
  const rows = lines.filter((l) => l.team === team)
  const sum = (f: (l: PlayerBoxLine) => number) => rows.reduce((s, l) => s + f(l), 0)
  return {
    pts: sum((l) => l.pts),
    fgm: sum((l) => l.fgm),
    fga: sum((l) => l.fga),
    tpm: sum((l) => l.tpm),
    tpa: sum((l) => l.tpa),
    ftm: sum((l) => l.ftm),
    fta: sum((l) => l.fta),
    reb: sum((l) => l.reb),
    ast: sum((l) => l.ast),
    tov: sum((l) => l.tov),
    stl: sum((l) => l.stl),
    blk: sum((l) => l.blk),
  }
}

export function pct(made: number, att: number): number {
  if (att <= 0) return 0
  return Math.round((made / att) * 1000) / 10
}

/**
 * Internal consistency: points must equal 2*(fgm - tpm) + 3*tpm + ftm, and the
 * sum of player points must equal the team box points.
 */
export function boxScoreConsistent(lines: PlayerBoxLine[], teamBox: Record<TeamId, TeamBox>): boolean {
  for (const team of ["P1", "P2"] as TeamId[]) {
    const totals = teamTotalsFromLines(lines, team)
    const derivedPts = 2 * (totals.fgm - totals.tpm) + 3 * totals.tpm + totals.ftm
    if (derivedPts !== totals.pts) return false
    if (totals.pts !== teamBox[team].points) return false
    if (totals.fgm > totals.fga) return false
    if (totals.tpm > totals.tpa) return false
    if (totals.ftm > totals.fta) return false
  }
  return true
}
