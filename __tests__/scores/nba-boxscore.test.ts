/**
 * shapeNbaBoxscore turns our own DB rows (nba_games + nba_player_stats) into the
 * two-team boxscore the player-analysis popup renders — no ESPN. This verifies
 * players split onto the correct team by tri-code, stat lines map correctly, and
 * the final score is returned from our DB.
 */
import { describe, it, expect } from "vitest"
import { shapeNbaBoxscore, type NbaGameRow, type NbaPlayerStatRow } from "@/lib/scores/nbaBoxscore"

const game: NbaGameRow = {
  home_team: "Los Angeles Lakers",
  away_team: "Boston Celtics",
  home_score: 110,
  away_score: 99,
  game_date: "2021-06-01",
  status: "Finished",
}

const players: NbaPlayerStatRow[] = [
  {
    player_name: "LeBron James",
    team: "LAL",
    position: "SF",
    minutes: "36:12",
    pts: 30, trb: 8, ast: 10, tp: 3, stl: 2, blk: 1, tov: 4, fg: 11, fga: 20, ft: 5, fta: 6,
  },
  {
    player_name: "Anthony Davis",
    team: "LAL",
    position: "PF",
    minutes: 34,
    pts: 22, trb: 12, ast: 2, tp: 0, stl: 1, blk: 3, tov: 2, fg: 9, fga: 15, ft: 4, fta: 4,
  },
  {
    player_name: "Jayson Tatum",
    team: "BOS",
    position: "SF",
    minutes: "38:00",
    pts: 28, trb: 7, ast: 5, tp: 4, stl: 1, blk: 0, tov: 3, fg: 10, fga: 22, ft: 4, fta: 5,
  },
  {
    player_name: "Jaylen Brown",
    team: "BOS",
    position: "SG",
    minutes: "35:30",
    pts: 24, trb: 6, ast: 3, tp: 2, stl: 2, blk: 1, tov: 2, fg: 9, fga: 18, ft: 4, fta: 4,
  },
]

describe("shapeNbaBoxscore", () => {
  it("produces two teams, home first, with the final score", () => {
    const box = shapeNbaBoxscore(game, players)

    expect(box.homeTeam).toBe("Los Angeles Lakers")
    expect(box.awayTeam).toBe("Boston Celtics")
    expect(box.homeScore).toBe(110)
    expect(box.awayScore).toBe(99)
    expect(box.status).toBe("Finished")

    expect(box.players).toHaveLength(2)
    expect(box.players[0].homeAway).toBe("home")
    expect(box.players[0].team).toBe("LAL")
    expect(box.players[1].homeAway).toBe("away")
    expect(box.players[1].team).toBe("BOS")
  })

  it("splits players onto the correct team by tri-code", () => {
    const box = shapeNbaBoxscore(game, players)

    const homeNames = box.players[0].categories[0].athletes.map((a) => a.name)
    const awayNames = box.players[1].categories[0].athletes.map((a) => a.name)

    expect(homeNames).toEqual(expect.arrayContaining(["LeBron James", "Anthony Davis"]))
    expect(awayNames).toEqual(expect.arrayContaining(["Jayson Tatum", "Jaylen Brown"]))
    expect(homeNames).not.toContain("Jayson Tatum")
  })

  it("maps stat lines correctly (MIN/PTS/REB/AST/STL/BLK/TO/FG/FT) and orders by points", () => {
    const box = shapeNbaBoxscore(game, players)

    // Labels order is stable.
    expect(box.players[0].categories[0].labels).toEqual(["MIN", "PTS", "REB", "AST", "STL", "BLK", "TO", "FG", "FT"])

    // Highest scorer first within each team.
    const lebron = box.players[0].categories[0].athletes[0]
    expect(lebron.name).toBe("LeBron James")
    // MIN from "36:12" -> "36", shooting splits as made-attempt.
    expect(lebron.stats).toEqual(["36", "30", "8", "10", "2", "1", "4", "11-20", "5-6"])

    const davis = box.players[0].categories[0].athletes[1]
    // Numeric minutes rounded.
    expect(davis.stats[0]).toBe("34")
  })

  it("keeps both teams present even if one side has no rows", () => {
    const box = shapeNbaBoxscore(game, players.filter((p) => p.team === "LAL"))
    expect(box.players).toHaveLength(2)
    expect(box.players[0].categories[0].athletes.length).toBe(2)
    expect(box.players[1].categories[0].athletes.length).toBe(0)
  })
})
