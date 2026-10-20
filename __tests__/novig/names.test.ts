import { describe, expect, it } from "vitest"
import { NAME_ALIASES, matchPlayer, normalizePersonName } from "@/lib/novig/names"

describe("normalizePersonName", () => {
  it("strips accents, case, periods, apostrophes, suffixes and a team tag", () => {
    expect(normalizePersonName("Jayson Tatum (BOS)")).toBe("jayson tatum")
    expect(normalizePersonName("Nikola Jokić")).toBe("nikola jokic")
    expect(normalizePersonName("P.J. Washington")).toBe("pj washington")
    expect(normalizePersonName("De'Aaron Fox")).toBe("deaaron fox")
    expect(normalizePersonName("Jaren Jackson Jr.")).toBe("jaren jackson")
    expect(normalizePersonName("Marvin Bagley III")).toBe("marvin bagley")
    expect(normalizePersonName("Shai Gilgeous-Alexander")).toBe("shai gilgeous alexander")
    expect(normalizePersonName("  ")).toBe("")
    expect(normalizePersonName(null)).toBe("")
  })
})

describe("matchPlayer", () => {
  const league = (names: string[]) => names.map((name, i) => ({ id: `id-${i}`, name }))

  it("resolves 'Ronald Holland' through the alias to 'Ron Holland'", () => {
    expect(NAME_ALIASES["ronald holland"]).toBe("ron holland")
    const m = matchPlayer("Ronald Holland", { teamPool: ["Ron Holland"], leaguePool: league(["Ron Holland"]) })
    expect(m).toEqual({ playerId: "id-0", playerName: "Ron Holland", method: "alias" })
  })

  it("matches exactly across accents, periods and suffixes", () => {
    const leaguePool = league(["Nikola Jokic", "PJ Washington", "Jaren Jackson", "Marvin Bagley", "Jayson Tatum"])
    expect(matchPlayer("Nikola Jokić", { teamPool: [], leaguePool })).toEqual({
      playerId: "id-0",
      playerName: "Nikola Jokic",
      method: "exact",
    })
    expect(matchPlayer("P.J. Washington", { teamPool: [], leaguePool }).playerId).toBe("id-1")
    expect(matchPlayer("Jaren Jackson Jr.", { teamPool: [], leaguePool }).playerId).toBe("id-2")
    expect(matchPlayer("Marvin Bagley III", { teamPool: [], leaguePool }).playerId).toBe("id-3")
    expect(matchPlayer("Jayson Tatum (BOS)", { teamPool: [], leaguePool }).method).toBe("exact")
  })

  it("an exact team-pool hit without a league row still matches (no id)", () => {
    expect(matchPlayer("Ausar Thompson", { teamPool: ["Ausar Thompson"], leaguePool: [] })).toEqual({
      playerId: null,
      playerName: "Ausar Thompson",
      method: "exact",
    })
  })

  it("fuzzy-matches a unique team-pool candidate (no alias for 'ron holland')", () => {
    const m = matchPlayer("Ron Holland", {
      teamPool: ["Ronald Holland", "Cade Cunningham"],
      leaguePool: league(["Ronald Holland"]),
    })
    expect(m).toEqual({ playerId: "id-0", playerName: "Ronald Holland", method: "fuzzy" })
  })

  it("rejects an ambiguous fuzzy match", () => {
    expect(
      matchPlayer("J. Williams", { teamPool: ["Jalen Williams", "Jaylin Williams"], leaguePool: [] }).method,
    ).toBe("unmatched")
  })

  it("resolves a league-pool duplicate with the team pool", () => {
    const leaguePool = [
      { id: "sr", name: "Marcus Morris Sr." },
      { id: "plain", name: "Marcus Morris" },
    ]
    expect(matchPlayer("Marcus Morris", { teamPool: ["Marcus Morris Sr."], leaguePool })).toEqual({
      playerId: "sr",
      playerName: "Marcus Morris Sr.",
      method: "exact",
    })
    expect(matchPlayer("Marcus Morris", { teamPool: [], leaguePool }).method).toBe("unmatched")
  })

  it("never fuzzy-matches against the league pool", () => {
    expect(matchPlayer("Ron Holland", { teamPool: [], leaguePool: league(["Ronald Holland"]) }).method).toBe(
      "unmatched",
    )
  })

  it("returns unmatched for unknown or empty names", () => {
    expect(matchPlayer("Nobody Here", { teamPool: ["Jayson Tatum"], leaguePool: [] })).toEqual({
      playerId: null,
      playerName: null,
      method: "unmatched",
    })
    expect(matchPlayer("", { teamPool: [], leaguePool: [] }).method).toBe("unmatched")
  })
})
