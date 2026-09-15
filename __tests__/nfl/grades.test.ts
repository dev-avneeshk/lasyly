import { gradeManager, scoreToGrade, estimatedPrice, type LetterGrade } from "@/lib/nfl/grades"
import { emptyRoster, placePlayer } from "@/lib/nfl/roster"
import { findPlayer } from "@/lib/nfl/data"
import type { RosterState } from "@/lib/nfl/types"

const SEASON = "2025"

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

// A strong, legal 9-man roster (QB/RB/WR/WR/TE + EDGE/LB/CB/S).
const STRONG = [
  "patrick-mahomes", "christian-mccaffrey", "justin-jefferson", "ja-marr-chase", "travis-kelce",
  "myles-garrett", "fred-warner", "patrick-surtain", "minkah-fitzpatrick",
]
const WEAK = [
  "caleb-williams", "kyren-williams", "jaylen-waddle", "nico-collins", "dallas-goedert",
  "will-anderson", "zaire-franklin", "devon-witherspoon", "budda-baker",
]

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
    const mahomes = findPlayer(SEASON, "patrick-mahomes")!
    const cheap = estimatedPrice(mahomes, 25, 9)
    const rich = estimatedPrice(mahomes, 100, 9)
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
    const cheapId = "budda-baker" // solid but not an elite auction target
    const rest = STRONG.filter((id) => findPlayer(SEASON, id)!.position !== "S")
    for (const id of rest) roster = placePlayer(roster, findPlayer(SEASON, id)!, 2)
    roster = placePlayer(roster, findPlayer(SEASON, cheapId)!, 20) // massive overpay

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
