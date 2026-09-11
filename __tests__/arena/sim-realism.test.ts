/**
 * Simulation realism guards.
 *
 * These pin down bugs that produced physically impossible box scores:
 *  - rebounds/steals/blocks were awarded with maxBy(), so the single best
 *    rebounder on the floor got EVERY board (40+ rebound games) and every guard
 *    finished with exactly 0 across hundreds of games;
 *  - second-chance points were credited on the rebounding possession instead of
 *    the possession that followed, so the stat was always 0;
 *  - missed final free throws produced no rebound and did not continue play;
 *  - the shot diet was near-uniform, giving ~16 three-point attempts a game;
 *  - a tie broken after overtime bumped the score without touching the box score.
 *
 * Ranges are deliberately wide — this guards against structural breakage, not
 * exact tuning.
 */

import { simulateGame } from "@/lib/arena/simulation"
import { getSeasonPlayers } from "@/lib/arena/data"
import { emptyRoster, placePlayer, eligiblePositions } from "@/lib/arena/roster"
import { boxScoreConsistent, teamTotalsFromLines } from "@/lib/arena/boxscore"
import { POSITIONS, type Position, type RosterState, type TeamId } from "@/lib/arena/types"

const SEASON = "2025-26"
const GAMES = 120

function buildRosters(seed: number): [RosterState, RosterState] {
  const pool = getSeasonPlayers(SEASON)
  const order = [...pool].sort(
    (a, b) => ((a.id.length * seed) % 97) - ((b.id.length * seed) % 97) || a.id.localeCompare(b.id)
  )
  const used = new Set<string>()
  const make = (): RosterState => {
    let r = emptyRoster()
    for (const pos of POSITIONS) {
      const p = order.find((x) => !used.has(x.id) && eligiblePositions(x).includes(pos))!
      used.add(p.id)
      r = placePlayer(r, p, 5, pos)
    }
    const b = order.find((x) => !used.has(x.id))!
    used.add(b.id)
    return placePlayer(r, b, 5, "BENCH")
  }
  return [make(), make()]
}

interface Agg {
  teamGames: number
  playerLines: number
  reb: number
  maxReb: number
  guardZeroReb: number
  guardLines: number
  stl: number
  blk: number
  ast: number
  tov: number
  fta: number
  ftm: number
  pts: number
  fga: number
  fgm: number
  tpa: number
  tpm: number
  secondChance: number
  minutesMismatch: number
  overLongMinutes: number
  inconsistent: number
  scoreMismatch: number
  ties: number
}

function runGames(): Agg {
  const a: Agg = {
    teamGames: 0, playerLines: 0, reb: 0, maxReb: 0, guardZeroReb: 0, guardLines: 0,
    stl: 0, blk: 0, ast: 0, tov: 0, fta: 0, ftm: 0, pts: 0, fga: 0, fgm: 0,
    tpa: 0, tpm: 0, secondChance: 0, minutesMismatch: 0, overLongMinutes: 0,
    inconsistent: 0, scoreMismatch: 0, ties: 0,
  }

  for (let seed = 1; seed <= GAMES; seed++) {
    const [r1, r2] = buildRosters(seed)
    const res = simulateGame(r1, r2, SEASON, seed * 7919)

    if (!boxScoreConsistent(res.boxScore, res.teamBox)) a.inconsistent++
    if (res.finalScore.p1 === res.finalScore.p2) a.ties++
    // The headline score must equal the box score total.
    if (res.finalScore.p1 !== teamTotalsFromLines(res.boxScore, "P1").pts) a.scoreMismatch++
    if (res.finalScore.p2 !== teamTotalsFromLines(res.boxScore, "P2").pts) a.scoreMismatch++

    const otPeriods = Math.max(0, res.quarters.length - 4)
    const gameMinutes = 48 + otPeriods * 5

    for (const team of ["P1", "P2"] as TeamId[]) {
      a.teamGames++
      const lines = res.boxScore.filter((l) => l.team === team)
      const teamMin = lines.reduce((s, l) => s + l.min, 0)
      if (Math.abs(teamMin - gameMinutes * 5) > 3) a.minutesMismatch++
      for (const l of lines) {
        a.playerLines++
        if (l.min > gameMinutes) a.overLongMinutes++
        a.reb += l.reb
        a.maxReb = Math.max(a.maxReb, l.reb)
        a.stl += l.stl; a.blk += l.blk; a.ast += l.ast; a.tov += l.tov
        a.fta += l.fta; a.ftm += l.ftm; a.pts += l.pts
        a.fga += l.fga; a.fgm += l.fgm; a.tpa += l.tpa; a.tpm += l.tpm
        if (["PG", "SG"].includes(l.slot as Position)) {
          a.guardLines++
          if (l.reb === 0) a.guardZeroReb++
        }
      }
      a.secondChance += res.teamBox[team].secondChancePoints
    }
  }
  return a
}

