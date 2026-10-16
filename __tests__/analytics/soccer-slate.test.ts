/**
 * mergeSlateTeams: ESPN fixtures always count; imported Big-5 teams only fill
 * in for a covered league that has no ESPN fixture in the window.
 */
import { describe, it, expect } from "vitest"
import { mergeSlateTeams } from "@/lib/soccer/slate"
import { BIG5_LEAGUE_CODES } from "@/lib/soccer/big5"

describe("mergeSlateTeams", () => {
  it("a covered league with ESPN fixtures ignores DB teams", () => {
    const teams = mergeSlateTeams(
      [{ league: "eng.1", home_team: "Arsenal", away_team: "Chelsea" }],
      [{ league: "eng.1", home_team: "Everton", away_team: "Fulham" }],
      BIG5_LEAGUE_CODES
    )
    expect(teams).toEqual(["Arsenal", "Chelsea"])
  })

  it("a covered league without fixtures includes recent DB teams", () => {
    const teams = mergeSlateTeams(
      [{ league: "usa.1", home_team: "LA Galaxy", away_team: null }],
      [{ league: "esp.1", home_team: "Barcelona", away_team: "Real Madrid" }],
      BIG5_LEAGUE_CODES
    )
    expect(teams).toEqual(["LA Galaxy", "Barcelona", "Real Madrid"])
  })

  it("uncovered leagues never come from the DB", () => {
    const teams = mergeSlateTeams(
      [],
      [
        { league: "usa.1", home_team: "Inter Miami CF", away_team: "Orlando City" },
        { league: "uefa.champions", home_team: "Arsenal", away_team: "PSV" },
      ],
      BIG5_LEAGUE_CODES
    )
    expect(teams).toEqual([])
  })

  it("dedupes teams across fixtures and DB matches", () => {
    const teams = mergeSlateTeams(
      [
        { league: "eng.1", home_team: "Arsenal", away_team: "Chelsea" },
        { league: "uefa.champions", home_team: "Arsenal", away_team: "Bayern Munich" },
      ],
      [
        { league: "ger.1", home_team: "Bayern Munich", away_team: "SC Freiburg" },
        { league: "ger.1", home_team: "SC Freiburg", away_team: "Bayern Munich" },
      ],
      BIG5_LEAGUE_CODES
    )
    expect(teams).toEqual(["Arsenal", "Chelsea", "Bayern Munich", "SC Freiburg"])
  })
})
