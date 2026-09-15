import {
  aggregatePlayer,
  resolvePosition,
  scorePlayer,
  buildPositionContexts,
  spreadScores,
  tierForScore,
  percentile,
  resolveMinGames,
} from "../../lib/rankings/nfl/engine"
import type { NflStatRow } from "../../lib/rankings/nfl/types"

// Build a per-game stat row with only the fields a test cares about.
function row(partial: Partial<NflStatRow>): NflStatRow {
  return {
    player_name: "Test Player",
    athlete_id: null,
    team: "KC",
    position: null,
    game_date: "2026-09-01",
    pass_yds: 0,
    pass_td: 0,
    pass_int: 0,
    pass_att: 0,
    pass_c: 0,
    pass_rtg: 0,
    rush_att: 0,
    rush_yds: 0,
    rush_td: 0,
    rec: 0,
    rec_yds: 0,
    rec_td: 0,
    targets: 0,
    fumbles_lost: 0,
    tackles_total: 0,
    sacks: 0,
    def_int: 0,
    def_td: 0,
    passes_def: 0,
    ...partial,
  }
}

describe("NFL Ranking Engine", () => {
  describe("resolvePosition", () => {
    it("respects explicit skill positions", () => {
      expect(resolvePosition({ position: "QB", passYds: 4000, rushYds: 200, recYds: 0, tackles: 0, sacks: 0, defInt: 0 })).toBe("QB")
      expect(resolvePosition({ position: "RB", passYds: 0, rushYds: 1200, recYds: 300, tackles: 0, sacks: 0, defInt: 0 })).toBe("RB")
      expect(resolvePosition({ position: "WR", passYds: 0, rushYds: 20, recYds: 1100, tackles: 0, sacks: 0, defInt: 0 })).toBe("WR")
    })

    it("classifies defensive players as DEF", () => {
      expect(resolvePosition({ position: "LB", passYds: 0, rushYds: 0, recYds: 0, tackles: 90, sacks: 4, defInt: 1 })).toBe("DEF")
      expect(resolvePosition({ position: "CB", passYds: 0, rushYds: 0, recYds: 0, tackles: 60, sacks: 0, defInt: 5 })).toBe("DEF")
    })

    it("falls back on production when position is missing", () => {
      expect(resolvePosition({ position: null, passYds: 3000, rushYds: 100, recYds: 0, tackles: 0, sacks: 0, defInt: 0 })).toBe("QB")
      expect(resolvePosition({ position: null, passYds: 0, rushYds: 0, recYds: 0, tackles: 80, sacks: 6, defInt: 2 })).toBe("DEF")
    })
  })

  describe("aggregatePlayer", () => {
    it("sums season totals and averages passer rating over rated games", () => {
      const agg = aggregatePlayer([
        row({ position: "QB", pass_yds: 300, pass_td: 3, pass_att: 30, pass_c: 22, pass_rtg: 110 }),
        row({ position: "QB", pass_yds: 250, pass_td: 1, pass_att: 28, pass_c: 18, pass_rtg: 90 }),
      ])
      expect(agg.games).toBe(2)
      expect(agg.passYds).toBe(550)
      expect(agg.passTd).toBe(4)
      expect(agg.position).toBe("QB")
      expect(agg.passerRating).toBe(100) // (110 + 90) / 2
    })

    it("picks the most common team when a player was traded", () => {
      const agg = aggregatePlayer([
        row({ team: "NYJ", rec: 5, rec_yds: 60, position: "WR" }),
        row({ team: "NYJ", rec: 4, rec_yds: 40, position: "WR" }),
        row({ team: "LV", rec: 6, rec_yds: 80, position: "WR" }),
      ])
      expect(agg.team).toBe("NYJ")
    })
  })

  describe("percentile", () => {
    it("returns 50 for an empty population", () => {
      expect(percentile(10, [])).toBe(50)
    })
    it("ranks the top value near 100 and bottom near 0", () => {
      const pop = [1, 2, 3, 4, 5]
      expect(percentile(5, pop)).toBeGreaterThan(80)
      expect(percentile(1, pop)).toBeLessThan(20)
    })
  })

  describe("tierForScore", () => {
    it("maps score bands to ordered tiers", () => {
      expect(tierForScore(99)).toBe("Ω — Apex")
      expect(tierForScore(80)).toBe("S — Elite")
      expect(tierForScore(58)).toBe("B — Impact")
      expect(tierForScore(50)).toBe("C — Rotation")
      expect(tierForScore(10)).toBe("E — Fringe")
    })
  })

  describe("spreadScores", () => {
    it("preserves order and spans the band", () => {
      const out = spreadScores([100, 50, 10], 40, 100)
      expect(out[0]).toBe(100) // best raw → top of band
      expect(out[2]).toBe(40) // worst raw → bottom of band
      expect(out[0]).toBeGreaterThan(out[1])
      expect(out[1]).toBeGreaterThan(out[2])
    })
    it("handles a single player", () => {
      expect(spreadScores([42]).length).toBe(1)
    })
  })

  describe("resolveMinGames", () => {
    it("ramps the qualification bar with the season", () => {
      expect(resolveMinGames(1)).toBe(1)
      expect(resolveMinGames(5)).toBe(2)
      expect(resolveMinGames(12)).toBe(4)
    })
  })

  describe("scorePlayer", () => {
    it("ranks an elite QB above a replacement QB in the same group", () => {
      const elite = aggregatePlayer(
        Array.from({ length: 10 }, () =>
          row({ position: "QB", pass_yds: 320, pass_td: 3, pass_att: 34, pass_c: 24, pass_rtg: 115 })
        )
      )
      const weak = aggregatePlayer(
        Array.from({ length: 10 }, () =>
          row({ position: "QB", pass_yds: 180, pass_td: 0, pass_int: 2, pass_att: 30, pass_c: 15, pass_rtg: 65, player_name: "Weak QB" })
        )
      )
      const ctx = buildPositionContexts([elite, weak])
      const eliteScore = scorePlayer(elite, ctx, 10)
      const weakScore = scorePlayer(weak, ctx, 10)

      expect(eliteScore.overall_score).toBeGreaterThan(weakScore.overall_score)
      expect(eliteScore.scoring_score).toBeGreaterThanOrEqual(weakScore.scoring_score)
      expect(eliteScore.overall_score).toBeGreaterThanOrEqual(0)
      expect(eliteScore.overall_score).toBeLessThanOrEqual(100)
    })

    it("gives defensive players a defense_score and surfaces two-way", () => {
      const lb = aggregatePlayer(
        Array.from({ length: 8 }, () =>
          row({ position: "LB", tackles_total: 9, sacks: 1, def_int: 0, passes_def: 1 })
        )
      )
      const ctx = buildPositionContexts([lb])
      const s = scorePlayer(lb, ctx, 8)
      expect(s.position).toBe("DEF")
      expect(s.defense_score).toBeGreaterThan(0)
      expect(s.two_way_score).toBeGreaterThanOrEqual(s.offense_score)
    })
  })
})
