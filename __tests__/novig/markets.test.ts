import { describe, expect, it } from "vitest"
import fixture from "@/__tests__/fixtures/novig/nba-props-novig-2026-10-20.json"
import { MARKET_ALIASES, NOVIG_MARKET_TO_STAT, REQUESTED_MARKETS, mapMarketKey } from "@/lib/novig/markets"

const rows = fixture as { bookmaker: string; market_key: string }[]

describe("Novig market mapping", () => {
  it("maps every core Novig market key in the fixture", () => {
    const expected: Record<string, string> = {
      player_points: "pts",
      player_rebounds: "trb",
      player_assists: "ast",
      player_threes: "tp",
      player_steals: "stl",
      player_blocks: "blk",
    }
    const novigKeys = new Set(rows.filter((r) => r.bookmaker === "novig").map((r) => r.market_key))
    for (const [key, stat] of Object.entries(expected)) {
      expect(novigKeys.has(key), `${key} present in fixture`).toBe(true)
      expect(mapMarketKey(key)).toBe(stat)
    }
    expect(mapMarketKey("player_turnovers")).toBe("tov")
  })

  it("maps aliases seen for other books", () => {
    expect(mapMarketKey("player_threes_made")).toBe("tp")
    expect(mapMarketKey("player_three_pointers")).toBe("tp")
    expect(mapMarketKey("prophetx_player_total_steals")).toBe("stl")
    expect(mapMarketKey("prophetx_player_total_blocks")).toBe("blk")
    for (const target of Object.values(MARKET_ALIASES)) expect(NOVIG_MARKET_TO_STAT[target]).toBeDefined()
  })

  it("returns null for combo, novelty, period and unknown keys", () => {
    for (const key of [
      "player_pts_rebs_asts",
      "player_pts_rebs",
      "player_pts_asts",
      "player_rebs_asts",
      "player_pra",
      "player_double_double",
      "player_triple_double",
      "player_first_basket",
      "player_assists_1st_quarter",
      "toString",
      "",
      null,
      undefined,
    ]) {
      expect(mapMarketKey(key as string)).toBeNull()
    }
  })

  it("requests exactly the 7 displayable markets", () => {
    expect([...REQUESTED_MARKETS]).toEqual([
      "player_points",
      "player_rebounds",
      "player_assists",
      "player_threes",
      "player_steals",
      "player_blocks",
      "player_turnovers",
    ])
  })
})