describe("simulation realism", () => {
  const a = runGames()
  const per = (n: number) => n / a.teamGames

  it("keeps minutes physically possible", () => {
    // Every player line must fit inside its own game's length (48 + 5 per OT).
    expect(a.overLongMinutes).toBe(0)
    // Five players on the floor at all times → team minutes = length * 5.
    expect(a.minutesMismatch).toBe(0)
  })

  it("never produces a tie and always reconciles score with the box score", () => {
    expect(a.ties).toBe(0)
    expect(a.scoreMismatch).toBe(0)
    expect(a.inconsistent).toBe(0)
  })

  it("spreads rebounds across the roster instead of funnelling them to one player", () => {
    // Regression: guards used to finish with 0 rebounds in 100% of games.
    const guardZeroRate = a.guardZeroReb / a.guardLines
    expect(guardZeroRate, `${(guardZeroRate * 100).toFixed(1)}% of guard lines had 0 reb`).toBeLessThan(0.2)
    // Regression: a single player used to grab 40-51 boards.
    expect(a.maxReb, `one player grabbed ${a.maxReb} rebounds`).toBeLessThanOrEqual(30)
    expect(per(a.reb)).toBeGreaterThan(36)
    expect(per(a.reb)).toBeLessThan(52)
  })

  it("produces NBA-range team rates", () => {
    expect(per(a.pts), "points").toBeGreaterThan(100)
    expect(per(a.pts), "points").toBeLessThan(124)
    expect(per(a.fga), "FGA").toBeGreaterThan(78)
    expect(per(a.fga), "FGA").toBeLessThan(96)
    expect(per(a.tpa), "3PA").toBeGreaterThan(26) // was ~16 with the flat shot diet
    expect(per(a.ast), "AST").toBeGreaterThan(19)
    expect(per(a.tov), "TOV").toBeGreaterThan(9)
    expect(per(a.stl), "STL").toBeGreaterThan(4)
    expect(per(a.blk), "BLK").toBeGreaterThan(2.5)
    expect(per(a.fta), "FTA").toBeGreaterThan(16)
    // Second-chance points were hard-stuck at 0.
    expect(per(a.secondChance), "2nd chance pts").toBeGreaterThan(6)
  })

  it("produces NBA-range shooting percentages", () => {
    const fgPct = (a.fgm / a.fga) * 100
    const tpPct = (a.tpm / a.tpa) * 100
    const ftPct = (a.ftm / a.fta) * 100
    expect(fgPct, `FG% ${fgPct.toFixed(1)}`).toBeGreaterThan(42)
    expect(fgPct, `FG% ${fgPct.toFixed(1)}`).toBeLessThan(51)
    expect(tpPct, `3P% ${tpPct.toFixed(1)}`).toBeGreaterThan(31)
    expect(tpPct, `3P% ${tpPct.toFixed(1)}`).toBeLessThan(41)
    expect(ftPct, `FT% ${ftPct.toFixed(1)}`).toBeGreaterThan(70)
    expect(ftPct, `FT% ${ftPct.toFixed(1)}`).toBeLessThan(88)
  })
})
