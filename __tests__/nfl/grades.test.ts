import { gradeManager, scoreToGrade, estimatedPrice, type LetterGrade } from "@/lib/nfl/grades"
import { emptyRoster, placePlayer } from "@/lib/nfl/roster"
import { findPlayer, getSeasonPlayers } from "@/lib/nfl/data"
import type { NflPlayer, Position, RosterState } from "@/lib/nfl/types"

const SEASON = "2025"

// Pick real players from the generated pool by position, so these tests stay
// valid as the (stat-derived) pool changes rather than hardcoding slug ids.
// One QB/RB/TE/EDGE/LB/CB/S + two WRs = a legal 9-man roster.
const POOL = getSeasonPlayers(SEASON)
function nthByPosition(pos: Position, n: number, best: boolean): NflPlayer {
  const sorted = [...POOL]
    .filter((p) => p.position === pos)
    .sort((a, b) => (best ? b.overall - a.overall : a.overall - b.overall))
  const p = sorted[n]
  if (!p) throw new Error(`no ${pos} at index ${n} in pool`)
  return p
}
function buildSquad(best: boolean): NflPlayer[] {
  return [
    nthByPosition("QB", 0, best),
    nthByPosition("RB", 0, best),
    nthByPosition("WR", 0, best),
    nthByPosition("WR", 1, best),
    nthByPosition("TE", 0, best),
    nthByPosition("EDGE", 0, best),
    nthByPosition("LB", 0, best),
    nthByPosition("CB", 0, best),
    nthByPosition("S", 0, best),
  ]
}

const STRONG_PLAYERS = buildSquad(true)
const WEAK_PLAYERS = buildSquad(false)
const STRONG = STRONG_PLAYERS.map((p) => p.id)
const WEAK = WEAK_PLAYERS.map((p) => p.id)

/** Build a full 9-slot roster from ids at a fixed price each. */
function rosterFrom(ids: string[], price = 3): RosterState {
  let roster = emptyRoster()
  for (const id of ids) {
    const p = findPlayer(SEASON, id)
    if (!p) throw new Error(`missing seed player: ${id}`)
    roster = placePlayer(roster, p, price)
  }
  return roster
}

const ORDER: LetterGrade[] = ["F","D-","D","D+","C-","C","C+","B-","B","B+","A-","A","A+"]
const rank = (g: LetterGrade) => ORDER.indexOf(g)

describe("NFL — scoreToGrade", () => {
  it("maps scores to sane letter grades within range", () => {
    expect(scoreToGrade(100)).toBe("A+")
    expect(scoreToGrade(0)).toBe("F")
    expect(scoreToGrade(80)).toBe("B")
    // Clamps out-of-range input.
    expect(scoreToGrade(150)).toBe("A+")
    expect(scoreToGrade(-20)).toBe("F")
  })
})

describe("NFL — estimatedPrice", () => {
  it("scales with league budget and stays >= 1", () => {
    const topQb = nthByPosition("QB", 0, true)
    const cheap = estimatedPrice(topQb, 25, 9)
    const rich = estimatedPrice(topQb, 100, 9)
    expect(cheap).toBeGreaterThanOrEqual(1)
    expect(rich).toBeGreaterThan(cheap)
  })
})

describe("NFL — gradeManager", () => {
  it("is deterministic for the same roster + budget", () => {
    const roster = rosterFrom(STRONG, 3)
    const a = gradeManager("P1", roster, 50, 9)
    const b = gradeManager("P1", roster, 50, 9)
    expect(a).toEqual(b)
  })

  it("grades an elite roster higher than a weak one", () => {
    const strong = gradeManager("P1", rosterFrom(STRONG, 3), 50, 9)
    const weak = gradeManager("P1", rosterFrom(WEAK, 3), 50, 9)
    expect(strong.overallScore).toBeGreaterThan(weak.overallScore)
    expect(rank(strong.overall)).toBeGreaterThanOrEqual(rank(weak.overall))
  })

  it("covers all five position groups", () => {
    const g = gradeManager("P1", rosterFrom(STRONG, 3), 50, 9)
    expect(g.positions.map((p) => p.group).sort()).toEqual(["DEF", "QB", "RB", "TE", "WR"])
    for (const p of g.positions) {
      expect(p.score).toBeGreaterThanOrEqual(0)
      expect(p.score).toBeLessThanOrEqual(100)
      expect(ORDER).toContain(p.grade)
      expect(p.note.length).toBeGreaterThan(0)
    }
  })

  it("rewards value hunting when players are bought below estimate", () => {
    // Same elite roster, bought dirt cheap ($1) vs. bought at a steep price.
    const bargain = gradeManager("P1", rosterFrom(STRONG, 1), 50, 9)
    const overpaid = gradeManager("P1", rosterFrom(STRONG, 5), 50, 9)
    expect(rank(bargain.valueHunting.grade)).toBeGreaterThanOrEqual(rank(overpaid.valueHunting.grade))
    expect(bargain.budgetEfficiency).toBeGreaterThanOrEqual(overpaid.budgetEfficiency)
  })

  it("flags a genuine overpay as the biggest overpay", () => {
    // Buy a low-tier defender at a star price → clear overpay.
    let roster = emptyRoster()
    // A low-rated safety bought at a star price → clear overpay.
    const cheapPlayer = nthByPosition("S", 0, false)
    const cheapId = cheapPlayer.id
    const rest = STRONG.filter((id) => findPlayer(SEASON, id)!.position !== "S")
    for (const id of rest) roster = placePlayer(roster, findPlayer(SEASON, id)!, 2)
    roster = placePlayer(roster, cheapPlayer, 20) // massive overpay

    const g = gradeManager("P1", roster, 100, 9)
    expect(g.biggestOverpay).not.toBeNull()
    expect(g.biggestOverpay!.playerId).toBe(cheapId)
    expect(g.biggestOverpay!.delta).toBeLessThan(0)
  })

  it("totalSpent matches the sum of prices paid", () => {
    const g = gradeManager("P1", rosterFrom(STRONG, 4), 50, 9)
    expect(g.totalSpent).toBe(STRONG.length * 4)
  })
})
